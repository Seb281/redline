/**
 * PageShell — the only place the app sets a page max-width.
 *
 * Every route wraps its content in a `<PageShell>` so the editorial
 * density is explicit per page. The previous layout pinned the body to
 * `max-w-4xl` (896px) globally; the redesign needs 1200–1600px on most
 * screens, so this component owns the decision per page.
 *
 * Widths map to the handoff's documented maxima:
 *   - "sm"   : 760px  — auth / privacy prose
 *   - "md"   : 1200px — landing / account / history
 *   - "lg"   : 1440px — report
 *   - "xl"   : 1600px — report with chat dock / compare
 *   - "full" : no cap — pipeline visualisation
 */

import type { HTMLAttributes, ReactNode } from "react";

type Width = "sm" | "md" | "lg" | "xl" | "full";

const WIDTHS: Record<Width, string> = {
  sm: "max-w-[760px]",
  md: "max-w-[1200px]",
  lg: "max-w-[1440px]",
  xl: "max-w-[1600px]",
  full: "max-w-none",
};

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  width?: Width;
  children: ReactNode;
}

export function PageShell({
  width = "md",
  className = "",
  children,
  ...rest
}: PageShellProps) {
  return (
    <div
      className={`${WIDTHS[width]} mx-auto w-full px-6 md:px-10 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
