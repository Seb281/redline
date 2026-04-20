/**
 * Unit tests for the pure comparison engine.
 *
 * The engine has no framework deps, so tests are plain `vitest` with
 * tiny synthetic `AnalyzedClause` fixtures. Each verdict branch +
 * overall-lean rule + tie-break gets its own case.
 */

import { describe, it, expect } from "vitest";
import type { AnalyzedClause, ClauseCategory, RiskLevel } from "@/types";
import { buildComparison } from "./engine";

/**
 * Minimal clause factory — only the fields the engine reads (category +
 * risk_level) are meaningful; everything else is inert filler so the
 * shape satisfies the `AnalyzedClause` interface.
 */
function clause(
  category: ClauseCategory,
  risk_level: RiskLevel,
): AnalyzedClause {
  return {
    clause_text: "x",
    category,
    title: "t",
    plain_english: "p",
    risk_level,
    risk_explanation: "r",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    applicable_law: null,
  };
}

describe("buildComparison — verdict branches", () => {
  it("empty inputs produce empty groups and zeroed stats", () => {
    const { groups, stats } = buildComparison([], []);
    expect(groups).toEqual([]);
    expect(stats).toEqual({
      riskierInA: 0,
      riskierInB: 0,
      uniqueToOne: 0,
      sameRiskLevel: 0,
      overallLean: "comparable",
    });
  });

  it("higher_in_a when A rank > B rank", () => {
    const { groups, stats } = buildComparison(
      [clause("liability", "high")],
      [clause("liability", "low")],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].verdict).toBe("higher_in_a");
    expect(stats.riskierInA).toBe(1);
    expect(stats.riskierInB).toBe(0);
  });

  it("higher_in_b when B rank > A rank", () => {
    const { groups, stats } = buildComparison(
      [clause("termination", "informational")],
      [clause("termination", "medium")],
    );
    expect(groups[0].verdict).toBe("higher_in_b");
    expect(stats.riskierInB).toBe(1);
  });

  it("same when ranks match, regardless of clause count", () => {
    const { groups, stats } = buildComparison(
      [clause("confidentiality", "medium"), clause("confidentiality", "low")],
      [clause("confidentiality", "medium")],
    );
    expect(groups[0].verdict).toBe("same");
    expect(groups[0].clausesA).toHaveLength(2);
    expect(groups[0].clausesB).toHaveLength(1);
    expect(stats.sameRiskLevel).toBe(1);
  });

  it("unique_to_a when category only in A", () => {
    const { groups, stats } = buildComparison(
      [clause("non_compete", "high")],
      [clause("liability", "low")],
    );
    const nc = groups.find((g) => g.category === "non_compete");
    expect(nc?.verdict).toBe("unique_to_a");
    expect(stats.uniqueToOne).toBe(2); // both categories are unique-to-one
  });

  it("unique_to_b when category only in B", () => {
    const { groups } = buildComparison(
      [],
      [clause("ip_assignment", "low")],
    );
    expect(groups[0].verdict).toBe("unique_to_b");
  });
});

describe("buildComparison — max risk per side", () => {
  it("maxRisk reflects the worst level among clauses of that category", () => {
    const { groups } = buildComparison(
      [
        clause("liability", "low"),
        clause("liability", "high"),
        clause("liability", "medium"),
      ],
      [clause("liability", "low")],
    );
    expect(groups[0].maxRiskA).toBe("high");
    expect(groups[0].maxRiskB).toBe("low");
    expect(groups[0].verdict).toBe("higher_in_a");
  });
});

describe("buildComparison — category ordering", () => {
  it("preserves first-seen order: A categories first, then B-only", () => {
    const { groups } = buildComparison(
      [clause("non_compete", "low"), clause("termination", "low")],
      [
        clause("liability", "low"),
        clause("termination", "low"),
        clause("confidentiality", "low"),
      ],
    );
    expect(groups.map((g) => g.category)).toEqual([
      "non_compete",
      "termination",
      "liability",
      "confidentiality",
    ]);
  });
});

describe("buildComparison — overallLean", () => {
  it('overallLean = "a" when sum of shared-rank deltas is positive', () => {
    const { stats } = buildComparison(
      [
        clause("liability", "high"), // rank 3
        clause("termination", "medium"), // rank 2
      ],
      [
        clause("liability", "low"), // rank 1 → delta +2
        clause("termination", "low"), // rank 1 → delta +1
      ],
    );
    expect(stats.overallLean).toBe("a");
  });

  it('overallLean = "b" when sum of shared-rank deltas is negative', () => {
    const { stats } = buildComparison(
      [clause("liability", "low")],
      [clause("liability", "high")],
    );
    expect(stats.overallLean).toBe("b");
  });

  it('overallLean = "comparable" when shared-rank deltas cancel', () => {
    const { stats } = buildComparison(
      [clause("liability", "high"), clause("termination", "low")],
      [clause("liability", "low"), clause("termination", "high")],
    );
    expect(stats.overallLean).toBe("comparable");
  });

  it("ignores unique-to-one categories when computing shared delta", () => {
    // non_compete is A-only; only liability is shared and ties → comparable
    const { stats } = buildComparison(
      [clause("non_compete", "high"), clause("liability", "medium")],
      [clause("liability", "medium")],
    );
    expect(stats.overallLean).toBe("comparable");
  });

  it("falls back to high+medium clause totals when no shared categories", () => {
    // All categories are unique-to-one — A has more severe clauses
    const { stats } = buildComparison(
      [clause("non_compete", "high"), clause("ip_assignment", "medium")],
      [clause("liability", "low"), clause("confidentiality", "informational")],
    );
    expect(stats.overallLean).toBe("a");
  });

  it('fallback: ties resolve to "comparable"', () => {
    const { stats } = buildComparison(
      [clause("non_compete", "high")],
      [clause("liability", "high")],
    );
    // No shared categories; both sides have 1 severe clause → comparable
    expect(stats.overallLean).toBe("comparable");
  });
});

describe("buildComparison — stat aggregation", () => {
  it("counts riskierInA, riskierInB, uniqueToOne, sameRiskLevel correctly", () => {
    const { stats } = buildComparison(
      [
        clause("liability", "high"), // higher_in_a vs low on B
        clause("termination", "low"), // same
        clause("non_compete", "medium"), // unique_to_a
      ],
      [
        clause("liability", "low"),
        clause("termination", "low"),
        clause("confidentiality", "high"), // unique_to_b
      ],
    );
    expect(stats.riskierInA).toBe(1);
    expect(stats.riskierInB).toBe(0);
    expect(stats.sameRiskLevel).toBe(1);
    expect(stats.uniqueToOne).toBe(2);
  });
});
