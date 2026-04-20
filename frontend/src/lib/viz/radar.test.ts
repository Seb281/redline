/**
 * Unit tests for the pure radar chart geometry helpers.
 * No DOM, no React — vitest only.
 */

import { describe, it, expect } from "vitest";
import { buildRadarAxes, buildRadarPolygon } from "./radar";
import type { AnalyzedClause, ClauseCategory } from "@/types";
import { RISK_RADIUS_FRACTION } from "@/lib/viz/risk";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CX = 100;
const CY = 100;
const R = 72;

/** Make a minimal AnalyzedClause for a given category + risk. */
function makeClause(
  category: ClauseCategory,
  risk: AnalyzedClause["risk_level"],
): AnalyzedClause {
  return {
    category,
    risk_level: risk,
    title: category,
    clause_text: "",
    plain_english: "",
    risk_explanation: "",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    applicable_law: null,
  };
}

// ─── buildRadarAxes ───────────────────────────────────────────────────────────

describe("buildRadarAxes", () => {
  it("returns empty array for 0 categories", () => {
    expect(buildRadarAxes([], CX, CY, R)).toEqual([]);
  });

  it("returns 1 axis for 1 category; angle is -π/2 (12 o'clock)", () => {
    const axes = buildRadarAxes(["liability"], CX, CY, R);
    expect(axes).toHaveLength(1);
    expect(axes[0].angleRad).toBeCloseTo(-Math.PI / 2);
    // endpoint on the circle at that angle
    expect(axes[0].endpoint.x).toBeCloseTo(CX + R * Math.cos(-Math.PI / 2));
    expect(axes[0].endpoint.y).toBeCloseTo(CY + R * Math.sin(-Math.PI / 2));
  });

  it("distributes 4 categories evenly at 90° steps", () => {
    const cats: ClauseCategory[] = [
      "liability",
      "termination",
      "confidentiality",
      "payment_terms",
    ];
    const axes = buildRadarAxes(cats, CX, CY, R);
    expect(axes).toHaveLength(4);

    const step = (2 * Math.PI) / 4;
    const start = -Math.PI / 2;

    axes.forEach((axis, i) => {
      expect(axis.angleRad).toBeCloseTo(start + i * step);
    });
  });

  it("distributes 8 categories at 45° steps", () => {
    const cats: ClauseCategory[] = [
      "liability",
      "termination",
      "confidentiality",
      "payment_terms",
      "governing_law",
      "indemnification",
      "data_protection",
      "non_compete",
    ];
    const axes = buildRadarAxes(cats, CX, CY, R);
    expect(axes).toHaveLength(8);

    const step = (2 * Math.PI) / 8;
    const start = -Math.PI / 2;

    axes.forEach((axis, i) => {
      expect(axis.angleRad).toBeCloseTo(start + i * step);
    });
  });

  it("all endpoints lie on the outer circle (distance ≈ R from centre)", () => {
    const cats: ClauseCategory[] = [
      "liability",
      "termination",
      "confidentiality",
      "payment_terms",
    ];
    const axes = buildRadarAxes(cats, CX, CY, R);
    for (const axis of axes) {
      const dx = axis.endpoint.x - CX;
      const dy = axis.endpoint.y - CY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeCloseTo(R);
    }
  });
});

// ─── buildRadarPolygon ────────────────────────────────────────────────────────

describe("buildRadarPolygon", () => {
  it("returns empty result for 0 categories", () => {
    const result = buildRadarPolygon([], [], CX, CY, R);
    expect(result.points).toBe("");
    expect(result.vertices).toHaveLength(0);
  });

  it("single category → single vertex, non-empty points string", () => {
    const clauses = [makeClause("liability", "high")];
    const result = buildRadarPolygon(["liability"], clauses, CX, CY, R);
    expect(result.vertices).toHaveLength(1);
    expect(result.points).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
  });

  it("vertex radius matches RISK_RADIUS_FRACTION[maxRisk] × outerR", () => {
    const clauses = [
      makeClause("liability", "high"),
      makeClause("termination", "medium"),
      makeClause("confidentiality", "low"),
      makeClause("payment_terms", "informational"),
    ];
    const cats: ClauseCategory[] = [
      "liability",
      "termination",
      "confidentiality",
      "payment_terms",
    ];
    const result = buildRadarPolygon(cats, clauses, CX, CY, R);
    expect(result.vertices).toHaveLength(4);

    const expectedRisks: AnalyzedClause["risk_level"][] = [
      "high",
      "medium",
      "low",
      "informational",
    ];
    const step = (2 * Math.PI) / 4;
    const start = -Math.PI / 2;

    result.vertices.forEach((vertex, i) => {
      const fraction = RISK_RADIUS_FRACTION[expectedRisks[i]];
      const expectedR = fraction * R;
      const dx = vertex.point.x - CX;
      const dy = vertex.point.y - CY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeCloseTo(expectedR);

      // angle matches axis
      const expectedAngle = start + i * step;
      const actualAngle = Math.atan2(dy, dx);
      expect(actualAngle).toBeCloseTo(expectedAngle);
    });
  });

  it("mixed risks across categories → correct per-vertex radius", () => {
    // liability has both low and high clauses → max = high
    const clauses = [
      makeClause("liability", "low"),
      makeClause("liability", "high"),
      makeClause("termination", "medium"),
    ];
    const result = buildRadarPolygon(
      ["liability", "termination"],
      clauses,
      CX,
      CY,
      R,
    );
    const liabilityVertex = result.vertices.find(
      (v) => v.category === "liability",
    );
    expect(liabilityVertex?.risk).toBe("high");

    const dx = (liabilityVertex?.point.x ?? 0) - CX;
    const dy = (liabilityVertex?.point.y ?? 0) - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeCloseTo(RISK_RADIUS_FRACTION.high * R);
  });

  it("category with no matching clauses is omitted from vertices", () => {
    // Pass 3 cats but only 1 has clauses
    const clauses = [makeClause("liability", "medium")];
    const result = buildRadarPolygon(
      ["liability", "termination", "confidentiality"],
      clauses,
      CX,
      CY,
      R,
    );
    // Only the category with clauses produces a vertex
    expect(result.vertices).toHaveLength(1);
    expect(result.vertices[0].category).toBe("liability");
  });

  it("2 categories → 2 vertices, points string has 2 coordinate pairs", () => {
    const clauses = [
      makeClause("liability", "high"),
      makeClause("termination", "low"),
    ];
    const result = buildRadarPolygon(
      ["liability", "termination"],
      clauses,
      CX,
      CY,
      R,
    );
    expect(result.vertices).toHaveLength(2);
    // "x1,y1 x2,y2" — one space separating two pairs
    const pairs = result.points.split(" ");
    expect(pairs).toHaveLength(2);
  });
});
