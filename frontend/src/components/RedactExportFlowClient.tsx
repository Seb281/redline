/**
 * Client-side wrapper that loads RedactExportFlow with ssr:false.
 *
 * WHY this exists as a separate file:
 * Next.js 16 enforces that `next/dynamic` with `ssr: false` must live
 * inside a Client Component — it cannot be called from a Server Component
 * (the default for page.tsx files). This thin wrapper is the Client
 * Component boundary that makes the dynamic import valid.
 *
 * The ssr:false flag prevents pdfjs-dist from being evaluated on the
 * server. pdfjs touches browser globals (DOMMatrix, Path2D) at module
 * load time, which crashes server-side rendering even when the actual
 * pdfjs calls only happen on user interaction.
 */

"use client";

import dynamic from "next/dynamic";

export const RedactExportFlowClient = dynamic(
  () =>
    import("@/components/RedactExportFlow").then((m) => m.RedactExportFlow),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />
      </div>
    ),
  },
);
