/**
 * SP-10 Arc 1 Phase 3 — Reciprocal Rank Fusion (RRF).
 *
 * Paper: Cormack, Clarke & Büttcher (2009), "Reciprocal Rank Fusion
 * outperforms Condorcet and individual Rank Learning Methods."
 *
 * The algorithm:
 *   rrf(d) = Σᵢ 1 / (k + rank_i(d))
 * where rank_i(d) is d's 1-indexed position in retriever i's result
 * list, or ∞ (contribute 0) if d is absent. k = 60 is the paper's
 * default and has held up across TREC corpora without per-dataset
 * tuning; we keep it as the default so benchmark results stay
 * comparable.
 *
 * Why RRF over weighted linear combinations:
 *   - Retrievers report on different scales (BM25 raw scores vs
 *     cosine similarity ∈ [-1, 1]). Scale-invariant rank fusion
 *     sidesteps per-retriever normalisation, which is brittle across
 *     query distributions.
 *   - Dominated by the top of each list: good docs that appear in
 *     multiple rankings (ranks 1 and 3) outscore a doc that appears
 *     only once (rank 1 alone). That matches the intuition we want
 *     for hybrid retrieval.
 */

/** Fused result for a single document. Score is non-normalised RRF. */
export interface FusedResult {
  id: number;
  score: number;
}

export interface RRFOptions {
  /** RRF smoothing constant — see Cormack 2009 (default 60). */
  k?: number;
}

/**
 * Fuse multiple ranked lists of doc ids into a single ranking.
 *
 * Each input list must already be sorted most-relevant-first; this
 * function does not re-score. Duplicate ids within a single list use
 * the first occurrence's rank (later appearances are ignored) so a
 * retriever that accidentally emits a doc twice does not inflate its
 * own contribution.
 */
export function reciprocalRankFusion(
  rankings: number[][],
  { k = 60 }: RRFOptions = {},
): FusedResult[] {
  const scores = new Map<number, number>();

  for (const ranking of rankings) {
    const seen = new Set<number>();
    for (let i = 0; i < ranking.length; i += 1) {
      const id = ranking[i];
      if (seen.has(id)) continue;
      seen.add(id);
      const rank = i + 1;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    }
  }

  const fused: FusedResult[] = Array.from(scores.entries()).map(
    ([id, score]) => ({ id, score }),
  );
  fused.sort((a, b) => b.score - a.score);
  return fused;
}
