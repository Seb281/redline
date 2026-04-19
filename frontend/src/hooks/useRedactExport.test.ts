/**
 * Integration tests for `useRedactExport` (Smart-only).
 *
 * The pipeline modules are used unmocked — they are already covered
 * by their own unit tests, and running them end-to-end inside the
 * hook catches bugs that pure-mock tests would miss (e.g. an off-by-
 * one between tokenize and span-matcher).
 *
 * `fetch` is stubbed for every test (Smart path always hits
 * `/api/analyze/overview`). The upload-stage / extract-stage tests
 * stub with a minimal 200 response because validation fails before
 * the fetch fires, but the stub keeps them deterministic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRedactExport } from "./useRedactExport";
import {
  buildSinglePagePdf,
  buildScannedPdf,
} from "@/test-fixtures/redact/build-fixtures";

const originalFetch = globalThis.fetch;

/** Default Pass 0 stub: returns a single party matching the fixture. */
function stubOverviewOk() {
  globalThis.fetch = vi.fn(async () =>
    new Response(
      JSON.stringify({
        overview: {
          parties: [{ name: "Acme BV", role_label: "Provider" }],
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  ) as typeof fetch;
}

beforeEach(() => {
  stubOverviewOk();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function fileFrom(bytes: ArrayBuffer, name = "contract.pdf", mime = "application/pdf"): File {
  return new File([bytes], name, { type: mime });
}

describe("useRedactExport", () => {
  it("runs idle → extracting → running_overview → awaiting_preview on happy path", async () => {
    const bytes = await buildSinglePagePdf({
      names: ["Acme BV"],
      emails: ["hello@acme.test"],
    });
    const { result } = renderHook(() => useRedactExport());
    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.start(fileFrom(bytes));
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
      await result.current.start(fileFrom(bytes));
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
      await result.current.start(file);
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
      await result.current.start(file);
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error?.stage).toBe("upload");
  });

  it("routes scanned PDFs to the extract stage error", async () => {
    const bytes = await buildScannedPdf();
    const { result } = renderHook(() => useRedactExport());
    await act(async () => {
      await result.current.start(fileFrom(bytes));
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error?.stage).toBe("extract");
  });

  it("raises an overview-stage error on Pass 0 failure — no silent fallback", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("down", { status: 500 }),
    ) as typeof fetch;
    const bytes = await buildSinglePagePdf({
      names: ["Acme BV"],
      emails: ["hello@acme.test"],
    });
    const { result } = renderHook(() => useRedactExport());
    await act(async () => {
      await result.current.start(fileFrom(bytes));
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.stage).toBe("overview");
    expect(result.current.error?.recoverable).toBe(true);
    expect(result.current.preview).toBeNull();
  });

  it("retryOverview recovers from a transient Pass 0 failure without re-extracting", async () => {
    // First call: 500. Second call: 200. The hook keeps the
    // extracted PDF cached so the user can retry without re-uploading.
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) return new Response("down", { status: 500 });
      return new Response(
        JSON.stringify({
          overview: { parties: [{ name: "Acme BV", role_label: "Provider" }] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const bytes = await buildSinglePagePdf({
      names: ["Acme BV"],
      emails: ["hello@acme.test"],
    });
    const { result } = renderHook(() => useRedactExport());
    await act(async () => {
      await result.current.start(fileFrom(bytes));
    });
    await waitFor(() => expect(result.current.status).toBe("error"));

    await act(async () => {
      await result.current.retryOverview();
    });
    await waitFor(() =>
      expect(result.current.status).toBe("awaiting_preview"),
    );
    expect(result.current.preview?.tokens.length).toBeGreaterThan(0);
    // Two overview calls total — extract only ran once.
    expect(calls).toBe(2);
  });

  it("retryOverview is a no-op when no extracted PDF is cached", async () => {
    const { result } = renderHook(() => useRedactExport());
    await act(async () => {
      await result.current.retryOverview();
    });
    expect(result.current.status).toBe("idle");
  });

  it("surfaces a sensitive-kind SkippedMatch into result.skipped", async () => {
    // Pass 0 reports a party name that the PDF body does NOT contain.
    // `tokenizeForPdf` emits a synthetic SkippedMatch for unmatched
    // parties; the hook must merge it into `result.skipped` so the
    // download-gating banner trips on a sensitive kind. This is the
    // full privacy chain — tokenize → hook → result.skipped.
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
      await result.current.start(fileFrom(bytes));
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
      await result.current.start(fileFrom(bytes));
    });
    await waitFor(() => expect(result.current.status).toBe("awaiting_preview"));
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(result.current.preview).toBeNull();
    expect(result.current.result).toBeNull();
  });
});
