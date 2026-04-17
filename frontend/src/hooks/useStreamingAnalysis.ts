/**
 * Hook that drives the two-stage analysis flow:
 *
 *   1. {@link runOverview} — calls `/api/analyze/overview` and parks in
 *      the `awaiting_role` status so the UI can ask the user which party
 *      they are.
 *   2. {@link runAnalysis} — calls the streaming `/api/analyze/stream`
 *      endpoint with the chosen role and feeds extraction + analysis
 *      events into state as they arrive.
 *
 * SP-1.9: role labels are computed from Pass 0's `role_label` fields (with
 * heuristic fallback) and stored in `editableLabels` during
 * `awaiting_redaction`. `updatePartyLabel` lets the RedactionPreview mutate
 * them; `confirmRedaction` re-derives the final token map from the labels.
 *
 * `reset()` clears state and aborts whichever fetch is in flight.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnalyzedClause,
  AnalysisSummary,
  AnalysisProvenance,
  AnalyzeResponse,
  ContractOverview,
  AnalysisMode,
  Party,
} from "@/types";
import type { AnalysisEvent } from "@/lib/streaming-analyzer";
import { redactPatterns, redactParties, redact, rebuildScrubbed } from "@/lib/redaction";
import { rehydrateClause } from "@/lib/redaction/rehydrate-clause";
import {
  heuristicLabels,
  normalizeLabel,
  disambiguateLabels,
} from "@/lib/redaction/role-heuristics";

export interface StreamingAnalysisState {
  status:
    | "idle"
    | "analyzing_overview"
    | "awaiting_redaction"
    | "awaiting_role"
    | "analyzing"
    | "complete"
    | "error";
  overview: ContractOverview | null;
  clauses: AnalyzedClause[];
  /** Total clause count from the extraction pass (before analysis). */
  clauseCount: number | null;
  summary: AnalysisSummary | null;
  /**
   * Provenance block attached when the pipeline emits its `complete`
   * event. Null until the run finishes so the colophon footer only
   * renders once the machine identifiers are known.
   */
  provenance: AnalysisProvenance | null;
  /**
   * Full token map (pattern + party phases merged) assembled after
   * Pass 0 completes. Populated when the hook enters `awaiting_redaction`
   * and again after `confirmRedaction` (trimmed to the user's active
   * subset). Null before Pass 0 finishes or after `reset`.
   */
  tokenMap: Map<string, string> | null;
  /**
   * Raw contract text held across the redaction-preview gap so the
   * analysis phase can rebuild a scrubbed version from raw when the
   * user has toggled some tokens off in the preview.
   */
  rawText: string | null;
  /**
   * Per-party editable labels held during `awaiting_redaction`. Parallel
   * array to `overview.parties`. Seeded from `role_label ?? heuristicLabels()`
   * and disambiguated. The RedactionPreview mutates this via
   * `updatePartyLabel`; on Continue the normalized + disambiguated copy
   * is handed to redactParties.
   */
  editableLabels: string[];
  error: string | null;
}

const INITIAL_STATE: StreamingAnalysisState = {
  status: "idle",
  overview: null,
  clauses: [],
  clauseCount: null,
  summary: null,
  provenance: null,
  tokenMap: null,
  rawText: null,
  editableLabels: [],
  error: null,
};

/**
 * Streams analysis results from /api/analyze/stream and updates state
 * incrementally as each NDJSON event arrives. Overview is fetched
 * separately via /api/analyze/overview so the UI can pause between the
 * two for role selection.
 */
