/**
 * Shared types for the contract-comparison feature (SP-8 Phase B).
 *
 * Kept in their own module so the pure `engine.ts` computation and the
 * React components at `src/components/compare/*` can both import them
 * without pulling each other in.
 */

import type {
  AnalyzeResponse,
  AnalyzedClause,
  ClauseCategory,
  RiskLevel,
} from "@/types";

/**
 * Per-category verdict when comparing Contract A against Contract B.
 *
 * Derived from the max risk level each side carries for the category:
 *   - both sides present, A rank > B rank  → "higher_in_a"
 *   - both sides present, B rank > A rank  → "higher_in_b"
 *   - both sides present, ranks equal      → "same"
 *   - only A present                       → "unique_to_a"
 *   - only B present                       → "unique_to_b"
 *
 * Rank is the index in `RISK_LEVELS`. Clause-count parity is NOT a
 * risk signal — two low clauses on A vs one low clause on B still
 * resolves to "same".
 */
export type CategoryVerdict =
  | "higher_in_a"
  | "higher_in_b"
  | "same"
  | "unique_to_a"
  | "unique_to_b";

/**
 * One row of the comparison: all clauses from A and B that share the
 * same `ClauseCategory`, plus the computed max-risk per side and the
 * resolved verdict. Both clause arrays are in input order (no sort).
 */
export interface ComparisonGroup {
  category: ClauseCategory;
  maxRiskA: RiskLevel | null;
  maxRiskB: RiskLevel | null;
  clausesA: AnalyzedClause[];
  clausesB: AnalyzedClause[];
  verdict: CategoryVerdict;
}

/**
 * Aggregate counters + overall lean across every `ComparisonGroup`.
 *
 * `overallLean` is derived from the sum of per-category rank deltas
 * (rankA − rankB) across categories present in BOTH contracts:
 *   - totalDelta > 0  → "a" (Contract A leans riskier)
 *   - totalDelta < 0  → "b"
 *   - totalDelta = 0  → "comparable"
 *
 * When no categories are shared (every group is unique-to-one), we fall
 * back to comparing the high+medium clause totals per side; ties still
 * resolve to "comparable".
 */
export interface ComparisonStats {
  riskierInA: number;
  riskierInB: number;
  uniqueToOne: number;
  sameRiskLevel: number;
  overallLean: "a" | "b" | "comparable";
}

/** Top-level comparison payload handed to the UI. */
export interface PreparedComparison {
  groups: ComparisonGroup[];
  stats: ComparisonStats;
}

/**
 * Filter applied to the diff view. Maps cleanly onto the `DiffFilterBar`
 * pill tabs — the engine never filters; filtering is a UI-level view
 * over `PreparedComparison.groups`.
 */
export type CompareFilter =
  | "all"
  | "differences"
  | "higher_in_a"
  | "higher_in_b"
  | "unique";

/**
 * One of the two compare slots (A or B) as the page sees it.
 *
 * - `empty`    — no selection yet
 * - `loading`  — lazy-analyze in flight (sample contract) or saved
 *                analysis fetch in flight (history handoff)
 * - `error`    — terminal failure; UI shows a retry affordance
 * - `ready`    — fully loaded, ready to compare
 */
export type CompareSlot =
  | { status: "empty" }
  | { status: "loading"; label: string }
  | { status: "error"; label: string; message: string }
  | {
      status: "ready";
      label: string;
      data: AnalyzeResponse;
      /** Present when the slot was hydrated from a saved analysis. */
      sourceId?: string;
    };
