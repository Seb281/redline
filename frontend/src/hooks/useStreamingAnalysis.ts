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
 * `reset()` clears state and aborts whichever fetch is in flight.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import type {
  AnalyzedClause,
  AnalysisSummary,
  AnalysisProvenance,
  AnalyzeResponse,
  ContractOverview,
  AnalysisMode,
} from "@/types";
import type { AnalysisEvent } from "@/lib/streaming-analyzer";

export interface StreamingAnalysisState {
  status:
    | "idle"
    | "analyzing_overview"
    | "awaiting_role"
    | "analyzing"
    | "complete"
    | "error";
  overview: ContractOverview | null;
  clauses: AnalyzedClause[];
  /** Total clause count from the extraction pass (before analysis). */
  clauseCount: number | null;
  summary: AnalysisSummary | null;
  error: string | null;
}

const INITIAL_STATE: StreamingAnalysisState = {
  status: "idle",
  overview: null,
  clauses: [],
  clauseCount: null,
  summary: null,
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

  /** Cancel any in-flight fetch (overview or stream). */
  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  /** Reset hook state back to idle. */
  const reset = useCallback(() => {
    abort();
    overviewRef.current = null;
    setState(INITIAL_STATE);
  }, [abort]);

  /**
   * Fetch the contract overview. Transitions the hook through
   * `analyzing_overview` → `awaiting_role` on success. On error the
   * status becomes `error` and the overview stays null.
   */
  const runOverview = useCallback(
    async (text: string): Promise<ContractOverview | null> => {
      abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        status: "analyzing_overview",
        overview: null,
        clauses: [],
        clauseCount: null,
        summary: null,
        error: null,
      });

      try {
        const response = await fetch("/api/analyze/overview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
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
        setState((prev) => ({
          ...prev,
          status: "awaiting_role",
          overview: body.overview,
        }));
        return body.overview;
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
      text: string,
      mode: AnalysisMode,
      withCitations: boolean,
      userRole: string | null,
    ): Promise<AnalyzeResponse | null> => {
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
        // Parties from Pass 0 — the stream route uses them to scrub
        // party names out of extraction + analysis inputs. Overview
        // itself ran on raw text (that's how we got the names), so
        // sending them here is safe.
        const parties = overviewRef.current?.parties ?? [];

        const response = await fetch("/api/analyze/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            mode,
            with_citations: withCitations,
            user_role: userRole,
            clause_inventory: clauseInventory,
            jurisdiction,
            parties,
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
              case "clause":
                finalClauses.push(event.data);
                setState((prev) => ({ ...prev, clauses: [...prev.clauses, event.data] }));
                break;
              case "complete": {
                // Split provenance off the event payload before storing
                // the summary — `AnalysisSummary` has no provenance field
                // and React state stays cleaner without a superset shape.
                const { provenance, ...summaryOnly } = event.data;
                finalSummary = summaryOnly;
                finalProvenance = provenance;
                setState((prev) => ({ ...prev, status: "complete", summary: summaryOnly }));
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

  return { ...state, runOverview, runAnalysis, abort, reset };
}
