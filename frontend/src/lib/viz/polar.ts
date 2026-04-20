/**
 * Pure SVG geometry helpers for polar/annular chart primitives.
 *
 * Coordinate system:
 *   - 0 radians = 3 o'clock (positive X axis).
 *   - Angles increase clockwise (positive direction).
 *   - The SVG Y axis points downward, so `sin(θ)` maps to positive-Y
 *     in screen space — callers that want a "top = 12 o'clock" layout
 *     should pass `θ - π/2` or apply a CSS `rotate(-90deg)` on the SVG.
 *
 * All helpers are pure functions with no DOM dependencies so they can
 * run in Node (tests, SSR) without a browser context.
 */

/** Converts polar coordinates to an {x, y} Cartesian point. */
export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleRad: number,
): { x: number; y: number } {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

/**
 * Returns an SVG `<path d>` string for an open arc stroke along a single
 * radius `r`.  Suitable for a `<path>` element that will be stroked but
 * not filled.
 *
 * @param cx         - Centre X of the circle.
 * @param cy         - Centre Y of the circle.
 * @param r          - Radius.
 * @param startAngleRad - Start angle in radians (0 = 3 o'clock, CW positive).
 * @param endAngleRad   - End angle in radians.
 * @returns SVG `d` attribute string with M and A commands.
 */
export function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngleRad: number,
  endAngleRad: number,
): string {
  const start = polarToCartesian(cx, cy, r, startAngleRad);
  const end = polarToCartesian(cx, cy, r, endAngleRad);

  // SVG large-arc-flag: 1 when the arc spans more than π radians.
  const deltaAngle = endAngleRad - startAngleRad;
  const largeArcFlag = Math.abs(deltaAngle) > Math.PI ? 1 : 0;
  // Clockwise sweep direction = 1 in SVG.
  const sweepFlag = deltaAngle >= 0 ? 1 : 0;

  return [
    `M ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`,
  ].join(" ");
}

/**
 * Returns an SVG `<path d>` string for a closed, filled annular segment
 * (donut slice) bounded by an inner radius and an outer radius.
 *
 * For a full 360° sweep the path degenerates to two concentric circles.
 * To avoid the degenerate case the caller may split a 360° segment into
 * two 180° halves, or this helper handles it by clamping the end angle
 * to 359.9° automatically.
 *
 * @param cx          - Centre X.
 * @param cy          - Centre Y.
 * @param innerR      - Inner (hole) radius.
 * @param outerR      - Outer radius.
 * @param startAngleRad - Start angle in radians (0 = 3 o'clock, CW positive).
 * @param endAngleRad   - End angle in radians.
 * @returns Closed SVG `d` attribute string forming the filled annular sector.
 */
export function describeDonutSegment(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngleRad: number,
  endAngleRad: number,
): string {
  // Clamp full-circle case: end angle within ε of start + 2π would produce
  // coincident start/end points and the arc collapses to nothing.
  const TWO_PI = 2 * Math.PI;
  const span = endAngleRad - startAngleRad;
  const effectiveEnd =
    Math.abs(span) >= TWO_PI - 0.0001
      ? startAngleRad + Math.sign(span || 1) * (TWO_PI - 0.001)
      : endAngleRad;

  // Corner points named by (radius, angle): e.g. `outerAtStart` = outer radius at start angle.
  // The SVG path visits them in the order outer-start → outer-end → inner-end → inner-start
  // (clockwise around the annular sector, closing back to outer-start with `Z`).
  const outerAtStart = polarToCartesian(cx, cy, outerR, startAngleRad);
  const outerAtEnd = polarToCartesian(cx, cy, outerR, effectiveEnd);
  const innerAtEnd = polarToCartesian(cx, cy, innerR, effectiveEnd);
  const innerAtStart = polarToCartesian(cx, cy, innerR, startAngleRad);

  const delta = effectiveEnd - startAngleRad;
  const largeArc = Math.abs(delta) > Math.PI ? 1 : 0;
  const sweep = delta >= 0 ? 1 : 0;

  return [
    // Outer arc (start → end, CW)
    `M ${outerAtStart.x} ${outerAtStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} ${sweep} ${outerAtEnd.x} ${outerAtEnd.y}`,
    // Line across to the inner edge at the end angle
    `L ${innerAtEnd.x} ${innerAtEnd.y}`,
    // Inner arc (end → start, CCW)
    `A ${innerR} ${innerR} 0 ${largeArc} ${sweep === 1 ? 0 : 1} ${innerAtStart.x} ${innerAtStart.y}`,
    // Close back to outerAtStart
    "Z",
  ].join(" ");
}
