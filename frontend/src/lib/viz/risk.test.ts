/**
 * Unit tests for risk-level helpers.
 */

import { describe, it, expect } from "vitest";
import { RISK_LEVELS, RISK_RADIUS_FRACTION, maxRiskForCategory, riskCssVar } from "./risk";
import type { AnalyzedClause } from "@/types";

describe("RISK_LEVELS", () => {
  it("order is informational → low → medium → high", () => {
    expect(RISK_LEVELS).toEqual(["informational", "low", "medium", "high"]);
  });
});

describe("RISK_RADIUS_FRACTION", () => {
  it("is monotonically increasing", () => {
    expect(RISK_RADIUS_FRACTION.informational).toBeLessThan(RISK_RADIUS_FRACTION.low);
    expect(RISK_RADIUS_FRACTION.low).toBeLessThan(RISK_RADIUS_FRACTION.medium);
    expect(RISK_RADIUS_FRACTION.medium).toBeLessThan(RISK_RADIUS_FRACTION.high);
  });

  it("high = 1", () => {
    expect(RISK_RADIUS_FRACTION.high).toBe(1);
  });
});

/** Minimal AnalyzedClause stub for tests. */
function makeClause(
  category: AnalyzedClause["category"],
  risk_level: AnalyzedClause["risk_level"],
): AnalyzedClause {
  return {
    clause_text: "text",
    category,
    title: "Title",
    plain_english: "plain",
    risk_level,
    risk_explanation: "expl",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
  };
}

describe("maxRiskForCategory", () => {
  it("returns null when no clauses match the category", () => {
    const clauses = [makeClause("liability", "low")];
    expect(maxRiskForCategory(clauses, "termination")).toBeNull();
  });

  it("returns the only risk when a single clause matches", () => {
    const clauses = [makeClause("liability", "medium")];
    expect(maxRiskForCategory(clauses, "liability")).toBe("medium");
  });

  it("returns highest risk among matching clauses", () => {
    const clauses = [
      makeClause("liability", "low"),
      makeClause("liability", "high"),
      makeClause("liability", "medium"),
    ];
    expect(maxRiskForCategory(clauses, "liability")).toBe("high");
  });

  it("ignores clauses from other categories", () => {
    const clauses = [
      makeClause("liability", "high"),
      makeClause("termination", "low"),
    ];
    expect(maxRiskForCategory(clauses, "termination")).toBe("low");
  });

  it("returns null for empty array", () => {
    expect(maxRiskForCategory([], "liability")).toBeNull();
  });
});

describe("riskCssVar", () => {
  it("high → var(--risk-high)", () => {
    expect(riskCssVar("high")).toBe("var(--risk-high)");
  });

  it("medium → var(--risk-medium)", () => {
    expect(riskCssVar("medium")).toBe("var(--risk-medium)");
  });

  it("low → var(--risk-low)", () => {
    expect(riskCssVar("low")).toBe("var(--risk-low)");
  });

  it("informational → var(--risk-info)", () => {
    expect(riskCssVar("informational")).toBe("var(--risk-info)");
  });
});
