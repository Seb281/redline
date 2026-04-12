/** Color-coded risk level badge using CSS variable risk tokens. */

import type { RiskLevel } from "@/types";

const STYLES: Record<RiskLevel, string> = {
  high: "bg-[var(--risk-high-bg)] text-[var(--risk-high)] border border-[var(--risk-high-border)]",
  medium: "bg-[var(--risk-medium-bg)] text-[var(--risk-medium)] border border-[var(--risk-medium-border)]",
  low: "bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)]",
  informational: "bg-[var(--risk-info-bg)] text-[var(--risk-info)] border border-[var(--risk-info-border)]",
};

interface RiskBadgeProps {
  level: RiskLevel;
}

/** Renders a small colored badge indicating risk level. */
export function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <span
      className={`inline-block rounded px-2.5 py-1 text-sm font-semibold uppercase font-[var(--font-body)] ${STYLES[level]}`}
    >
      {level === "informational" ? "info" : `${level} risk`}
    </span>
  );
}
