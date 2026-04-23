/**
 * SP-10 Arc 1/2 — retrievers-under-test for the eval harness.
 *
 * Three retrievers ship here, all wrapping the production
 * `hybridRetrieve` from `@/lib/retrieval/hybrid` so the eval always
 * exercises the same code the chat route runs. Differences are
 * isolated to which composition knobs get flipped:
 *
 *   - `bm25Retriever` (Arc 1): BM25-only. `queryEmbedding: null`,
 *     `metadataBoost: false`.
 *   - `makeHybridRetriever` (Arc 1): BM25 + cosine via RRF, metadata
 *     boost disabled. Measures the pure-fusion floor.
 *   - `makeHybridMetadataRetriever` (Arc 2): fusion + metadata boost.
 *     Ablation against the `hybrid` row in `baseline.json` shows Task
 *     2.1's isolated lift.
 *   - `makeHybridGraphRetriever` (Arc 2 Task 2.2b): fusion + metadata
 *     boost + cross-ref graph + definitions widening. Ablation against
 *     `hybrid_metadata` isolates the Task 2.2 contribution.
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
    metadataBoost: false,
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
      metadataBoost: false,
    });
    return { indices: ranking.map((r) => r.id) };
  };
}

/**
 * Arc 2 retriever — hybrid + metadata boost. Same cache contract as
 * {@link makeHybridRetriever} (deterministic in CI, degrades to BM25
 * when a question has no cached query embedding). Ablation vs `hybrid`
 * isolates the Task 2.1 contribution; ablation vs `bm25` gives the
 * cumulative lift of everything Arc 1 + 2 added on top of keyword.
 */
export function makeHybridMetadataRetriever(
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
      metadataBoost: true,
    });
    return { indices: ranking.map((r) => r.id) };
  };
}

/**
 * Arc 2 Task 2.2b retriever — hybrid + metadata boost + cross-ref
 * graph + definitions widening. Matches the production chat context
 * builder's full feature set. Ablation vs `hybrid_metadata` isolates
 * the Task 2.2 contribution; ablation vs `bm25` gives the cumulative
 * lift of everything Arc 1 + all Arc 2 layers added so far.
 */
export function makeHybridGraphRetriever(
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
      metadataBoost: true,
      clauses: fixture.clauses,
      graphWidening: true,
    });
    return { indices: ranking.map((r) => r.id) };
  };
}
