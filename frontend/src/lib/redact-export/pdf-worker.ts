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
 *
 * In a real browser (Turbopack build), `new URL(..., import.meta.url)`
 * rewrites to a hashed static asset URL. Under vitest + jsdom, the
 * same form resolves against jsdom's `http://localhost/` origin, which
 * Node's ESM dynamic import rejects with an "unsupported scheme"
 * error. We detect the jsdom case and substitute a `file://` URL that
 * points at the on-disk legacy worker so the fake-worker fallback can
 * import it successfully.
 */
export function registerPdfWorker(): void {
  if (registered) return;
  const browserUrl = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  GlobalWorkerOptions.workerSrc = isNodeTest(browserUrl)
    ? resolveNodeWorkerUrl()
    : browserUrl;
  registered = true;
}

/**
 * True when we're running in a Node-based test harness that jsdom is
 * pretending to be a browser for. `import.meta.url` resolved to an
 * `http:` URL is the fingerprint — a real browser would have a
 * `blob:` or `https://` URL emitted by the bundler.
 */
function isNodeTest(browserUrl: string): boolean {
  if (typeof process === "undefined") return false;
  return browserUrl.startsWith("http:") || browserUrl.startsWith("https:");
}

/**
 * Build a `file://` URL to the legacy pdfjs worker on disk. We use
 * Node's `path` + `url` modules via require to avoid pulling them
 * into the browser bundle — the conditional above ensures this path
 * never runs in real browsers.
 */
function resolveNodeWorkerUrl(): string {
  // Dynamic require keeps the static bundler from trying to resolve
  // `node:path` in the browser build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { pathToFileURL } = require("node:url") as typeof import("node:url");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("node:path") as typeof import("node:path");
  const workerPath = path.resolve(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  );
  return pathToFileURL(workerPath).href;
}
