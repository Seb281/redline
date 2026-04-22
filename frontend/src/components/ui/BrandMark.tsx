/**
 * BrandMark — the Redline wordmark preceded by a 20px × 3px red
 * horizontal dash. Matches the favicon (`app/icon.svg` is a single
 * horizontal red rule) and the original product mark.
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
      <span aria-hidden className="inline-block h-[3px] w-5 bg-red-accent" />
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