export function useStreamingAnalysis() {
  const [state, setState] = useState<StreamingAnalysisState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  // Mirrored here so runAnalysis can read the overview without depending
  // on stale closure state from the last render.
  const overviewRef = useRef<ContractOverview | null>(null);
  // Synchronous mirrors updated at the call site (not via useEffect), so
  // runAnalysis can fire immediately after runOverview/confirmRedaction
  // without waiting for React to flush a render.
  const rawTextRef = useRef<string | null>(null);
  const tokenMapRef = useRef<Map<string, string> | null>(null);
  // Tracks the latest state snapshot so confirmRedaction can read
  // editableLabels without a stale closure.
  const stateRef = useRef<StreamingAnalysisState | null>(null);

  // Keep stateRef current on every render.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** Cancel any in-flight fetch (overview or stream). */
  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  /** Reset hook state back to idle. */
  const reset = useCallback(() => {
    abort();
    overviewRef.current = null;
    rawTextRef.current = null;
    tokenMapRef.current = null;
    setState(INITIAL_STATE);
  }, [abort]);

  /**
   * Fetch the contract overview. In SP-1.9 this is a three-step flow:
   *   1. Mask PII patterns (email/phone/IBAN/VAT/national ID) locally
   *      so the server's Pass 0 call never sees raw values.
   *   2. POST the pattern-masked text to `/api/analyze/overview`.
   *   3. Take the parties returned by Pass 0, compute their role labels
   *      (from `role_label` → heuristic fallback → normalize →
   *      disambiguate), and mask them too, merging both token maps into
   *      one. Transition to `awaiting_redaction` with `editableLabels`
   *      seeded so the RedactionPreview can render editable label rows.
   *
   * Zero-detection short-circuit: if neither patterns nor parties produced
   * any tokens, the preview has nothing to show, so skip straight to
   * `awaiting_role`.
   */
  const runOverview = useCallback(
    async (
      text: string,
    ): Promise<{
      overview: ContractOverview;
      tokenMap: Map<string, string>;
    } | null> => {
      abort();
      const controller = new AbortController();
      abortRef.current = controller;

      rawTextRef.current = text;
      tokenMapRef.current = null;
      setState({
        status: "analyzing_overview",
        overview: null,
        clauses: [],
        clauseCount: null,
        summary: null,
        provenance: null,
        tokenMap: null,
        rawText: text,
        editableLabels: [],
        error: null,
      });

      // Phase 1 — mask patterns BEFORE Pass 0 so the server never sees
      // raw emails/phones/IBANs/VAT/national IDs during overview extraction.
      const patternPhase = redactPatterns(text);

      try {
        const response = await fetch("/api/analyze/overview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: patternPhase.scrubbed }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: "Overview failed" }));
          setState((prev) => ({
            ...prev,
            status: "error",
            error: err.detail ?? "Overview failed",
          }));
          return null;
        }

        const body = (await response.json()) as { overview: ContractOverview };
        overviewRef.current = body.overview;

        // SP-1.9 — compute role labels: LLM's role_label first, then
        // heuristic fill, then normalize + disambiguate.
        const heuristic = heuristicLabels(
          body.overview.contract_type,
          body.overview.parties.length,
        );
        const seeded = body.overview.parties.map((p: Party, i: number) =>
          normalizeLabel(p.role_label ?? "") || heuristic[i],
        );
        const labels = disambiguateLabels(seeded);

        const labeled = body.overview.parties.map((p: Party, i: number) => ({
          name: p.name,
          label: labels[i],
        }));

        // Phase 2 — mask the party names Pass 0 just told us about.
        const partyPhase = redactParties(patternPhase.scrubbed, labeled);
        const fullMap = new Map<string, string>();
        for (const [k, v] of patternPhase.tokenMap) fullMap.set(k, v);
        for (const [k, v] of partyPhase.tokenMap) fullMap.set(k, v);

        // No detections → no preview to show; fall through to role select.
        const nextStatus = fullMap.size === 0 ? "awaiting_role" : "awaiting_redaction";

        // Trust signal — visible in devtools so users can verify what's
        // about to be masked without reading source code.
        if (typeof console !== "undefined") {
          const byKind: Record<string, number> = {};
          for (const token of fullMap.keys()) {
            const inner = token.slice(1, -1);
            const kind = inner.split("_")[0];
            byKind[kind] = (byKind[kind] ?? 0) + 1;
          }
          console.info("[redline] redaction map", { total: fullMap.size, byKind });
        }

        tokenMapRef.current = fullMap;
        setState((prev) => ({
          ...prev,
          status: nextStatus,
          overview: body.overview,
          tokenMap: fullMap,
          editableLabels: labels,
        }));
        return { overview: body.overview, tokenMap: fullMap };
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Overview failed",
        }));
        return null;
      }
    },
    [abort],
  );

  /**
   * RedactionPreview calls this when the user edits a label. Applies
   * the same normalize + disambiguate pipeline so the live token preview
   * always shows canonical form.
   */
  const updatePartyLabel = useCallback((index: number, raw: string) => {
    setState((prev) => {
      const next = [...prev.editableLabels];
      next[index] = normalizeLabel(raw);
      return { ...prev, editableLabels: disambiguateLabels(next) };
    });
  }, []);

  /**
   * RedactionPreview confirmation. Rebuilds the scrubbed + tokenMap from
   * the final edited labels, then intersects with the user's "keep-masked"
   * subset. Empty labels are rejected here defensively (UI blocks them).
   *
   * SP-1.9: takes `disabledTokens: Set<string>` (tokens to leave visible)
   * instead of the old `activeTokens: Map<string, string>`. The hook
   * reconstructs the full map from labels + raw text, then subtracts the
   * disabled set to produce the active subset.
   */
  const confirmRedaction = useCallback((disabledTokens: Set<string>) => {
    const raw = rawTextRef.current;
    const overview = overviewRef.current;
    if (!raw || !overview) return;

    const labels = (stateRef.current?.editableLabels ?? []);
    if (labels.some((l) => !l)) {
      return; // UI prevents this path
    }
    const labeled = overview.parties.map((p: Party, i: number) => ({
      name: p.name,
      label: labels[i],
    }));
    const { tokenMap: fullMap } = redact(raw, labeled);

    const active = new Map<string, string>();
    for (const [token, original] of fullMap) {
      if (!disabledTokens.has(token)) active.set(token, original);
    }
    tokenMapRef.current = active;
    setState((prev) => ({ ...prev, status: "awaiting_role", tokenMap: active }));
  }, []);

  /**
   * Kick off the extraction + analysis stream. Expects {@link runOverview}
   * to have already populated `state.overview` (or caller to be OK with
   * no overview, e.g. retrying from an error state).
   *
   * Resolves with the final AnalyzeResponse on success or null on
   * error/abort. Overview is folded back into the response from the
   * hook's stored state so callers get a complete object.
   */
  const runAnalysis = useCallback(
    async (
      _text: string,
      mode: AnalysisMode,
      withCitations: boolean,
      userRole: string | null,
    ): Promise<AnalyzeResponse | null> => {
      // The `_text` argument is kept for API stability but no longer used —
      // SP-1.6 moved scrubbing to the client, so the hook rebuilds the
      // scrubbed payload from its own `rawText` + `tokenMap` refs. Passing
      // arbitrary text here would bypass the preview and defeat redaction.
      abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Track final results locally so we can return them (avoids stale
      // closure on React state).
      let finalSummary: AnalysisSummary | null = null;
      let finalProvenance: AnalysisProvenance | null = null;
      const finalClauses: AnalyzedClause[] = [];

      // Pulled from the ref so we don't have to depend on stale closure
      // state to fold it back into the final AnalyzeResponse below.
      const capturedOverview = overviewRef.current;
      const rawText = rawTextRef.current;
      const activeTokens = tokenMapRef.current ?? new Map<string, string>();
      // fullMap is also activeTokens here: confirmRedaction already
      // trimmed to the user's chosen active subset, so we pass it as both
      // fullMap and activeTokens to rebuildScrubbed.
      const scrubbedForAnalysis = rawText
        ? rebuildScrubbed(rawText, activeTokens, activeTokens)
        : null;

      if (!rawText || !scrubbedForAnalysis) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Missing raw text — cannot run analysis",
        }));
        return null;
      }

      setState((prev) => ({
        ...prev,
        status: "analyzing",
        clauses: [],
        clauseCount: null,
        summary: null,
        error: null,
      }));

      try {
        // Pull clause inventory from the overview pass so extraction is
        // anchored to the specific clauses identified in Pass 0.
        const clauseInventory = overviewRef.current?.clause_inventory ?? [];
        // Governing jurisdiction from Pass 0 — forwarded to the stream
        // endpoint so jurisdiction-aware analysis rules can be applied.
        const jurisdiction = overviewRef.current?.governing_jurisdiction ?? null;

        const response = await fetch("/api/analyze/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: scrubbedForAnalysis,
            mode,
            with_citations: withCitations,
            user_role: userRole,
            clause_inventory: clauseInventory,
            jurisdiction,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: "Analysis failed" }));
          setState((prev) => ({
            ...prev,
            status: "error",
            error: err.detail ?? "Analysis failed",
          }));
          return null;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop()!; // keep incomplete trailing line

          for (const line of lines) {
            if (!line.trim()) continue;
            const event: AnalysisEvent = JSON.parse(line);

            switch (event.type) {
              case "extraction-complete":
                setState((prev) => ({ ...prev, clauseCount: event.data.clauseCount }));
                break;
              case "clause": {
                // Server emits clauses with `⟦KIND_N⟧` tokens still in
                // every user-facing string field. Rehydrate against the
                // user's active subset — disabled tokens stay verbatim
                // (their real values are already woven into the
                // `scrubbedForAnalysis` text the server was given) so
                // the UI displays real names/emails where the user
                // wanted them and keeps `⟦…⟧` tokens where they opted
                // to stay redacted.
                const rehydrated = rehydrateClause(event.data, activeTokens);
                finalClauses.push(rehydrated);
                setState((prev) => ({ ...prev, clauses: [...prev.clauses, rehydrated] }));
                break;
              }
              case "complete": {
                // Split provenance off the event payload before storing
                // the summary — `AnalysisSummary` has no provenance field
                // and React state stays cleaner without a superset shape.
                const { provenance, ...summaryOnly } = event.data;
                finalSummary = summaryOnly;
                finalProvenance = provenance;
                setState((prev) => ({
                  ...prev,
                  status: "complete",
                  summary: summaryOnly,
                  provenance,
                }));
                break;
              }
              case "error":
                setState((prev) => ({ ...prev, status: "error", error: event.data.message }));
                return null;
            }
          }
        }

        if (capturedOverview && finalSummary && finalProvenance) {
          return {
            overview: capturedOverview,
            summary: finalSummary,
            clauses: finalClauses,
            provenance: finalProvenance,
          };
        }
        return null;
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Analysis failed",
        }));
        return null;
      }
    },
    [abort],
  );

  return {
    state,
    runOverview,
    confirmRedaction,
    updatePartyLabel,
    runAnalysis,
    reset,
    abort,
    // Spread state so consumers can destructure fields directly (existing API).
    ...state,
  };
}
