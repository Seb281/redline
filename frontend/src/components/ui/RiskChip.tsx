/**
 * RiskChip — compact rectangular risk indicator driven by the existing
 * RiskLevel union ("informational" | "low" | "medium" | "high").
 *
 * Keeps the editorial aesthetic: no rounded corners (>2px forbidden),
 * no gradients, mono uppercase label, semantic palette mapping.
 */

import type { HTMLAttributes } from "react";
import type { RiskLevel } from "@/types";

const STYLES: Record<RiskLevel, string> = {
  high: "bg-red-soft text-red-accent border-red-accent/40",
  medium: "bg-warn-soft text-warn border-warn/40",
  low: "bg-ok-soft text-ok border-ok/40",
  informational: "bg-info-soft text-info border-paper-edge",
};

export interface RiskChipProps extends HTMLAttributes<HTMLSpanElement> {
  level: RiskLevel;
  label: string;
  size?: "sm" | "md";
}

export function RiskChip({
  level,
  label,
  size = "md",
  className = "",
  ...rest
}: RiskChipProps) {
  const padding = size === "sm" ? "px-2 py-[2px]" : "px-2.5 py-1";
  const fontSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 border ${padding} ${fontSize} font-mono font-semibold uppercase tracking-[0.12em] ${STYLES[level]} ${className}`}
      {...rest}
    >
      {label}
    </span>
  );
}
