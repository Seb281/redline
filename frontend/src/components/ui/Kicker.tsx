/**
 * Kicker — mono uppercase label preceded by a short horizontal rule.
 *
 * The 28px leading rule is the design's editorial "tag" affordance
 * above section heads, clause kickers, and callouts. Implemented via
 * `.rule-leader` so the line stays perfectly aligned with the baseline
 * of the uppercase letters regardless of font rendering.
 */

import type { HTMLAttributes } from "react";

export interface KickerProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "ink" | "red" | "muted";
}

const TONE: Record<NonNullable<KickerProps["tone"]>, string> = {
  ink: "text-ink",
  red: "text-red-accent",
  muted: "text-ink-muted",
};

export function Kicker({
  tone = "ink",
  className = "",
  children,
  ...rest
}: KickerProps) {
  return (
    <span
      className={`t-kicker rule-leader inline-flex items-center ${TONE[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
