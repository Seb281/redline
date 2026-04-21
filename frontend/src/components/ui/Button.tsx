/**
 * Button — rectangular paper/ink-invert button.
 *
 * Variants:
 *   - primary : ink fill, paper text, ink border; hover lightens fill
 *   - ghost   : transparent fill, ink text, 1px ink border; hover paper-2
 *   - danger  : red border + red text, paper fill; hover inverts to red
 *   - link    : underline-on-hover plain link (kept as <button> semantics)
 *
 * No rounded corners (>2px), no drop shadow, 150ms ease transitions.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const BASE =
  "inline-flex items-center justify-center gap-2 font-sans font-medium border transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-paper border-ink hover:bg-ink-2 hover:border-ink-2",
  ghost:
    "bg-transparent text-ink border-ink hover:bg-paper-2",
  danger:
    "bg-paper text-red-accent border-red-accent hover:bg-red-accent hover:text-paper",
  link: "bg-transparent text-ink border-transparent hover:text-red-accent underline-offset-4 hover:underline px-0 py-0",
};

const SIZES: Record<Size, string> = {
  sm: "text-[12px] px-3 py-1.5",
  md: "text-[13px] px-4 py-2",
  lg: "text-[14px] px-5 py-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const sized = variant === "link" ? "" : SIZES[size];
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${sized} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
