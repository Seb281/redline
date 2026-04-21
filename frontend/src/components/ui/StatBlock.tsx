/**
 * StatBlock — Fraunces numeral paired with a mono uppercase caption.
 *
 * Used in summary bands (Report, Compare), account usage panel, and
 * history row quartets. Numeral weight, size, and leading are tuned to
 * sit comfortably against a 1px paper-edge divider.
 */

import type { ReactNode } from "react";
import { MonoLabel } from "./MonoLabel";

export interface StatBlockProps {
  value: ReactNode;
  label: ReactNode;
  /** Optional small trailing hint (e.g. "of 12"). */
  hint?: ReactNode;
  /** Rendering size. Default "md" (32px numeral). */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE: Record<NonNullable<StatBlockProps["size"]>, string> = {
  sm: "text-[22px]",
  md: "text-[32px]",
  lg: "text-[42px]",
};

export function StatBlock({
  value,
  label,
  hint,
  size = "md",
  className = "",
}: StatBlockProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <MonoLabel tone="muted">{label}</MonoLabel>
      <span className={`font-serif ${SIZE[size]} leading-none text-ink`}>
        {value}
        {hint ? (
          <span className="ml-2 font-sans text-[13px] text-ink-muted">
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}
