/**
 * Unit tests for `extractPdf`.
 *
 * Fixtures are built in-memory with pdf-lib at known coordinates
 * (`buildSinglePagePdf`, `buildMultiPagePdf`, `buildScannedPdf`) so
 * assertions compare against exact inputs without a full renderer
 * round-trip.
 *
 * Coordinate tolerance: pdfjs reports glyph boxes from font metrics;
 * the reported `x` / `y` match what pdf-lib's `drawText` used as
 * origin within a few tenths of a point in practice. Tests use a
 * liberal tolerance so they do not break on minor pdfjs upgrades.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { extractPdf } from "./pdf-extract";
import {
  buildSinglePagePdf,
  buildMultiPagePdf,
  buildScannedPdf,
  buildSplitEmailPdf,
} from "@/test-fixtures/redact/build-fixtures";
import { collectPatternRanges } from "./tokenize-for-pdf";
import { findMatches } from "./span-matcher";

describe("extractPdf", () => {
  let singleBytes: ArrayBuffer;
  let multiBytes: ArrayBuffer;
  let scannedBytes: ArrayBuffer;

  beforeAll(async () => {
    singleBytes = await buildSinglePagePdf({
      names: ["Acme BV"],
      emails: ["hello@acme.test"],
    });
    multiBytes = await buildMultiPagePdf();
    scannedBytes = await buildScannedPdf();
  });

  it("extracts fullText and spans from a single-page PDF", async () => {
    const out = await extractPdf(singleBytes);
    expect(out.pageCount).toBe(1);
    expect(out.fullText).toContain("Acme BV");
    expect(out.fullText).toContain("hello@acme.test");
    expect(out.spans.length).toBeGreaterThan(0);
    // Every span's char range maps onto fullText.
    for (const s of out.spans) {
      expect(out.fullText.slice(s.charStart, s.charEnd)).toBe(s.text);
    }
    // Returned bytes are the same ArrayBuffer the caller handed in.
    expect(out.bytes).toBe(singleBytes);
  });

  it("reports two pages for a multi-page fixture with page-2 token", async () => {
    const out = await extractPdf(multiBytes);
    expect(out.pageCount).toBe(2);
    const page2Spans = out.spans.filter((s) => s.page === 2);
    expect(page2Spans.length).toBeGreaterThan(0);
    expect(out.fullText).toContain("support@acme.test");
  });

  it("returns empty text for a scanned (image-only) PDF", async () => {
    const out = await extractPdf(scannedBytes);
    // No text items means fullText is whatever separators we insert
    // per page/item — it stays under the 50-char hook threshold.
    expect(out.fullText.trim().length).toBe(0);
    expect(out.spans.length).toBe(0);
  });

  it("positions text runs within tolerance of the drawing origin", async () => {
    const out = await extractPdf(singleBytes);
    // The name was drawn at y = 800; pdfjs should report a span
    // whose `y` is within a few points of that origin.
    const nameSpan = out.spans.find((s) => s.text === "Acme BV");
    expect(nameSpan).toBeDefined();
    expect(Math.abs((nameSpan?.x ?? 0) - 50)).toBeLessThan(3);
    expect(Math.abs((nameSpan?.y ?? 0) - 800)).toBeLessThan(3);
  });

  it("joins intra-line items without \\n so tokens spanning items still match", async () => {
    // Fixture draws "hello" and "@acme.test" as two adjacent draw
    // calls on the same visual line. Before Fix #3, extractPdf
    // inserted "\n" between every pdfjs TextItem and the email regex
    // — which does not match "\n" — silently failed to find the
    // token, leaving the email unredacted.
    const bytes = await buildSplitEmailPdf();
    const out = await extractPdf(bytes);
    // The two items must concatenate directly in fullText.
    expect(out.fullText).toContain("hello@acme.test");

    // End-to-end: the pattern helper must find the email, and the
    // span-matcher must produce at least one coordinate match — no
    // skipped-match, the overlay will cover the token.
    const tokens = collectPatternRanges(out.fullText);
    const email = tokens.find((t) => t.kind === "EMAIL");
    expect(email).toBeDefined();
    const matched = findMatches(tokens, out.spans);
    expect(matched.matches.length).toBeGreaterThan(0);
    expect(matched.skipped.filter((s) => s.kind === "EMAIL")).toHaveLength(0);
  });

  it("rethrows parse failures as PdfExtractError", async () => {
    const garbage = new TextEncoder().encode("not a pdf at all").buffer;
    await expect(extractPdf(garbage)).rejects.toMatchObject({
      name: "PdfExtractError",
    });
  });
});
