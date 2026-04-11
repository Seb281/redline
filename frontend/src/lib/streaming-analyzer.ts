/**
 * Streaming version of the LLM analysis pipeline.
 *
 * Split into two entry points so the UI can pause between the overview
 * pass and the rest of the pipeline — that lets the user declare which
 * party they are before risk analysis runs.
 *
 *   1. {@link generateOverview} — runs Pass 0 as a single non-streaming
 *      call, returns the overview. Fast, used by `/api/analyze/overview`.
 *   2. {@link streamExtractAndAnalyze} — runs Pass 1 + Pass 2, streaming
 *      results as NDJSON events. Used by `/api/analyze/stream`.
 */

import { generateObject, Output, streamText } from "ai";
import type { ContractOverview, AnalyzedClause, AnalysisSummary } from "@/types";
import {
  model,
  contractOverviewSchema,
  extractionResultSchema,
  analyzedClauseSchema,
  OVERVIEW_SYSTEM_PROMPT,
  EXTRACTION_SYSTEM_PROMPT,
  buildAnalysisSystemPrompt,
} from "@/lib/analyzer";

/** Events emitted over the NDJSON stream (extraction + analysis only). */
export type AnalysisEvent =
  | { type: "extraction-complete"; data: { clauseCount: number } }
  | { type: "clause"; data: AnalyzedClause }
  | { type: "complete"; data: AnalysisSummary }
  | { type: "error"; data: { message: string } };

/** Encode an event as an NDJSON line (UTF-8). */
const encoder = new TextEncoder();
function encode(event: AnalysisEvent): Uint8Array {
  return encoder.encode(JSON.stringify(event) + "\n");
}

/**
 * Run Pass 0 only — extract the high-level contract overview.
 *
 * This is kept as a standalone function (rather than part of the stream)
 * so the client can fetch it, show the user the extracted parties, and
 * only then kick off the slower analysis stream with a declared role.
 */
export async function generateOverview(text: string): Promise<ContractOverview> {
  const { object } = await generateObject({
    model,
    schema: contractOverviewSchema,
    system: OVERVIEW_SYSTEM_PROMPT,
    prompt: `Extract the high-level overview from this contract:\n\n${text}`,
  });
  return object as ContractOverview;
}

/**
 * Run Pass 1 (clause extraction) and Pass 2 (risk analysis), streaming
 * results back as NDJSON.
 *
 * Pass 2 has two modes:
 *   - Batch: uses streamText + Output.array to emit elements as they complete
 *   - Fan-out (thinkHard): fires one generateObject per clause in parallel,
 *     pushing each result to the stream as it resolves
 *
 * @param userRole When set, analysis is framed from that party's perspective.
 *   Threaded into the analysis system prompt via buildAnalysisSystemPrompt.
 */
export function streamExtractAndAnalyze(
  text: string,
  thinkHard: boolean,
  withCitations: boolean = true,
  userRole?: string | null,
): ReadableStream<Uint8Array> {
  const analysisSystemPrompt = buildAnalysisSystemPrompt(withCitations, userRole);
  return new ReadableStream({
    async start(controller) {
      try {
        // Pass 1 — extract clauses
        const { object: extraction } = await generateObject({
          model,
          schema: extractionResultSchema,
          system: EXTRACTION_SYSTEM_PROMPT,
          prompt: `Extract all significant clauses from this contract:\n\n${text}`,
        });
        controller.enqueue(
          encode({ type: "extraction-complete", data: { clauseCount: extraction.clauses.length } })
        );

        // Pass 2 — analyze clauses
        let allClauses: AnalyzedClause[];

        if (thinkHard) {
          // Fan-out: one LLM call per clause, stream each as it resolves
          const results: AnalyzedClause[] = [];
          const promises = extraction.clauses.map(async (clause) => {
            const { object } = await generateObject({
              model,
              schema: analyzedClauseSchema,
              system: analysisSystemPrompt,
              prompt: `Analyze this contract clause:\n\n${JSON.stringify(clause, null, 2)}`,
            });
            const analyzed = object as AnalyzedClause;
            results.push(analyzed);
            controller.enqueue(encode({ type: "clause", data: analyzed }));
            return analyzed;
          });
          allClauses = await Promise.all(promises);
        } else {
          // Batch: stream elements from a single LLM call via Output.array
          allClauses = [];
          const result = streamText({
            model,
            output: Output.array({ element: analyzedClauseSchema }),
            system: analysisSystemPrompt,
            prompt: `Analyze all of the following contract clauses:\n\n${JSON.stringify(extraction.clauses, null, 2)}`,
          });
          for await (const clause of result.elementStream) {
            const analyzed = clause as AnalyzedClause;
            allClauses.push(analyzed);
            controller.enqueue(encode({ type: "clause", data: analyzed }));
          }
        }

        // Build and emit summary
        const summary: AnalysisSummary = {
          total_clauses: allClauses.length,
          risk_breakdown: {
            high: allClauses.filter((c) => c.risk_level === "high").length,
            medium: allClauses.filter((c) => c.risk_level === "medium").length,
            low: allClauses.filter((c) => c.risk_level === "low").length,
          },
          top_risks: allClauses
            .filter((c) => c.risk_level === "high")
            .map((c) => `${c.title}: ${c.risk_explanation}`),
        };
        controller.enqueue(encode({ type: "complete", data: summary }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        controller.enqueue(encode({ type: "error", data: { message } }));
      } finally {
        controller.close();
      }
    },
  });
}
