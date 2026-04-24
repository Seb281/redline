/**
 * SP-10 Arc 3 Task 3.3 — library-comparison query builder.
 *
 * The library panel on the saved-analysis report page asks the backend
 * "which of the user's other contracts are semantically nearest to this
 * one?". It reduces the current contract down to a single embedding-
 * friendly string: the contract type, its key terms, and the titles of
 * the top-risk clauses. That three-part anchor captures enough signal
 * to let Mistral-embed place the contract in the right neighborhood
 * without shipping the full contract text (which would also burst the
 * embed model's token budget).
 *
 * Kept as a tiny pure function so it can be unit-tested without a React
 * tree and reused outside the history page in the future.
 */

import type { AnalyzedClause, ContractOverview } from "@/types";

/**
 * Number of top-risk clause titles to fold into the aggregate. Three is
 * enough to bias the embedding toward the contract's dominant risk
 * theme without diluting the contract-type signal.
 */
export const LIBRARY_QUERY_TOP_RISK_COUNT = 3;

/** Relative risk ordering for picking "top risks" to fold into the query. */
const RISK_ORDER: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  informational: 0,
};

/**
 * Build the anchor string that will be embedded by mistral-embed.
 *
 * Shape: ``"<contract_type>. <key terms>. <top clause titles>."``
 * Returns an empty string when the overview carries no usable signal —
 * the caller should skip the search in that case rather than embed a
 * meaningless blank.
 */
export function buildLibraryQueryText(
  overview: ContractOverview,
  clauses: AnalyzedClause[],
): string {
  const parts: string[] = [];

  const contractType = overview.contract_type?.trim();
  if (contractType) {
    parts.push(contractType);
  }

  const keyTerms = (overview.key_terms ?? [])
    .map((t) => t?.trim())
    .filter((t): t is string => Boolean(t));
  if (keyTerms.length > 0) {
    parts.push(keyTerms.join(", "));
  }

  const topRiskTitles = [...clauses]
    .sort((a, b) => {
      const ra = RISK_ORDER[a.risk_level] ?? -1;
      const rb = RISK_ORDER[b.risk_level] ?? -1;
      return rb - ra;
    })
    .slice(0, LIBRARY_QUERY_TOP_RISK_COUNT)
    .map((c) => c.title?.trim())
    .filter((t): t is string => Boolean(t));
  if (topRiskTitles.length > 0) {
    parts.push(topRiskTitles.join(", "));
  }

  return parts.join(". ");
}

/**
 * Format a cosine-similarity score as a clamped integer percentage.
 * Matches the semantic-search bar's formatter so the two surfaces show
 * a consistent match-score scale.
 */
export function formatLibrarySimilarityPercent(similarity: number): number {
  const clamped = Math.max(0, Math.min(1, similarity));
  return Math.round(clamped * 100);
}
