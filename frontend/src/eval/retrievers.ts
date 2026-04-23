/**
 * SP-10 Arc 1 Phase 4b — retrievers-under-test for the eval harness.
 *
 * Two retrievers ship here, both wrapping the production `hybridRetrieve`
 * from `@/lib/retrieval/hybrid` so the eval always exercises the same
 * code the chat route runs. Differences are isolated to what gets fed
 * in — embeddings or not.
 *
 *   - `bm25Retriever`: passes `queryEmbedding: null` and strips clause
 *     embeddings. Forces the hybrid pipeline into BM25-only mode.
 *     Deterministic, zero external deps, safe to run in CI.
 *   - `hybridRetriever`: passes both query and clause embeddings
 *     through to the full RRF fusion path. Requires a cached map of
 *     `{questionId → queryEmbedding}` so CI can run without a live
 *     Mistral key. Degrades cleanly to BM25 for any question the cache
 *     is missing — matches the production degradation policy.
 */

import type { AnalyzeResponse } from "@/types";
import { buildHybridCandidates, hybridRetrieve } from "@/lib/retrieval/hybrid";
import type { GoldenQuestion } from "./golden-questions";
import type { RetrieverFn } from "./harness";

/**
 * How many top entries the retriever surfaces. Set above the largest
 * recall-k (5) so the harness can compute MRR at full ranking depth
 * without the top-N cap hiding later hits.
 */
const HARNESS_TOP_N = 20;

/**
 * BM25-only retriever — the SP-1 keyword baseline. Kept as the
 * reference point every subsequent layer (vector, rerank, metadata,
 * cross-refs) must beat by at least one point on `recall@5`.
 */
export const bm25Retriever: RetrieverFn = async (q, fixture) => {
  const candidates = buildHybridCandidates(fixture.clauses, undefined);
  const ranking = await hybridRetrieve({
    query: q.question,
    queryEmbedding: null,
    candidates,
    topN: HARNESS_TOP_N,
  });
  return { indices: ranking.map((r) => r.id) };
};

/**
 * Factory for the hybrid retriever — closed over a query-embedding
 * cache so the harness stays deterministic in CI. Missing entries fall
 * through to BM25 automatically via `hybridRetrieve`.
 */
export function makeHybridRetriever(
  queryEmbeddings: ReadonlyMap<string, readonly number[]>,
): RetrieverFn {
  return async (q: GoldenQuestion, fixture: AnalyzeResponse) => {
    const candidates = buildHybridCandidates(
      fixture.clauses,
      fixture.clause_embeddings,
    );
    const cached = queryEmbeddings.get(q.id);
    const queryEmbedding = cached ? Array.from(cached) : null;
    const ranking = await hybridRetrieve({
      query: q.question,
      queryEmbedding,
      candidates,
      topN: HARNESS_TOP_N,
    });
    return { indices: ranking.map((r) => r.id) };
  };
}
