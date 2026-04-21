/**
 * BorderedCard — 1px rectangle container.
 *
 * Default tone "edge" (paper-edge border) matches most content cards;
 * "ink" draws the strong 1px ink border used under the Compare summary
 * band; "red" draws the 2px red border reserved for the danger / destructive
 * block on the Account page.
 */

import type { HTMLAttributes } from "react";

type Tone = "edge" | "ink" | "red";
type Padding = "none" | "sm" | "md" | "lg";

const TONE: Record<Tone, string> = {
  edge: "border border-paper-edge",
  ink: "border border-ink",
  red: "border-2 border-red-accent",
};

const PADDING: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export interface BorderedCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  padding?: Padding;
}

export function BorderedCard({
  tone = "edge",
  padding = "md",
  className = "",
  children,
  ...rest
}: BorderedCardProps) {
  return (
    <div
      className={`bg-paper ${TONE[tone]} ${PADDING[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
