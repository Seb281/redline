/**
 * SP-10 Arc 2 Task 2.1 — additive metadata boost on fused RRF scores.
 *
 * Contract-aware reranking layer between RRF fusion and top-N slice.
 * Two additive terms, applied at most once each per candidate:
 *
 *   - `CATEGORY_BOOST` when a candidate's `category` matches a category
 *     hinted at by the query.
 *   - `STATUTE_BOOST` when any of a candidate's cited statute codes
 *     (`applicable_law.citations[i].code`) matches a code hinted at by
 *     the query.
 *
 * Magnitudes are deliberately below RRF@rank-1 (~0.0164). Metadata can
 * promote a near-miss past a boundary it would otherwise lose — it
 * cannot override two retrievers agreeing a doc is irrelevant (high
 * RRF gap wins). Tuning hook: magnitudes live as module-local
 * constants; change them here and re-pin the `hybrid_metadata` row in
 * `src/eval/baseline.json` in the same PR.
 */

import type { ClauseCategory } from "@/types";
import type { StatuteCode } from "@/lib/applicable-law";
import type { FusedResult } from "./fusion";
import type { QueryHints } from "./query-analysis";

/** Per-candidate metadata used by the boost function. */
export interface CandidateMetadata {
  /** Clause category as emitted by Pass 2. */
  category: ClauseCategory;
  /** Catalog codes the clause's applicable_law cites (may be empty). */
  statuteCodes: readonly StatuteCode[];
}

/** Additive boost applied once per candidate on a category match. */
export const CATEGORY_BOOST = 0;
/** Additive boost applied once per candidate on any statute-code match. */
export const STATUTE_BOOST = 0.01;

/**
 * Apply additive metadata boosts to a fused ranking and return a new
 * array sorted by the updated score. Input is not mutated. Candidates
 * without metadata are treated as un-boostable (score passes through).
 *
 * Empty hints short-circuit to an identity operation — the function is
 * safe to call unconditionally on every retrieval.
 */
export function applyMetadataBoost(
  fused: readonly FusedResult[],
  metadata: ReadonlyMap<number, CandidateMetadata>,
  hints: QueryHints,
): FusedResult[] {
  const hasCategoryHints = hints.categories.size > 0;
  const hasStatuteHints = hints.statuteCodes.size > 0;

  if (!hasCategoryHints && !hasStatuteHints) {
    return fused.map((r) => ({ ...r }));
  }

  const boosted: FusedResult[] = fused.map((r) => {
    const meta = metadata.get(r.id);
    if (!meta) return { ...r };

    let delta = 0;
    if (hasCategoryHints && hints.categories.has(meta.category)) {
      delta += CATEGORY_BOOST;
    }
    if (hasStatuteHints) {
      for (const code of meta.statuteCodes) {
        if (hints.statuteCodes.has(code)) {
          delta += STATUTE_BOOST;
          break; // at most one statute-boost per candidate
        }
      }
    }

    return { id: r.id, score: r.score + delta };
  });

  boosted.sort((a, b) => b.score - a.score);
  return boosted;
}
