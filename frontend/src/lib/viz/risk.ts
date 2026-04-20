/**
 * Risk-level helpers shared across chart primitives (RiskChart, RiskRadar).
 *
 * Intentionally framework-agnostic: no React, no DOM — pure TypeScript so
 * these utilities are safe to import in server components and tests.
 */

import type { AnalyzedClause, ClauseCategory, RiskLevel } from "@/types";

/**
 * Canonical ordering of risk levels from least to most severe.
 * Used for sorting and monotonicity assertions.
 */
export const RISK_LEVELS: readonly RiskLevel[] = [
  "informational",
  "low",
  "medium",
  "high",
] as const;

/**
 * Fractional radius weight for each risk level, used by the RiskRadar to
 * position each axis tick at a proportional distance from the centre.
 * Values are monotonically increasing: informational (25%) → high (100%).
 */
export const RISK_RADIUS_FRACTION: Record<RiskLevel, number> = {
  informational: 0.25,
  low: 0.5,
  medium: 0.75,
  high: 1,
};

/**
 * Returns the highest risk level present among clauses matching `category`,
 * or `null` when no clause in the provided array belongs to that category.
 *
 * "Highest" is defined by the {@link RISK_LEVELS} ordering (last = worst).
 */
export function maxRiskForCategory(
  clauses: AnalyzedClause[],
  category: ClauseCategory,
): RiskLevel | null {
  const matching = clauses.filter((c) => c.category === category);
  if (matching.length === 0) return null;

  // Find the index of the worst level present among matching clauses.
  let maxIdx = -1;
  for (const clause of matching) {
    const idx = RISK_LEVELS.indexOf(clause.risk_level);
    if (idx > maxIdx) maxIdx = idx;
  }
  return RISK_LEVELS[maxIdx] ?? null;
}

/**
 * Returns the CSS custom-property reference for the given risk level.
 * Callers may use this directly as a `fill` or `stroke` value in SVG
 * or as a `color` / `background` in HTML.
 *
 * Example: `riskCssVar("high")` → `"var(--risk-high)"`
 */
export function riskCssVar(level: RiskLevel): string {
  if (level === "informational") return "var(--risk-info)";
  return `var(--risk-${level})`;
}
