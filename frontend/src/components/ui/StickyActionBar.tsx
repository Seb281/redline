/**
 * StickyActionBar — bottom-fixed paper bar with 1px ink top border.
 *
 * Used for screens with aggregate counts + primary CTAs (Compare,
 * History, Account destructive). Two slots: left (aggregate / meta)
 * and right (actions). The bar renders `position: sticky` inside its
 * scrolling container and `backdrop-blur` to keep paper feel when
 * overlapping content.
 */

import type { ReactNode } from "react";

export interface StickyActionBarProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function StickyActionBar({
  left,
  right,
  className = "",
}: StickyActionBarProps) {
  return (
    <div
      className={`sticky bottom-0 left-0 right-0 z-40 border-t border-ink bg-paper/95 backdrop-blur-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-6 px-6 py-3">
        <div className="flex items-center gap-4 t-mono-label text-ink-muted">
          {left}
        </div>
        <div className="flex items-center gap-3">{right}</div>
      </div>
    </div>
  );
}
