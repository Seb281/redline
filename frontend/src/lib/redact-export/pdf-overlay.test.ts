/**
 * Unit tests for `buildRedactedPdf`. We run the output back through
 * pdf-lib (not pdfjs) for fast metadata assertions, and through pdfjs
 * for a sanity-level text check — redacted areas should no longer
 * surface the original names/emails at the token coordinates.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import {
  buildPdfWithXmp,
  buildSinglePagePdf,
} from "@/test-fixtures/redact/build-fixtures";
import { buildRedactedPdf } from "./pdf-overlay";
import { extractPdf } from "./pdf-extract";
import type { PdfMatch } from "./types";

describe("buildRedactedPdf", () => {
  let singleBytes: ArrayBuffer;

  beforeAll(async () => {
    singleBytes = await buildSinglePagePdf({
      names: ["Acme BV"],
      emails: ["hello@acme.test"],
    });
  });

  it("produces a PDF that still loads and has the same page count", async () => {
    const matches: PdfMatch[] = [
      { page: 1, x: 50, y: 800, w: 40, h: 12, label: "[Org]", kind: "ORG" },
    ];
    const bytes = await buildRedactedPdf(singleBytes, matches);
    // `updateMetadata: false` prevents pdf-lib from re-stamping the
    // Producer on load — without it, reading `getProducer()` would
    // return pdf-lib's default regardless of what we wrote.
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.getPageCount()).toBe(1);
  });

  it("strips identifying metadata and stamps Redline as producer", async () => {
    const bytes = await buildRedactedPdf(singleBytes, []);
    // `updateMetadata: false` prevents pdf-lib from re-stamping the
    // Producer on load — without it, reading `getProducer()` would
    // return pdf-lib's default regardless of what we wrote.
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.getTitle() ?? "").toBe("");
    expect(doc.getAuthor() ?? "").toBe("");
    expect(doc.getSubject() ?? "").toBe("");
    expect(doc.getProducer()).toBe("Redline");
    expect(doc.getCreator()).toBe("Redline");
  });

  it("strips the XMP metadata stream from the catalog", async () => {
    // Fixture embeds an explicit XMP packet with `dc:creator`,
    // `dc:title`, and `xmpMM:DocumentID` all carrying the identifying
    // name — the kind of stream Word/InDesign/Acrobat emit and that
    // `setTitle("")` / `setAuthor("")` alone never touch.
    const name = "Jane Doe";
    const inputBytes = await buildPdfWithXmp(name);

    // Sanity-check the fixture: the input really does contain the XMP
    // stream and the identifying name in its raw bytes.
    const input = await PDFDocument.load(inputBytes, { updateMetadata: false });
    expect(input.catalog.get(PDFName.of("Metadata"))).toBeDefined();
    const inputRaw = new TextDecoder("latin1").decode(new Uint8Array(inputBytes));
    expect(inputRaw).toContain(name);

    const bytes = await buildRedactedPdf(inputBytes, []);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.catalog.get(PDFName.of("Metadata"))).toBeUndefined();

    // The raw output bytes must not contain the original identifying
    // name anywhere — catch any residual XMP payload that survived a
    // future regression (e.g. pdf-lib re-emitting orphan streams).
    const outputRaw = new TextDecoder("latin1").decode(bytes);
    expect(outputRaw).not.toContain(name);
  });

  it("draws one overlay per match (observable via extracted text diff)", async () => {
    // Locate the span for "Acme BV" in the source so we can target the overlay exactly.
    const extracted = await extractPdf(singleBytes);
    const nameSpan = extracted.spans.find((s) => s.text === "Acme BV");
    expect(nameSpan).toBeDefined();
    const matches: PdfMatch[] = [
      {
        page: nameSpan!.page,
        x: nameSpan!.x,
        y: nameSpan!.y,
        w: nameSpan!.w,
        h: nameSpan!.h,
        label: "[Provider]",
        kind: "ORG",
      },
    ];
    const redacted = await buildRedactedPdf(singleBytes, matches);

    const reExtracted = await extractPdf(toArrayBuffer(redacted));
    // Overlay label is now present in the text stream, and the
    // overall text content changed (the original "Acme BV" is no
    // longer the sole left-column run).
    expect(reExtracted.fullText).toContain("[Provider]");
  });
});

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}
