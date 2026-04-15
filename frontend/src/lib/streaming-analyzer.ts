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
import type {
  ContractOverview,
  AnalyzedClause,
  AnalysisSummary,
  AnalysisMode,
  AnalysisProvenance,
} from "@/types";
import { getProvider, type LLMProvider } from "@/lib/llm/provider";
import {
  contractOverviewSchema,
  extractionResultSchema,
  analyzedClauseSchema,
  OVERVIEW_SYSTEM_PROMPT,
  EXTRACTION_SYSTEM_PROMPT,
  buildAnalysisSystemPrompt,
  buildExtractionPrompt,
  buildProvenance,
  buildRiskBreakdown,
} from "@/lib/analyzer";
import { redact, rehydrate } from "@/lib/redaction";

/**
 * Events emitted over the NDJSON stream (extraction + analysis only).
 *
 * `complete` carries the assembled `AnalysisProvenance` block so the
 * client can persist it alongside the saved analysis without needing
 * a second round-trip. Provenance timestamp is stamped at the moment
 * the final summary is built — not at request start — so the saved
 * record reflects when analysis actually finished.
 */
export type AnalysisEvent =
  | { type: "extraction-complete"; data: { clauseCount: number } }
  | { type: "clause"; data: AnalyzedClause }
  | { type: "complete"; data: AnalysisSummary & { provenance: AnalysisProvenance } }
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
export async function generateOverview(
  text: string,
  provider: LLMProvider = getProvider(),
): Promise<ContractOverview> {
  const { object } = await generateObject({
    model: provider.model("low"),
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
 *   - Batch (fast): uses streamText + Output.array to emit elements as they complete
 *   - Fan-out (deep): fires one generateObject per clause in parallel,
 *     pushing each result to the stream as it resolves
 *
 * @param clauseInventory Clause titles + section refs from the overview pass.
 *   Anchors extraction to a specific set of clauses for consistency.
 * @param userRole When set, analysis is framed from that party's perspective.
 *   Threaded into the analysis system prompt via buildAnalysisSystemPrompt.
 */
export function streamExtractAndAnalyze(
  text: string,
  mode: AnalysisMode,
  withCitations: boolean = true,
  clauseInventory: { title: string; section_ref: string | null }[],
  userRole?: string | null,
  jurisdiction?: string | null,
  parties: string[] = [],
  provider: LLMProvider = getProvider(),
): ReadableStream<Uint8Array> {
  const analysisSystemPrompt = buildAnalysisSystemPrompt(withCitations, userRole, jurisdiction);
  // Scrub party names + common PII (emails, phone numbers, IBANs, …)
  // out of the contract text before it reaches extraction + analysis.
  // The token map is kept in closure scope so Pass 1 / Pass 2 outputs
  // can be rehydrated on the way back to the client — the UI always
  // sees the real names, the LLM only sees `⟦PARTY_A⟧`-style tokens.
  const { scrubbed, tokenMap } = redact(text, parties);

  return new ReadableStream({
    async start(controller) {
      try {
        // Pass 1 — extract clauses guided by inventory from overview.
        // Runs on SCRUBBED text; clause_text comes back with tokens in
        // place (we rehydrate at emit time for Pass 2 to re-scrub).
        const { object: extraction } = await generateObject({
          model: provider.model("medium"),
          schema: extractionResultSchema,
          system: EXTRACTION_SYSTEM_PROMPT,
          prompt: buildExtractionPrompt(scrubbed, clauseInventory),
        });
        controller.enqueue(
          encode({ type: "extraction-complete", data: { clauseCount: extraction.clauses.length } })
        );

        // Pass 2 — analyze clauses. We pass the SCRUBBED extraction
        // into the LLM, then rehydrate each analyzed clause before
        // emitting it to the UI. Streamed partials only get rehydrated
        // once the SDK delivers a complete object — rehydrating
        // mid-token would mangle the scrubbed token delimiters.
        let allClauses: AnalyzedClause[];

        if (mode === "deep") {
          // Fan-out: one LLM call per clause, stream each as it resolves
          const results: AnalyzedClause[] = [];
          const promises = extraction.clauses.map(async (clause) => {
            const { object } = await generateObject({
              model: provider.model("high"),
              schema: analyzedClauseSchema,
              system: analysisSystemPrompt,
              prompt: `Analyze this contract clause:\n\n${JSON.stringify(clause, null, 2)}`,
            });
            const analyzed = rehydrateClause(object as AnalyzedClause, tokenMap);
            results.push(analyzed);
            controller.enqueue(encode({ type: "clause", data: analyzed }));
            return analyzed;
          });
          allClauses = await Promise.all(promises);
        } else {
          // Batch: stream elements from a single LLM call via Output.array
          allClauses = [];
          const result = streamText({
            model: provider.model("high"),
            output: Output.array({ element: analyzedClauseSchema }),
            system: analysisSystemPrompt,
            prompt: `Analyze all of the following contract clauses:\n\n${JSON.stringify(extraction.clauses, null, 2)}`,
          });
          for await (const clause of result.elementStream) {
            const analyzed = rehydrateClause(clause as AnalyzedClause, tokenMap);
            allClauses.push(analyzed);
            controller.enqueue(encode({ type: "clause", data: analyzed }));
          }
        }

        // Build and emit summary
        const summary: AnalysisSummary = {
          total_clauses: allClauses.length,
          risk_breakdown: buildRiskBreakdown(allClauses),
          top_risks: allClauses
            .filter((c) => c.risk_level === "high")
            .map((c) => `${c.title}: ${c.risk_explanation}`),
        };
        controller.enqueue(
          encode({
            type: "complete",
            data: { ...summary, provenance: buildProvenance(provider) },
          }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        controller.enqueue(encode({ type: "error", data: { message } }));
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Rehydrate every user-facing string field on an analyzed clause so the
 * UI sees the real party names instead of `⟦PARTY_A⟧`-style tokens.
 *
 * Only operates on *complete* clause objects — streamed partials from
 * `elementStream` are delivered as whole objects by the AI SDK, so we
 * never rehydrate a half-formed token. Fields not present in `tokenMap`
 * are left as-is (defensive: if the LLM leaks a stray token past what
 * the scrubber registered, it is preserved verbatim rather than throwing).
 */
export function rehydrateClause(
  c: AnalyzedClause,
  tokenMap: Map<string, string>,
): AnalyzedClause {
  return {
    ...c,
    clause_text: rehydrate(c.clause_text, tokenMap),
    title: rehydrate(c.title, tokenMap),
    plain_english: rehydrate(c.plain_english, tokenMap),
    risk_explanation: rehydrate(c.risk_explanation, tokenMap),
    negotiation_suggestion: c.negotiation_suggestion
      ? rehydrate(c.negotiation_suggestion, tokenMap)
      : null,
    unusual_explanation: c.unusual_explanation
      ? rehydrate(c.unusual_explanation, tokenMap)
      : null,
    jurisdiction_note: c.jurisdiction_note
      ? rehydrate(c.jurisdiction_note, tokenMap)
      : null,
    citations: c.citations?.map((cit) => ({
      ...cit,
      quoted_text: rehydrate(cit.quoted_text, tokenMap),
    })),
  };
}
