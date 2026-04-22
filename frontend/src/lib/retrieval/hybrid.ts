/**
 * SP-10 Arc 1 Phase 3 — hybrid BM25 ∥ cosine retriever composed via RRF.
 *
 * One call site: the chat endpoint's context builder. Input is a query
 * string + optional query embedding + the per-clause candidates. Output
 * is a ranked list of clause ids with fused scores, truncated to
 * `topN` (default 5, matches the legacy keyword-overlap ceiling).
 *
 * Degradation policy — hybrid must *always* return something useful:
 *   - No query embedding (embed-query failed, or caller deliberately
 *     skipped) → BM25-only. We log the disablement for diagnostics.
 *   - No candidate has an embedding (legacy saved row pre-SP-10) →
 *     BM25-only. Same log.
 *   - Partial embedding coverage → vector branch runs over the subset
 *     that has embeddings; BM25 still sees the full corpus. RRF
 *     tolerates the asymmetry by design (missing from a branch = rank
 *     infinity = zero contribution).
 *   - Empty corpus → empty result.
 *
 * The per-branch top-K cap (`PER_BRANCH_TOP_K = 20`) mirrors the spec's
 * retrieval pipeline. Keeps fusion cheap and prevents noisy tails from
 * one branch dragging down precision in the fused list.
 */

import type { AnalyzedClause, ClauseEmbedding } from "@/types";
import { bm25Rank } from "./bm25";
import { vectorRank } from "./vector";
import { reciprocalRankFusion } from "./fusion";
import { logPass } from "@/lib/llm/debug-log";

const DEFAULT_TOP_N = 5;
const PER_BRANCH_TOP_K = 20;

/**
 * One candidate doc for the hybrid retriever.
 *
 * `embedding` is optional so callers can mix indexed and non-indexed
 * docs in one corpus (legacy rows, freshly-added clauses whose embed
 * job is still pending, etc.).
 */
export interface HybridCandidate {
  id: number;
  text: string;
  embedding?: number[];
}

/** Input shape for {@link hybridRetrieve}. */
export interface HybridRetrieveInput {
  query: string;
  /** Embedding of `query`. Pass `null` to force BM25-only mode. */
  queryEmbedding: number[] | null;
  candidates: HybridCandidate[];
  /** Max fused results to return. Defaults to 5. */
  topN?: number;
}

/** A fused ranked entry — clause id plus the raw RRF score for debugging. */
export interface HybridResult {
  id: number;
  score: number;
}

/**
 * Run the hybrid retriever and return fused top-N clause ids.
 *
 * Safe against every partial-data failure mode listed in the module
 * header. Never throws on the happy path; a throw here indicates a
 * programmer error in a dependency (e.g. cosine dim mismatch on
 * matched embeddings) and should surface loudly rather than be caught.
 */
export async function hybridRetrieve(
  input: HybridRetrieveInput,
): Promise<HybridResult[]> {
  const { query, queryEmbedding, candidates, topN = DEFAULT_TOP_N } = input;

  if (candidates.length === 0) return [];

  const bm25 = bm25Rank(
    query,
    candidates.map((c) => ({ id: c.id, text: c.text })),
  );
  const bm25Order = bm25
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_BRANCH_TOP_K)
    .map((r) => r.id);

  const vectorCandidates = queryEmbedding
    ? candidates.filter(
        (c): c is HybridCandidate & { embedding: number[] } =>
          Array.isArray(c.embedding) && c.embedding.length > 0,
      )
    : [];

  let vectorOrder: number[] = [];
  if (queryEmbedding && vectorCandidates.length > 0) {
    const vec = vectorRank(
      queryEmbedding,
      vectorCandidates.map((c) => ({ id: c.id, embedding: c.embedding })),
    );
    vectorOrder = vec.slice(0, PER_BRANCH_TOP_K).map((r) => r.id);
  } else {
    logPass("chat_retrieval", {
      event: "vector_branch_disabled",
      reason:
        queryEmbedding == null
          ? "no_query_embedding"
          : "no_candidate_embeddings",
      candidates: candidates.length,
    });
  }

  const fused = reciprocalRankFusion(
    vectorOrder.length > 0 ? [bm25Order, vectorOrder] : [bm25Order],
  );

  logPass("chat_retrieval", {
    event: "hybrid_ok",
    bm25_hits: bm25Order.length,
    vector_hits: vectorOrder.length,
    fused: fused.length,
  });

  return fused.slice(0, topN);
}

/**
 * Build hybrid candidates from an analysis' clause list and any
 * attached embeddings. Positional alignment is enforced via
 * `clause_index` — embeddings with an out-of-range index are silently
 * dropped (they can only come from a drift between the saved clause
 * list and the saved embedding list, and we'd rather degrade to BM25
 * for those than throw mid-request).
 */
export function buildHybridCandidates(
  clauses: AnalyzedClause[],
  embeddings: ClauseEmbedding[] | null | undefined,
): HybridCandidate[] {
  const byIndex = new Map<number, number[]>();
  if (embeddings) {
    for (const e of embeddings) {
      if (
        typeof e.clause_index === "number" &&
        e.clause_index >= 0 &&
        e.clause_index < clauses.length
      ) {
        byIndex.set(e.clause_index, e.embedding);
      }
    }
  }

  return clauses.map((c, i) => {
    const text = [c.title, c.plain_english, c.clause_text]
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .join("\n\n");
    const emb = byIndex.get(i);
    return emb ? { id: i, text, embedding: emb } : { id: i, text };
  });
}
