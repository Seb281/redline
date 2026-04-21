/**
 * Masthead — the editorial page header used on every route.
 *
 * Composition (top to bottom):
 *   1. Optional mono meta row (e.g. "UPLOAD / 04.2026 / v0.9")
 *   2. Fraunces H1 title with optional italic red accent
 *   3. Optional Newsreader lede paragraph
 *   4. 2px ink bottom border
 *   5. Optional standfirst grid of kicker/value cells
 *
 * Widths are not enforced here — wrap in `<PageShell>` to control max-w.
 */

import type { ReactNode } from "react";
import { MonoLabel } from "./MonoLabel";

export interface StandfirstCell {
  kicker: ReactNode;
  value: ReactNode;
}

export interface MastheadProps {
  /** Uppercase mono meta ribbon above the title. */
  meta?: ReactNode;
  /** Main H1 — serif, large. */
  title: ReactNode;
  /** Optional lede paragraph under the title (Newsreader). */
  lede?: ReactNode;
  /** Optional 2-to-6-cell standfirst grid below the 2px rule. */
  standfirst?: StandfirstCell[];
  /** Heading level override (keep as h1 for primary page masthead). */
  as?: "h1" | "h2";
  className?: string;
}

export function Masthead({
  meta,
  title,
  lede,
  standfirst,
  as: Tag = "h1",
  className = "",
}: MastheadProps) {
  return (
    <header className={`pt-10 md:pt-14 ${className}`}>
      {meta ? (
        <div className="mb-4">
          <MonoLabel tone="muted">{meta}</MonoLabel>
        </div>
      ) : null}
      <Tag className="t-masthead-h1 text-ink m-0 max-w-[22ch]">{title}</Tag>
      {lede ? (
        <p className="t-lede text-ink-2 mt-5 max-w-[58ch]">{lede}</p>
      ) : null}
      <div
        aria-hidden
        className="mt-8 border-b-2 border-ink"
      />
      {standfirst && standfirst.length > 0 ? (
        <dl
          className="mt-5 grid gap-x-8 gap-y-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(standfirst.length, 6)}, minmax(0, 1fr))`,
          }}
        >
          {standfirst.map((cell, index) => (
            <div key={index} className="flex flex-col gap-1">
              <dt>
                <MonoLabel tone="muted">{cell.kicker}</MonoLabel>
              </dt>
              <dd className="font-serif text-[22px] leading-tight text-ink m-0">
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}
