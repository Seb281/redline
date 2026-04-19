/**
 * pdfjs worker registration, isolated to a single module so the worker URL
 * is resolved exactly once. Turbopack (Next.js 16 default bundler) rewrites
 * the `new URL(..., import.meta.url)` form into a hashed static asset.
 *
 * This file is client-only; importing it from a server component will throw
 * because pdfjs reaches for browser globals. `/redact/page.tsx` guards
 * against that by marking the tree `"use client"`.
 */

import { GlobalWorkerOptions } from "pdfjs-dist";

let registered = false;

/**
 * Ensures `GlobalWorkerOptions.workerSrc` is set once per session.
 * Safe to call repeatedly — second call is a no-op.
 */
export function registerPdfWorker(): void {
  if (registered) return;
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  registered = true;
}
