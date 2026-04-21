/**
 * HeroRules — decorative horizontal rule grid echoing the physical
 * margin of a printed document.
 *
 * Pure presentation — renders eight thin rules at 14% opacity across
 * the hero and a single red running line on the left margin. No DOM
 * interactivity, no JS. `aria-hidden` so screen readers skip it.
 */

import type { HTMLAttributes } from "react";

export interface HeroRulesProps extends HTMLAttributes<HTMLDivElement> {
  /** Rule density — "default" | "dense" | "minimal". */
  variant?: "default" | "dense" | "minimal";
}

const OPACITY: Record<NonNullable<HeroRulesProps["variant"]>, string> = {
  default: "opacity-[0.14]",
  dense: "opacity-20",
  minimal: "opacity-0",
};

export function HeroRules({
  variant = "default",
  className = "",
  ...rest
}: HeroRulesProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      {...rest}
    >
      <div
        className={`absolute inset-0 flex flex-col justify-between py-6 ${OPACITY[variant]}`}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="block h-px w-full bg-ink" />
        ))}
      </div>
      <span className="absolute bottom-0 left-[32px] top-0 w-[2px] bg-red-accent/60" />
    </div>
  );
}
