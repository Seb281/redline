/**
 * BrandMark — the Redline wordmark preceded by a 2px × 20px red
 * vertical bar. This is the only mandatory use of the red accent.
 */

import Link from "next/link";

export interface BrandMarkProps {
  /** Wraps in a link to `/`. Defaults true for the header. */
  asLink?: boolean;
  className?: string;
}

export function BrandMark({ asLink = true, className = "" }: BrandMarkProps) {
  const content = (
    <span
      className={`inline-flex items-center gap-2.5 font-serif text-[22px] leading-none tracking-[-0.02em] text-ink ${className}`}
    >
      <span aria-hidden className="inline-block h-5 w-[2px] bg-red-accent" />
      <span>Redline</span>
    </span>
  );

  if (!asLink) return content;
  return (
    <Link href="/" aria-label="Redline — home" className="inline-flex">
      {content}
    </Link>
  );
}
