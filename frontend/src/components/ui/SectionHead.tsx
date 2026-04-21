/**
 * SectionHead — editorial H2 block.
 *
 * Renders an 11px mono uppercase label on a 1px ink bottom rule, with
 * optional serif number (e.g. "§ 02") on the left and optional mono
 * meta on the right. Emits a proper `<h2>` so screen readers preserve
 * the document outline.
 */

import type { ReactNode } from "react";
import { MonoLabel } from "./MonoLabel";

export interface SectionHeadProps {
  /** Optional leading serif numeral — e.g. "§ 02" or "1". */
  number?: ReactNode;
  /** Main label, always mono uppercase. */
  children: ReactNode;
  /** Optional right-aligned meta (counts, statuses). */
  meta?: ReactNode;
  /** Heading level override for correct document outline. */
  as?: "h2" | "h3";
  className?: string;
}

export function SectionHead({
  number,
  children,
  meta,
  as: Tag = "h2",
  className = "",
}: SectionHeadProps) {
  return (
    <div
      className={`flex items-end justify-between gap-6 border-b border-ink pb-2 ${className}`}
    >
      <div className="flex items-baseline gap-3">
        {number ? (
          <span className="font-serif text-[28px] leading-none text-ink">
            {number}
          </span>
        ) : null}
        <Tag className="t-sh text-ink m-0">{children}</Tag>
      </div>
      {meta ? <MonoLabel tone="muted">{meta}</MonoLabel> : null}
    </div>
  );
}
