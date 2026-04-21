/**
 * Crumbs — mono uppercase breadcrumb trail.
 *
 * Ordered list of path segments; the `current` entry is rendered in
 * `--red`, earlier entries in muted ink, separators as light slashes.
 * Non-current entries may optionally link.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export interface Crumb {
  label: ReactNode;
  href?: string;
}

export interface CrumbsProps {
  items: Crumb[];
  /** Index of the currently-active crumb. Defaults to last. */
  currentIndex?: number;
  className?: string;
}

export function Crumbs({ items, currentIndex, className = "" }: CrumbsProps) {
  const current = currentIndex ?? items.length - 1;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-2 t-mono-label">
        {items.map((item, index) => {
          const isCurrent = index === current;
          const tone = isCurrent
            ? "text-red-accent"
            : index < current
              ? "text-ink-muted"
              : "text-ink-3";
          return (
            <li key={index} className="flex items-center gap-2">
              {item.href && !isCurrent ? (
                <Link href={item.href} className={`${tone} hover:text-ink`}>
                  {item.label}
                </Link>
              ) : (
                <span className={tone} aria-current={isCurrent ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {index < items.length - 1 ? (
                <span aria-hidden className="text-paper-edge">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
