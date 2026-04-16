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
  capInventory,
  contractOverviewSchema,
  extractionResultSchema,
  analyzedClauseSchema,
  OVERVIEW_SEED,
  OVERVIEW_SYSTEM_PROMPT,
  EXTRACTION_SYSTEM_PROMPT,
  buildAnalysisSystemPrompt,
  buildExtractionPrompt,
  buildProvenance,
  buildRiskBreakdown,
  shouldRetryPass2,
} from "@/lib/analyzer";
import { logPass } from "@/lib/llm/debug-log";

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
  const start = Date.now();
  // temperature=0 + fixed seed pin the output as tightly as the provider
  // allows — see analyzer.ts `analyzeContract` Pass 0 for context. Without
  // this, inventory count drifted 24→46 on identical input and collapsed
  // the downstream Pass 2 batch analysis.
  const { object } = await generateObject({
    model: provider.model("low"),
    schema: contractOverviewSchema,
    system: OVERVIEW_SYSTEM_PROMPT,
    prompt: `Extract the high-level overview from this contract:\n\n${text}`,
    temperature: 0,
    seed: OVERVIEW_SEED,
  });
  const raw = object as ContractOverview;
  const { inventory: cappedInventory, capped, originalCount } = capInventory(
    raw.clause_inventory,
    text.length,
  );
  const overview: ContractOverview = { ...raw, clause_inventory: cappedInventory };
  logPass("overview", {
    ms: Date.now() - start,
    partyCount: overview.parties.length,
    inventoryCount: overview.clause_inventory.length,
    jurisdiction: overview.governing_jurisdiction ?? "null",
    capped,
    rawCount: originalCount,
    rawLen: text.length,
  });
  return overview;
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
  provider: LLMProvider = getProvider(),
): ReadableStream<Uint8Array> {
  const analysisSystemPrompt = buildAnalysisSystemPrompt(withCitations, userRole, jurisdiction);
  // SP-1.6: redaction moved to the client. `text` arrives already
  // scrubbed — ⟦PARTY_A⟧, ⟦EMAIL_1⟧, … tokens in place of real PII.
  // The server never sees the tokenMap, never rehydrates. Streamed
  // clauses flow through as-is; the hook calls rehydrateClause in the
  // browser before handing them to the UI.

  return new ReadableStream({
    async start(controller) {
      try {
        // Pass 1 — extract clauses guided by inventory from overview.
        const pass1Start = Date.now();
        const { object: extraction } = await generateObject({
          model: provider.model("medium"),
          schema: extractionResultSchema,
          system: EXTRACTION_SYSTEM_PROMPT,
          prompt: buildExtractionPrompt(text, clauseInventory),
        });
        logPass("extraction", {
          ms: Date.now() - pass1Start,
          expected: clauseInventory.length,
          returned: extraction.clauses.length,
        });
        controller.enqueue(
          encode({ type: "extraction-complete", data: { clauseCount: extraction.clauses.length } })
        );

        // Pass 2 — analyze clauses. Input is already scrubbed; the
        // client rehydrates complete clause objects when they arrive.
        const pass2Start = Date.now();
        let allClauses: AnalyzedClause[];
        let pass2Retried = false;

        if (mode === "deep") {
          // Fan-out: one LLM call per clause, stream each as it resolves.
          const promises = extraction.clauses.map(async (clause) => {
            const { object } = await generateObject({
              model: provider.model("high"),
              schema: analyzedClauseSchema,
              system: analysisSystemPrompt,
              prompt: `Analyze this contract clause:\n\n${JSON.stringify(clause, null, 2)}`,
            });
            const analyzed = object as AnalyzedClause;
            controller.enqueue(encode({ type: "clause", data: analyzed }));
            return analyzed;
          });
          allClauses = await Promise.all(promises);
        } else {
          // Batch: stream elements from a single LLM call via Output.array.
          // If the first attempt returns fewer than half the expected
          // clauses, fire a second streamText call on the same HTTP stream
          // and continue emitting. Dedupe is ONLY active during the retry
          // pass — on the first attempt every clause is emitted as-is so
          // a contract with legitimately repeated titles (e.g. two
          // "Confidentiality" clauses) isn't silently deduplicated into a
          // spurious collapse.
          allClauses = [];
          const emittedTitles = new Set<string>();
          const runBatchStream = async (isRetry: boolean) => {
            const result = streamText({
              model: provider.model("high"),
              output: Output.array({ element: analyzedClauseSchema }),
              system: analysisSystemPrompt,
              prompt: `Analyze all of the following contract clauses:\n\n${JSON.stringify(extraction.clauses, null, 2)}`,
            });
            for await (const clause of result.elementStream) {
              const analyzed = clause as AnalyzedClause;
              if (isRetry && emittedTitles.has(analyzed.title)) continue;
              emittedTitles.add(analyzed.title);
              allClauses.push(analyzed);
              controller.enqueue(encode({ type: "clause", data: analyzed }));
            }
          };
          await runBatchStream(false);
          // Retry is opt-out via PASS2_RETRY_ENABLED=false. Worst case on a
          // collapsed first attempt is 2x Pass 2 latency and LLM cost —
          // acceptable for the rare collapse path, but prod operators can
          // disable it if a provider incident is causing every call to
          // short-return and they don't want to pay 2x during an outage.
          const retryEnabled = process.env.PASS2_RETRY_ENABLED !== "false";
          const didRetry =
            retryEnabled &&
            shouldRetryPass2(allClauses.length, extraction.clauses.length);
          if (didRetry) {
            logPass("pass2", {
              retried: true,
              attempt: 1,
              streamed: allClauses.length,
              expected: extraction.clauses.length,
            });
            await runBatchStream(true);
          }
          pass2Retried = didRetry;
        }

        const pass2Histogram = buildRiskBreakdown(allClauses);
        logPass("pass2", {
          ms: Date.now() - pass2Start,
          mode,
          streamed: allClauses.length,
          high: pass2Histogram.high,
          medium: pass2Histogram.medium,
          low: pass2Histogram.low,
          informational: pass2Histogram.informational,
          retried: pass2Retried,
        });

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

