/**
 * Spider / radar chart showing max risk level per clause category.
 *
 * Spoke count is dynamic — one spoke per *unique category present* in
 * `clauses`, so the chart adapts to any contract shape without blank axes.
 *
 * Interactive mode (optional):
 *   Pass `onSpokeClick` to enable category filtering. Clicking an active
 *   spoke calls the handler with `"all"` (clear). Without `onSpokeClick`
 *   the chart is decorative — no role, no tabIndex.
 *
 * Returns `null` when `clauses` has zero unique categories (empty state
 * handled by the parent layout — `ReportView` only renders after clauses
 * exist, but the guard makes the component safe to mount early).
 */

"use client";

import type { KeyboardEvent } from "react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { AnalyzedClause, ClauseCategory } from "@/types";
import { buildRadarAxes, buildRadarPolygon } from "@/lib/viz/radar";
import { riskCssVar } from "@/lib/viz/risk";
import { useSvgTooltip, VizTooltip } from "@/lib/viz/tooltip";

// ─── Layout constants ──────────────────────────────────────────────────────────

/** SVG viewBox dimensions. */
const VIEW = 200;
/** Centre of the SVG viewport. */
const CX = 100;
const CY = 100;
/** Outer radius of the chart area. Category label tips sit just beyond this. */
const OUTER_R = 72;
/** Distance from centre at which category labels are placed. */
const LABEL_R = OUTER_R + 14;

// ─── Props ────────────────────────────────────────────────────────────────────

/** Props for {@link RiskRadar}. */
interface RiskRadarProps {
  /** Full clause list from the analysis response. */
  clauses: AnalyzedClause[];
  /**
   * Currently active category filter. The matching spoke is highlighted
   * visually (other spokes dimmed). `"all"` or `undefined` = no active filter.
   */
  activeCategory?: ClauseCategory | "all";
  /**
   * Click/keyboard handler. Fired with the category when an inactive spoke
   * is activated; fired with `"all"` when the already-active spoke is clicked
   * (clear filter). When absent the chart is non-interactive.
   */
  onSpokeClick?: (category: ClauseCategory | "all") => void;
}

// ─── Tooltip payload ──────────────────────────────────────────────────────────

