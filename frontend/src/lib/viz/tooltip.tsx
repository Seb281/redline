/**
 * Lightweight tooltip primitive for SVG-based data visualisations.
 *
 * Usage pattern:
 *   1. Wrap the `<svg>` in a `<div className="relative ...">`.
 *   2. Call `useSvgTooltip()` in the chart component.
 *   3. Wire `show` / `hide` to `onMouseEnter` / `onMouseLeave` (and
 *      `onFocus` / `onBlur`) on each interactive SVG element.
 *   4. Drop `<VizTooltip position={tooltip.position}>...</VizTooltip>`
 *      as a sibling of the `<svg>` inside the wrapper div.
 *
 * Accessibility: the tooltip is decorative (`pointer-events-none`).
 * Screen-reader users get context from `aria-label` attributes on the
 * focusable `<g>` elements — the caller is responsible for those labels.
 */

"use client";

import type { ReactNode } from "react";
import { useState, useCallback } from "react";

/** Position relative to the chart container's top-left corner (px). */
export interface TooltipPosition {
  x: number;
  y: number;
}

/** Return value of {@link useSvgTooltip}. */
export interface SvgTooltipState<T> {
  /** Current tooltip data, or `null` when hidden. */
  data: T | null;
  /** Show tooltip with `data` at the pointer/focus position. */
  show: (data: T, evt: React.MouseEvent | React.FocusEvent) => void;
  /** Hide tooltip. */
  hide: () => void;
  /** Pixel position relative to the container, or `null` when hidden. */
  position: TooltipPosition | null;
}

/**
 * Manages tooltip data and position state for an SVG chart.
 *
 * @template T - Shape of the data payload shown in the tooltip.
 */
export function useSvgTooltip<T>(): SvgTooltipState<T> {
  const [data, setData] = useState<T | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const show = useCallback(
    (payload: T, evt: React.MouseEvent | React.FocusEvent) => {
      // For mouse events, use clientX/Y; for focus events fall back to the
      // element's bounding rect centre so the tooltip appears near the element.
      let x: number;
      let y: number;
      const target = evt.currentTarget as Element;
      const containerEl = target.closest("[data-viz-container]") ?? target.parentElement;
      const containerRect = containerEl?.getBoundingClientRect() ?? { left: 0, top: 0 };

      if ("clientX" in evt) {
        x = evt.clientX - containerRect.left;
        y = evt.clientY - containerRect.top;
      } else {
        const rect = target.getBoundingClientRect();
        x = rect.left + rect.width / 2 - containerRect.left;
        y = rect.top - containerRect.top;
      }

      setData(payload);
      setPosition({ x, y });
    },
    [],
  );

  const hide = useCallback(() => {
    setData(null);
    setPosition(null);
  }, []);

  return { data, show, hide, position };
}

/** Props for {@link VizTooltip}. */
export interface VizTooltipProps {
  /** Position in px relative to the wrapping `relative` container. */
  position: TooltipPosition | null;
  /** Tooltip body — rendered verbatim inside the card. */
  children: ReactNode;
}

/**
 * Absolutely-positioned tooltip card. Drop it as a sibling of the `<svg>`
 * inside a `relative`-positioned wrapper div.
 *
 * The tooltip renders above the pointer by default (translated -100% Y) and
 * shifts horizontally to stay roughly centred on the cursor.
 */
export function VizTooltip({ position, children }: VizTooltipProps) {
  if (!position) return null;

  return (
    <div
      role="tooltip"
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        transform: "translate(-50%, calc(-100% - 8px))",
        pointerEvents: "none",
        zIndex: 10,
      }}
      className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded px-3 py-2 text-[13px] text-[var(--text-secondary)] shadow-sm whitespace-nowrap theme-transition"
    >
      {children}
    </div>
  );
}
