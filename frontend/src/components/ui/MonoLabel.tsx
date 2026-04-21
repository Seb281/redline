/**
 * Mono uppercase label with tracked letter-spacing.
 *
 * Used for kickers, crumbs, and any small identifier where the designer
 * called for JetBrains Mono. Keeps the editorial kicker aesthetic
 * consistent without 30 ad-hoc `font-mono uppercase tracking-wider`
 * strings scattered across components.
 */

import type { HTMLAttributes } from "react";

export interface MonoLabelProps extends HTMLAttributes<HTMLSpanElement> {
  /** Tone maps onto the three ink/red ramps used in the designs. */
  tone?: "ink" | "muted" | "red";
}

const TONE: Record<NonNullable<MonoLabelProps["tone"]>, string> = {
  ink: "text-ink",
  muted: "text-ink-muted",
  red: "text-red-accent",
};

export function MonoLabel({
  tone = "muted",
  className = "",
  children,
  ...rest
}: MonoLabelProps) {
  return (
    <span className={`t-mono-label ${TONE[tone]} ${className}`} {...rest}>
      {children}
    </span>
  );
}
