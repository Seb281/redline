/**
 * Donut chart showing risk level distribution.
 *
 * Rendering: four filled annular segments computed from `describeDonutSegment`
 * (pure SVG paths, no charting library). Colours come exclusively from CSS
 * custom properties so dark mode works automatically.
 *
 * Interactive mode (optional):
 *   Pass `onSegmentClick` to enable filtering. Clicking a segment calls the
 *   handler with the segment's `RiskLevel`. Clicking the active segment calls
 *   it with `"all"` (clear). When `onSegmentClick` is absent the chart is
 *   purely decorative — no role, no tabIndex, no click handler — which
 *   preserves backward compat with `StreamingReportView`.
 */

"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import type { RiskBreakdown, RiskLevel } from "@/types";
import { describeDonutSegment } from "@/lib/viz/polar";
import { riskCssVar } from "@/lib/viz/risk";
import { useSvgTooltip, VizTooltip } from "@/lib/viz/tooltip";

/** Props for {@link RiskChart}. */
interface RiskChartProps {
  breakdown: RiskBreakdown;
  /**
   * Currently active risk filter. When set, the matching segment is pulled
   * out (outer radius bump) and non-matching segments are dimmed.
   * Pass `"all"` to reset to no-filter state (all segments full opacity).
   */
  activeRisk?: RiskLevel | "all";
  /**
   * Click handler fired with the clicked segment's `RiskLevel`, or `"all"`
   * when the user clicks the already-active segment (clear).
   * When absent the chart is non-interactive.
   */
  onSegmentClick?: (risk: RiskLevel | "all") => void;
}

/** Tooltip payload shown on segment hover/focus. */
interface SegmentTooltipData {
  label: string;
  count: number;
  percentage: number;
}

/** Chart layout constants. */
const CX = 40;
const CY = 40;
const INNER_R = 26;
const OUTER_R = 30;
const OUTER_R_ACTIVE = 34; // 4 px pull-out for active segment
/** Gap between segments in radians (visual breathing room). */
const GAP_RAD = 0.04;
/** Start at 12 o'clock (−π/2). */
const START_ANGLE = -Math.PI / 2;

/**
 * SVG donut chart for risk distribution — renders inline at 90×90 (viewBox 80×80).
 * Uses CSS custom properties for fill colours so dark mode adapts automatically.
 */
export function RiskChart({ breakdown, activeRisk, onSegmentClick }: RiskChartProps) {
  const t = useTranslations("RiskChart");
  const tooltip = useSvgTooltip<SegmentTooltipData>();

  const info = breakdown.informational ?? 0;
  const total = breakdown.high + breakdown.medium + breakdown.low + info;
  if (total === 0) return null;

  /** Ordered segments from most to least severe (drawn last = on top). */
  const segments: Array<{ level: RiskLevel; count: number }> = [
    { level: "informational", count: info },
    { level: "low", count: breakdown.low },
    { level: "medium", count: breakdown.medium },
    { level: "high", count: breakdown.high },
  ];

  /** Compute start/end angle for each non-zero segment. */
  const nonZero = segments.filter((s) => s.count > 0);
  let cursor = START_ANGLE;

  const arcs = nonZero.map((seg) => {
    const pct = seg.count / total;
    const span = pct * 2 * Math.PI;
    // Apply gap only when more than one segment exists.
    const halfGap = nonZero.length > 1 ? GAP_RAD / 2 : 0;
    const start = cursor + halfGap;
    const end = cursor + span - halfGap;
    cursor += span;
    return { ...seg, startAngle: start, endAngle: end };
  });

  const interactive = !!onSegmentClick;

  /** Keyboard handler: Enter and Space both activate the click. */
  function handleKey(evt: KeyboardEvent, level: RiskLevel) {
    if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
      if (!onSegmentClick) return;
      onSegmentClick(activeRisk === level ? "all" : level);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex flex-col items-center"
        data-viz-container
      >
        <svg
          width="90"
          height="90"
          viewBox="0 0 80 80"
          role="img"
          aria-label={t("ariaLabel", {
            high: breakdown.high,
            medium: breakdown.medium,
            low: breakdown.low,
            info,
          })}
        >
          {/* Background track */}
          <circle
            cx={CX}
            cy={CY}
            r={(INNER_R + OUTER_R) / 2}
            fill="none"
            stroke="var(--bg-tertiary)"
            strokeWidth={OUTER_R - INNER_R}
          />

          {arcs.map(({ level, count, startAngle, endAngle }) => {
            const pct = count / total;
            const percentage = Math.round(pct * 100);
            const isActive = activeRisk === level;
            const isDimmed =
              !!activeRisk && activeRisk !== "all" && activeRisk !== level;
            const outerR = isActive ? OUTER_R_ACTIVE : OUTER_R;

            const d = describeDonutSegment(
              CX,
              CY,
              INNER_R,
              outerR,
              startAngle,
              endAngle,
            );
            const label = t(`labels.${level}`);
            const segmentAriaLabel = t("segmentAriaLabel", {
              label,
              count,
              percentage,
            });

            const tooltipPayload: SegmentTooltipData = {
              label,
              count,
              percentage,
            };

            return (
              <g
                key={level}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={segmentAriaLabel}
                aria-pressed={interactive ? isActive : undefined}
                onClick={
                  interactive
                    ? () => onSegmentClick(isActive ? "all" : level)
                    : undefined
                }
                onKeyDown={interactive ? (e) => handleKey(e, level) : undefined}
                onMouseEnter={(e) => tooltip.show(tooltipPayload, e)}
                onMouseLeave={tooltip.hide}
                onFocus={(e) => tooltip.show(tooltipPayload, e)}
                onBlur={tooltip.hide}
                style={{
                  opacity: isDimmed ? 0.4 : 1,
                  cursor: interactive ? "pointer" : undefined,
                  outline: "none",
                  transition: "opacity 0.15s ease",
                }}
              >
                <path
                  d={d}
                  fill={riskCssVar(level)}
                />
              </g>
            );
          })}

          {/* Centre count */}
          <text
            x={CX}
            y={CY + 6}
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fill="var(--text-primary)"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {total}
          </text>
        </svg>

        {/* Tooltip — absolute-positioned relative to this wrapper */}
        <VizTooltip position={tooltip.position}>
          {tooltip.data && (
            <span>
              {tooltip.data.label} — {tooltip.data.count} {t("clauses", { count: tooltip.data.count })} ({t("tooltipPercent", { percentage: tooltip.data.percentage })})
            </span>
          )}
        </VizTooltip>
      </div>

      <p className="mt-1.5 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
        {t("clauses", { count: total })}
      </p>
    </div>
  );
}
