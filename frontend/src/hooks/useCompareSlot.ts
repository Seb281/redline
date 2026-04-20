/**
 * Per-slot orchestrator for the compare page.
 *
 * Handles every path by which a compare slot can be filled:
 *   1. Sample-contract lazy-analyze — runs the non-streaming
 *      `/api/analyze` route once per (sample, analysisLocale) pair and
 *      caches the result in `sessionStorage`. Subsequent picks of the
 *      same sample reuse the cache and return instantly.
 *   2. Saved-analysis load — fetches a `SavedAnalysis` via the backend
 *      API and unwraps it into the `AnalyzeResponse` shape the slot
 *      needs.
 *   3. Carry-over — the caller passes an already-analysed response
 *      straight in (e.g. from ReportView handoff).
 *
 * The hook exposes only its loader functions plus the current `slot`
 * value; the parent page owns the side-by-side state and decides when
 * both slots are ready to compute the comparison.
 */

"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useAnalysisLocale } from "@/contexts/AnalysisLocaleContext";
import { analyzeContract, getAnalysis } from "@/lib/api";
import {
  getCachedSample,
  setCachedSample,
} from "@/lib/compare/session";
import type { SampleEntry } from "@/lib/compare/samples";
import type { CompareSlot } from "@/lib/compare/types";
import type { AnalyzeResponse } from "@/types";

/**
 * Loader helpers returned by the hook. All loaders are `async` — the
 * caller awaits the promise if it wants to know when the slot flips to
 * `ready`, or just fires and relies on the returned `slot` state.
 */
export interface UseCompareSlotReturn {
  slot: CompareSlot;
  /** Reset the slot to empty (UI "remove contract" action). */
  clear: () => void;
  /** Load a sample contract, lazy-analyzing the first time per locale. */
  loadSample: (sample: SampleEntry, label: string) => Promise<void>;
  /** Load a saved analysis by id from the backend. */
  loadSavedAnalysis: (id: string, label: string) => Promise<void>;
  /** Plant an already-analysed response in the slot (carry-over / upload). */
  setReady: (data: AnalyzeResponse, label: string) => void;
}

/** Owns one slot's lifecycle; sibling slots each get their own instance. */
export function useCompareSlot(): UseCompareSlotReturn {
  const [slot, setSlot] = useState<CompareSlot>({ status: "empty" });
  // Same locale value the streaming pipeline would send; falls back to
  // the UI locale automatically via AnalysisLocaleContext.
  const { analysisLocale } = useAnalysisLocale();
  const t = useTranslations("Compare");

  const clear = useCallback(() => {
    setSlot({ status: "empty" });
  }, []);

  const setReady = useCallback(
    (data: AnalyzeResponse, label: string) => {
      setSlot({ status: "ready", label, data });
    },
    [],
  );

  const loadSample = useCallback(
    async (sample: SampleEntry, label: string) => {
      // Cache hit → skip the pipeline call entirely.
      const cached = getCachedSample(sample.id, analysisLocale);
      if (cached) {
        setSlot({ status: "ready", label, data: cached });
        return;
      }

      setSlot({ status: "loading", label });

      try {
        // Non-streaming pipeline: one round trip, full response.
        // Samples are fictional so we skip the redaction preview and
        // role-picker gates the main upload flow imposes.
        const data = await analyzeContract(sample.text, "fast", true, null);
        setCachedSample(sample.id, analysisLocale, data);
        setSlot({ status: "ready", label, data });
      } catch (err) {
        setSlot({
          status: "error",
          label,
          message:
            err instanceof Error ? err.message : t("errors.sampleFailed"),
        });
      }
    },
    [analysisLocale, t],
  );

  const loadSavedAnalysis = useCallback(
    async (id: string, label: string) => {
      setSlot({ status: "loading", label });
      try {
        const saved = await getAnalysis(id);
        // SavedAnalysis carries the same fields as AnalyzeResponse plus
        // a few persistence-only extras — rebuild a clean AnalyzeResponse
        // so downstream code can stay AnalyzeResponse-typed.
        const data: AnalyzeResponse = {
          overview: saved.overview,
          summary: saved.summary,
          clauses: saved.clauses,
          // `provenance` is optional on SavedAnalysis for legacy rows;
          // the engine doesn't read it, only the UI does.
          provenance: saved.provenance ?? {
            provider: "unknown",
            model: "unknown",
            snapshot: "unknown",
            region: "unknown",
            reasoning_effort_per_pass: {
              overview: "medium",
              extraction: "medium",
              risk: "medium",
              think_hard: "medium",
            },
            prompt_template_version: "unknown",
            timestamp: saved.created_at,
          },
        };
        setSlot({ status: "ready", label, data, sourceId: id });
      } catch (err) {
        setSlot({
          status: "error",
          label,
          message:
            err instanceof Error ? err.message : t("errors.savedFailed"),
        });
      }
    },
    [t],
  );

  return { slot, clear, loadSample, loadSavedAnalysis, setReady };
}
