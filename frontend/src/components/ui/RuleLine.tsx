/**
 * Horizontal rule — the compositional backbone of the editorial layout.
 *
 * Variants map to the border weights catalogued in the design handoff:
 *   - "strong"  : 1px ink (under masthead, around summary bands)
 *   - "section" : 2px ink (below H1 mastheads)
 *   - "subtle"  : 1px paper-edge (between list rows, around cards)
 *   - "accent"  : 2px red (brand mark, vertical rails)
 *
 * Use `role="presentation"` — these rules are decorative dividers, not
 * semantic separators, so screen readers should skip them.
 */

import type { HTMLAttributes } from "react";

type Variant = "strong" | "section" | "subtle" | "accent";

const VARIANTS: Record<Variant, string> = {
  strong: "border-t border-ink",
  section: "border-t-2 border-ink",
  subtle: "border-t border-paper-edge",
  accent: "border-t-2 border-red-accent",
};

export interface RuleLineProps extends HTMLAttributes<HTMLHRElement> {
  variant?: Variant;
}

export function RuleLine({
  variant = "subtle",
  className = "",
  ...rest
}: RuleLineProps) {
  return (
    <hr
      role="presentation"
      className={`${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
