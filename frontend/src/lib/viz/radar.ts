/**
 * Pure geometry helpers for the RiskRadar spider chart.
 *
 * All functions are pure — no DOM, no React, safe for Node/tests/SSR.
 * Callers are responsible for ensuring `categories` contains only the
 * categories actually present in `clauses`.
 *
 * Coordinate convention:
 *   - 0 radians = 3 o'clock (inherited from {@link polarToCartesian}).
 *   - First axis starts at 12 o'clock (−π/2), then distributes CW.
 */

import type { AnalyzedClause, ClauseCategory, RiskLevel } from "@/types";
import { polarToCartesian } from "@/lib/viz/polar";
import { maxRiskForCategory, RISK_RADIUS_FRACTION } from "@/lib/viz/risk";

// ─── Public shapes ────────────────────────────────────────────────────────────

/**
 * One axis of the radar chart — describes where a category spoke ends
 * and the angle it sits at.
 */
export interface RadarAxis {
  /** The clause category this axis represents. */
  category: ClauseCategory;
  /** Angle in radians (0 = 3 o'clock, CW positive). */
  angleRad: number;
  /** XY at the outer-radius tip of this axis. */
  endpoint: { x: number; y: number };
}

/**
 * One vertex of the filled radar polygon — anchored to a category and
 * its resolved risk level so the caller can colour the dot correctly.
 */
export interface RadarVertex {
  /** The clause category this vertex represents. */
  category: ClauseCategory;
  /** Max risk level found for this category in the clause list. */
  risk: RiskLevel;
  /** XY position of the vertex, computed from radius fraction × outerR. */
  point: { x: number; y: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the axes (spokes) for a radar chart, distributing N categories
 * evenly around a full circle starting from 12 o'clock (−π/2), CW.
 *
 * @param categories - Ordered list of categories to place on axes.
 *                     Pass only categories that are actually present in
 *                     the clause data; the function does not filter them.
 * @param cx         - Centre X of the chart area.
 * @param cy         - Centre Y of the chart area.
 * @param outerR     - Outer radius; axes extend to this distance.
 * @returns          Array of {@link RadarAxis}, one per category, in input order.
 *                   Returns `[]` when `categories` is empty.
 */
export function buildRadarAxes(
  categories: readonly ClauseCategory[],
  cx: number,
  cy: number,
  outerR: number,
): RadarAxis[] {
  const n = categories.length;
  if (n === 0) return [];

  const step = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // 12 o'clock

  return categories.map((category, i) => {
    const angleRad = startAngle + i * step;
    const endpoint = polarToCartesian(cx, cy, outerR, angleRad);
    return { category, angleRad, endpoint };
  });
}

/**
 * Builds the filled polygon for a radar chart by computing a vertex for
 * each category based on its max risk level.
 *
 * Categories with no matching clauses are defensively omitted from both
 * the polygon and the `vertices` array. Callers that pass only
 * "present" categories will never trigger this path, but the guard
 * prevents a broken polygon if they don't.
 *
 * @param categories - Categories defining spoke positions (same order as
 *                     passed to {@link buildRadarAxes}).
 * @param clauses    - Full clause list to compute max risk from.
 * @param cx         - Centre X.
 * @param cy         - Centre Y.
 * @param outerR     - Outer radius; vertices are placed at
 *                     `RISK_RADIUS_FRACTION[risk] × outerR`.
 * @returns `{ points, vertices }` where `points` is the SVG `<polygon
 *          points>` attribute string and `vertices` carries per-vertex
 *          metadata for dot rendering.
 */
export function buildRadarPolygon(
  categories: readonly ClauseCategory[],
  clauses: AnalyzedClause[],
  cx: number,
  cy: number,
  outerR: number,
): { points: string; vertices: RadarVertex[] } {
  if (categories.length === 0) return { points: "", vertices: [] };

  const n = categories.length;
  const step = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const vertices: RadarVertex[] = [];
  const pointParts: string[] = [];

  categories.forEach((category, i) => {
    const risk = maxRiskForCategory(clauses, category);
    // Omit categories with no clauses (defensive guard).
    if (risk === null) return;

    const fraction = RISK_RADIUS_FRACTION[risk];
    const r = fraction * outerR;
    const angleRad = startAngle + i * step;
    const point = polarToCartesian(cx, cy, r, angleRad);

    vertices.push({ category, risk, point });
    pointParts.push(`${point.x},${point.y}`);
  });

  return {
    points: pointParts.join(" "),
    vertices,
  };
}
