/**
 * Hook that consumes the streaming analysis NDJSON endpoint and
 * exposes progressive state (overview, clauses, summary) as they arrive.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import type { AnalyzedClause, AnalysisSummary, AnalyzeResponse, ContractOverview } from "@/types";
import type { AnalysisEvent } from "@/lib/streaming-analyzer";

export interface StreamingAnalysisState {
  status: "idle" | "analyzing" | "complete" | "error";
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
 * incrementally as each NDJSON event arrives.
 */
export function useStreamingAnalysis() {
  const [state, setState] = useState<StreamingAnalysisState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  /** Cancel any in-flight analysis stream. */
  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  /** Reset hook state back to idle. */
  const reset = useCallback(() => {
    abort();
    setState(INITIAL_STATE);
  }, [abort]);

  /**
   * Kick off a streaming analysis. Resolves with the final AnalyzeResponse
   * on success, or null on error/abort.
   */
  const analyze = useCallback(
    async (text: string, thinkHard: boolean): Promise<AnalyzeResponse | null> => {
      abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Track final results locally so we can return them (avoids stale closure on React state)
      let finalOverview: ContractOverview | null = null;
      let finalSummary: AnalysisSummary | null = null;
      const finalClauses: AnalyzedClause[] = [];

      setState({
        status: "analyzing",
        overview: null,
        clauses: [],
        clauseCount: null,
        summary: null,
        error: null,
      });

      try {
        const response = await fetch("/api/analyze/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, think_hard: thinkHard }),
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
              case "overview":
                finalOverview = event.data;
                setState((prev) => ({ ...prev, overview: event.data }));
                break;
              case "extraction-complete":
                setState((prev) => ({ ...prev, clauseCount: event.data.clauseCount }));
                break;
              case "clause":
                finalClauses.push(event.data);
                setState((prev) => ({ ...prev, clauses: [...prev.clauses, event.data] }));
                break;
              case "complete":
                finalSummary = event.data;
                setState((prev) => ({ ...prev, status: "complete", summary: event.data }));
                break;
              case "error":
                setState((prev) => ({ ...prev, status: "error", error: event.data.message }));
                return null;
            }
          }
        }

        if (finalOverview && finalSummary) {
          return { overview: finalOverview, summary: finalSummary, clauses: finalClauses };
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
    [abort]
  );

  return { ...state, analyze, abort, reset };
}
