/**
 * Integration tests for `useRedactExport`.
 *
 * The pipeline modules are used unmocked — they are already covered
 * by their own unit tests, and running them end-to-end inside the
 * hook catches bugs that pure-mock tests would miss (e.g. an off-by-
 * one between tokenize and span-matcher).
 *
 * `fetch` is stubbed only for the Smart-mode fallback test.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRedactExport } from "./useRedactExport";
import {
  buildSinglePagePdf,
  buildScannedPdf,
} from "@/test-fixtures/redact/build-fixtures";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function fileFrom(bytes: ArrayBuffer, name = "contract.pdf", mime = "application/pdf"): File {
  return new File([bytes], name, { type: mime });
}

describe("useRedactExport", () => {
  it("runs idle → extracting → awaiting_preview on Quick mode happy path", async () => {
    const bytes = await buildSinglePagePdf({
      names: ["Acme BV"],
      emails: ["hello@acme.test"],
    });
    const { result } = renderHook(() => useRedactExport());
    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.start(fileFrom(bytes), "quick");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("awaiting_preview");
    });
    expect(result.current.preview).not.toBeNull();
    expect(result.current.preview!.tokens.length).toBeGreaterThan(0);
  });

  it("confirmPreview produces a complete state with a Blob", async () => {
    const bytes = await buildSinglePagePdf({
      names: ["Acme BV"],
      emails: ["hello@acme.test"],
    });
    const { result } = renderHook(() => useRedactExport());
    await act(async () => {
      await result.current.start(fileFrom(bytes), "quick");
    });
    await waitFor(() => expect(result.current.status).toBe("awaiting_preview"));

    await act(async () => {
      await result.current.confirmPreview(new Set());
    });

    await waitFor(() => expect(result.current.status).toBe("complete"));
    expect(result.current.result).not.toBeNull();
    expect(result.current.result!.blob.type).toBe("application/pdf");
    expect(result.current.result!.filename).toBe("contract-redacted.pdf");
    expect(result.current.result!.matchesByKind.EMAIL).toBeGreaterThan(0);
  });

  it("rejects non-PDF mimetypes with an upload-stage error", async () => {
    const { result } = renderHook(() => useRedactExport());
    const file = new File(["<html/>"], "foo.html", { type: "text/html" });
    await act(async () => {
      await result.current.start(file, "quick");
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error?.stage).toBe("upload");
  });

  it("rejects oversize files with an upload-stage error", async () => {
    const { result } = renderHook(() => useRedactExport());
    // Build a fake PDF-mime file with a buffer over 10MB — we never
    // parse it because the size check fails first.
    const big = new Uint8Array(11 * 1024 * 1024);
    const file = new File([big], "big.pdf", { type: "application/pdf" });
    await act(async () => {
      await result.current.start(file, "quick");
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error?.stage).toBe("upload");
  });

  it("routes scanned PDFs to the extract stage error", async () => {
    const bytes = await buildScannedPdf();
    const { result } = renderHook(() => useRedactExport());
    await act(async () => {
      await result.current.start(fileFrom(bytes), "quick");
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error?.stage).toBe("extract");
  });

  it("falls back to quick + sets smartFallbackNotice on overview failure", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("down", { status: 500 }),
    ) as typeof fetch;
    const bytes = await buildSinglePagePdf({
      names: ["Acme BV"],
      emails: ["hello@acme.test"],
    });
    const { result } = renderHook(() => useRedactExport());
    await act(async () => {
      await result.current.start(fileFrom(bytes), "smart");
    });
    await waitFor(() => expect(result.current.status).toBe("awaiting_preview"));
    expect(result.current.smartFallbackNotice).toBe(true);
    expect(result.current.preview?.tokens.length).toBeGreaterThan(0);
  });

  it("surfaces a sensitive-kind SkippedMatch into result.skipped", async () => {
    // Smart-mode scenario: Pass 0 reports a party name that the PDF
    // body does NOT contain. Fix #4 causes `smartTokenize` to emit a
    // synthetic SkippedMatch for unmatched parties; the hook must
    // merge it into `result.skipped` so the download-gating banner
    // trips on a sensitive kind. This is the full privacy chain —
    // tokenize → hook → result.skipped.
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          overview: {
            parties: [{ name: "Ghost Ltd", role_label: "Counterparty" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;
    const bytes = await buildSinglePagePdf({
      names: ["Acme BV"],
      emails: ["hello@acme.test"],
    });
    const { result } = renderHook(() => useRedactExport());
    await act(async () => {
      await result.current.start(fileFrom(bytes), "smart");
    });
    await waitFor(() =>
      expect(result.current.status).toBe("awaiting_preview"),
    );

    await act(async () => {
      await result.current.confirmPreview(new Set());
    });
    await waitFor(() => expect(result.current.status).toBe("complete"));

    expect(result.current.result).not.toBeNull();
    const skipped = result.current.result!.skipped;
    // At least one skipped entry, with the correct sensitive kind
    // (ORG — `"Ghost Ltd"` ends with an org suffix).
    const ghost = skipped.find((s) => s.original === "Ghost Ltd");
    expect(ghost).toBeDefined();
    expect(ghost?.kind).toBe("ORG");
    expect(ghost?.label).toBe("[Counterparty]");
  });

  it("reset clears state back to idle", async () => {
    const bytes = await buildSinglePagePdf({
      names: ["Acme BV"],
      emails: ["hello@acme.test"],
    });
    const { result } = renderHook(() => useRedactExport());
    await act(async () => {
      await result.current.start(fileFrom(bytes), "quick");
    });
    await waitFor(() => expect(result.current.status).toBe("awaiting_preview"));
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(result.current.preview).toBeNull();
    expect(result.current.result).toBeNull();
  });
});