interface SpokeTooltipData {
  category: ClauseCategory;
  count: number;
  maxRisk: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determines SVG `textAnchor` for a label at the given angle.
 * Right half → "start", left half → "end", top/bottom → "middle".
 */
function labelTextAnchor(angleRad: number): "start" | "end" | "middle" {
  // Normalise to [0, 2π)
  const a = ((angleRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // Vertical band: within ±30° of 12 or 6 o'clock
  const VERT_BAND = Math.PI / 6;
  // Angle values named after the SVG (y-down) screen position they correspond to.
  const sixOClock = Math.PI / 2; // bottom of the chart
  const twelveOClock = (3 * Math.PI) / 2; // top of the chart
  if (
    Math.abs(a - sixOClock) < VERT_BAND ||
    Math.abs(a - twelveOClock) < VERT_BAND
  ) {
    return "middle";
  }
  // 0–π = right half (3→12→9 o'clock going CW in screen space is actually
  // the right side when a < π). SVG x increases right, angles increase CW.
  // cos(a) > 0 → right of centre.
  return Math.cos(angleRad) >= 0 ? "start" : "end";
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * SVG spider chart — one spoke per unique clause category in `clauses`.
 * Filled polygon encodes max risk per category via spoke length.
 * Vertex dots are coloured with the category's max risk CSS variable.
 */
export function RiskRadar({
  clauses,
  activeCategory,
  onSpokeClick,
}: RiskRadarProps) {
  const t = useTranslations("RiskRadar");
  const tCat = useTranslations("ClauseCategory");
  const tooltip = useSvgTooltip<SpokeTooltipData>();

  // Derive unique categories, preserving first-seen order.
  const categories = useMemo<ClauseCategory[]>(() => {
    const seen = new Set<ClauseCategory>();
    for (const c of clauses) {
      if (!seen.has(c.category)) seen.add(c.category);
    }
    return Array.from(seen);
  }, [clauses]);

  // Per-category clause counts for tooltips.
  const countByCategory = useMemo<Partial<Record<ClauseCategory, number>>>(
    () =>
      clauses.reduce<Partial<Record<ClauseCategory, number>>>((acc, c) => {
        acc[c.category] = (acc[c.category] ?? 0) + 1;
        return acc;
      }, {}),
    [clauses],
  );

  if (categories.length === 0) return null;

  const axes = buildRadarAxes(categories, CX, CY, OUTER_R);
  const { points, vertices } = buildRadarPolygon(
    categories,
    clauses,
    CX,
    CY,
    OUTER_R,
  );

  const interactive = !!onSpokeClick;

  /** Compute gridline radii from the risk fractions. */
  const gridRadii = [0.25, 0.5, 0.75, 1].map((f) => f * OUTER_R);

  /** Keyboard handler: Enter and Space both activate. */
  function handleKey(evt: KeyboardEvent, category: ClauseCategory) {
    if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
      if (!onSpokeClick) return;
      onSpokeClick(activeCategory === category ? "all" : category);
    }
  }

  return (
    <div
      className="relative flex flex-col items-center theme-transition"
      data-viz-container
    >
      <svg
        width="100%"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="img"
        aria-label={t("ariaLabel", {
          categories: categories.length,
          clauses: clauses.length,
        })}
      >
        {/* Concentric gridline circles */}
        {gridRadii.map((r) => (
          <circle
            key={r}
            cx={CX}
            cy={CY}
            r={r}
            fill="none"
            stroke="var(--border-primary)"
            strokeWidth={1}
          />
        ))}

        {/* Spoke lines */}
        {axes.map(({ category, endpoint }) => (
          <line
            key={`spoke-${category}`}
            x1={CX}
            y1={CY}
            x2={endpoint.x}
            y2={endpoint.y}
            stroke="var(--border-primary)"
            strokeWidth={1}
          />
        ))}

        {/* Filled polygon */}
        {points.length > 0 && (
          <polygon
            points={points}
            fill="var(--accent)"
            fillOpacity={0.18}
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
        )}

        {/* Vertex dots — coloured by max risk */}
        {vertices.map(({ category, risk, point }) => (
          <circle
            key={`dot-${category}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={riskCssVar(risk)}
            stroke="var(--bg-card)"
            strokeWidth={1.5}
          />
        ))}

        {/* Category labels */}
        {axes.map(({ category, angleRad }) => {
          // Nudge label further out along the spoke vector.
          const cos = Math.cos(angleRad);
          const sin = Math.sin(angleRad);
          const lx = CX + LABEL_R * cos;
          const ly = CY + LABEL_R * sin;
          const anchor = labelTextAnchor(angleRad);
          const label = tCat(category);

          return (
            <text
              key={`label-${category}`}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={9}
              fill="var(--text-tertiary)"
              fontFamily="var(--font-heading)"
              letterSpacing="0.04em"
              style={{ textTransform: "uppercase" }}
            >
              {label}
            </text>
          );
        })}

        {/* Invisible hit areas + interactive spoke groups */}
        {axes.map(({ category, endpoint }) => {
          const isActive = activeCategory === category;
          const isDimmed =
            !!activeCategory &&
            activeCategory !== "all" &&
            activeCategory !== category;
          const count = countByCategory[category] ?? 0;

          // Build vertex risk label for aria/tooltip
          const vertex = vertices.find((v) => v.category === category);
          const maxRiskLabel = vertex
            ? t(`riskLevel.${vertex.risk}`)
            : t("riskLevel.informational");

          const spokeAriaLabel = t("spokeAriaLabel", {
            category: tCat(category),
            count,
            maxRisk: maxRiskLabel,
          });

          const tooltipPayload: SpokeTooltipData = {
            category,
            count,
            maxRisk: maxRiskLabel,
          };

          return (
            <g
              key={`hit-${category}`}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={spokeAriaLabel}
              aria-pressed={interactive ? isActive : undefined}
              onClick={
                interactive
                  ? () => onSpokeClick(isActive ? "all" : category)
                  : undefined
              }
              onKeyDown={
                interactive ? (e) => handleKey(e, category) : undefined
              }
              onMouseEnter={(e) => tooltip.show(tooltipPayload, e)}
              onMouseLeave={tooltip.hide}
              onFocus={(e) => tooltip.show(tooltipPayload, e)}
              onBlur={tooltip.hide}
              style={{
                opacity: isDimmed ? 0.35 : 1,
                cursor: interactive ? "pointer" : undefined,
                outline: "none",
                transition: "opacity 0.15s ease",
              }}
            >
              {/* Transparent oversized hit circle at spoke tip */}
              <circle
                cx={endpoint.x}
                cy={endpoint.y}
                r={12}
                fill="transparent"
                stroke="none"
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip — absolute-positioned relative to this wrapper */}
      <VizTooltip position={tooltip.position}>
        {tooltip.data && (
          <span>
            {tCat(tooltip.data.category)} —{" "}
            {t("tooltipClauses", { count: tooltip.data.count })} —{" "}
            {t("tooltipMaxRisk", { maxRisk: tooltip.data.maxRisk })}
          </span>
        )}
      </VizTooltip>
    </div>
  );
}
