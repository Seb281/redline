/**
 * Phase 0 smoke test. Guards against the most common pdfjs failure modes
 * under the Next.js 16 / vitest / jsdom setup:
 *
 *  1. The ESM import throws before any test can run (missing inline).
 *  2. The worker registrar resolves a non-string URL.
 *  3. The barrel re-exports the wrong symbol names, silently breaking
 *     consumers in Phase 1.
 */

import { describe, it, expect, vi } from "vitest";

describe("redact-export: Phase 0 smoke", () => {
  it("barrel exports the public surface", async () => {
    const mod = await import("./index");
    expect(mod).toHaveProperty("registerPdfWorker");
    expect(mod).toHaveProperty("SENSITIVE_KINDS");
    expect(typeof mod.registerPdfWorker).toBe("function");
    expect(mod.SENSITIVE_KINDS.has("PERSON")).toBe(true);
    expect(mod.SENSITIVE_KINDS.has("DATE")).toBe(false);
  });

  it("registerPdfWorker sets GlobalWorkerOptions.workerSrc exactly once", async () => {
    const { registerPdfWorker } = await import("./pdf-worker");
    const { GlobalWorkerOptions } = await import("pdfjs-dist");

    registerPdfWorker();
    const firstSrc = GlobalWorkerOptions.workerSrc;
    expect(typeof firstSrc).toBe("string");
    expect(firstSrc).toContain("pdf.worker");

    // Mutate the "set-once" flag by calling again; src should remain stable.
    const spy = vi.fn();
    Object.defineProperty(GlobalWorkerOptions, "workerSrc", {
      configurable: true,
      get: () => firstSrc,
      set: spy,
    });
    registerPdfWorker();
    expect(spy).not.toHaveBeenCalled();
  });
});
