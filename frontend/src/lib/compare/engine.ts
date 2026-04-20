/**
 * Pure comparison engine for the `/compare` feature (SP-8 Phase B).
 *
 * Consumes two `AnalyzedClause[]` arrays — one per contract — and emits
 * a `PreparedComparison` structure the UI can render without any
 * further risk-logic awareness. No React, no DOM, no side effects.
 *
 * The engine is deliberately tiny: clause matching is a deterministic
 * intersection on the `ClauseCategory` enum, and all ranking reduces
 * to `RISK_LEVELS.indexOf(level)`. Fuzzy text matching is out of scope.
 */

import type { AnalyzedClause, ClauseCategory, RiskLevel } from "@/types";
import { RISK_LEVELS, maxRiskForCategory } from "@/lib/viz/risk";
import type {
  CategoryVerdict,
  ComparisonGroup,
  ComparisonStats,
  PreparedComparison,
} from "./types";

/**
 * Numeric rank for a risk level (0..3). `-1` when the side is absent
 * for the category. Callers must treat `-1` as "not present" before
 * comparing ranks.
 */
function rank(level: RiskLevel | null): number {
  if (level === null) return -1;
  return RISK_LEVELS.indexOf(level);
}

/**
 * Resolves the verdict for a single category given each side's max
 * risk level. Pure, order-insensitive.
 */
function verdictFor(
  maxRiskA: RiskLevel | null,
  maxRiskB: RiskLevel | null,
): CategoryVerdict {
  const rA = rank(maxRiskA);
  const rB = rank(maxRiskB);

  if (rA === -1 && rB !== -1) return "unique_to_b";
  if (rB === -1 && rA !== -1) return "unique_to_a";
  if (rA === rB) return "same";
  return rA > rB ? "higher_in_a" : "higher_in_b";
}

/**
 * Collects the union of category enums appearing in A and/or B while
 * preserving first-seen order (A-first, then any B-only categories).
 * Keeping input order avoids an arbitrary alphabetical sort that would
 * break the expectation that "your current contract goes first".
 */
function orderedCategoryUnion(
  clausesA: AnalyzedClause[],
  clausesB: AnalyzedClause[],
): ClauseCategory[] {
  const seen = new Set<ClauseCategory>();
  const out: ClauseCategory[] = [];
  for (const c of clausesA) {
    if (!seen.has(c.category)) {
      seen.add(c.category);
      out.push(c.category);
    }
  }
  for (const c of clausesB) {
    if (!seen.has(c.category)) {
      seen.add(c.category);
      out.push(c.category);
    }
  }
  return out;
}

/**
 * Computes the overall-lean label.
 *
 * Happy path: sum of (rankA − rankB) across categories present on both
 * sides. Positive → A leans riskier, negative → B, zero → comparable.
 *
 * Fallback path (no shared categories): compare total high+medium
 * clause counts per side. If still tied, "comparable".
 */
function computeOverallLean(
  groups: ComparisonGroup[],
  clausesA: AnalyzedClause[],
  clausesB: AnalyzedClause[],
): ComparisonStats["overallLean"] {
  const shared = groups.filter(
    (g) => g.maxRiskA !== null && g.maxRiskB !== null,
  );

  if (shared.length > 0) {
    const totalDelta = shared.reduce(
      (acc, g) => acc + (rank(g.maxRiskA) - rank(g.maxRiskB)),
      0,
    );
    if (totalDelta > 0) return "a";
    if (totalDelta < 0) return "b";
    return "comparable";
  }

  const severeCount = (clauses: AnalyzedClause[]) =>
    clauses.filter(
      (c) => c.risk_level === "high" || c.risk_level === "medium",
    ).length;

  const sA = severeCount(clausesA);
  const sB = severeCount(clausesB);
  if (sA > sB) return "a";
  if (sB > sA) return "b";
  return "comparable";
}

/**
 * Builds the full `PreparedComparison` from two analysed clause arrays.
 *
 * The two arrays may be empty; in that case `groups` is empty and all
 * stat counts are 0 with `overallLean = "comparable"` — giving the UI
 * a safe render target for the "no clauses on either side" edge case.
 */
export function buildComparison(
  clausesA: AnalyzedClause[],
  clausesB: AnalyzedClause[],
): PreparedComparison {
  const categories = orderedCategoryUnion(clausesA, clausesB);

  const groups: ComparisonGroup[] = categories.map((category) => {
    const maxRiskA = maxRiskForCategory(clausesA, category);
    const maxRiskB = maxRiskForCategory(clausesB, category);
    return {
      category,
      maxRiskA,
      maxRiskB,
      clausesA: clausesA.filter((c) => c.category === category),
      clausesB: clausesB.filter((c) => c.category === category),
      verdict: verdictFor(maxRiskA, maxRiskB),
    };
  });

  const stats: ComparisonStats = {
    riskierInA: groups.filter((g) => g.verdict === "higher_in_a").length,
    riskierInB: groups.filter((g) => g.verdict === "higher_in_b").length,
    uniqueToOne: groups.filter(
      (g) => g.verdict === "unique_to_a" || g.verdict === "unique_to_b",
    ).length,
    sameRiskLevel: groups.filter((g) => g.verdict === "same").length,
    overallLean: computeOverallLean(groups, clausesA, clausesB),
  };

  return { groups, stats };
}
