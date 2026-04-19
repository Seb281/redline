/**
 * In-memory PDF fixture builders for the SP-3 redact-export tests.
 *
 * Binary PDFs are not checked into the repo — small changes to
 * pdf-lib or fonts produce large diffs and make the fixtures hard to
 * trust. Instead, tests build PDFs on the fly with known coordinates
 * so assertions reference the exact inputs.
 *
 * All builders return ArrayBuffers ready to hand to `extractPdf`.
 */

import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { TokenRange, PdfSpan } from "@/lib/redact-export/types";

export interface SinglePageOpts {
  names?: string[];
  emails?: string[];
}

/**
 * One-page A4 PDF with names stacked on the left half and emails on
 * the right half. Each run starts at a known y coordinate (stepped
 * down by 20pt) so tests can assert coordinates within tolerance
 * without running a full PDF renderer.
 */
export async function buildSinglePagePdf(
  opts: SinglePageOpts = {},
): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const names = opts.names ?? ["Acme BV"];
  const emails = opts.emails ?? ["hello@acme.test"];

  let y = 800;
  for (const n of names) {
    page.drawText(n, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
    y -= 20;
  }
  y = 800;
  for (const e of emails) {
    page.drawText(e, { x: 300, y, size: 12, font, color: rgb(0, 0, 0) });
    y -= 20;
  }
  // Filler so the overall text passes the 50-char scan-threshold in
  // the hook's extract stage.
  page.drawText(
    "This is a sample contract used only for redaction pipeline tests.",
    { x: 50, y: 700, size: 10, font, color: rgb(0, 0, 0) },
  );

  const bytes = await doc.save();
  return toArrayBuffer(bytes);
}

/**
 * Two-page PDF where page 2 carries a token not present on page 1.
 * Drives the cross-page branch of the span-matcher + overlay.
 */
export async function buildMultiPagePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const page1 = doc.addPage([595, 842]);
  page1.drawText("Parties list below.", {
    x: 50,
    y: 800,
    size: 12,
    font,
  });
  page1.drawText("Acme BV is the provider under this contract.", {
    x: 50,
    y: 780,
    size: 12,
    font,
  });

  const page2 = doc.addPage([595, 842]);
  page2.drawText("Contact: support@acme.test for issues.", {
    x: 50,
    y: 800,
    size: 12,
    font,
  });

  const bytes = await doc.save();
  return toArrayBuffer(bytes);
}

/**
 * Scanned-PDF stand-in: a PDF with no text operators, only a raw
 * drawing. `extractPdf` returns an empty `fullText` for this, which
 * the hook translates to the `scanned` extract error.
 */
export async function buildScannedPdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  // Draw a visible rectangle only — no text ops, so pdfjs returns
  // no items.
  page.drawRectangle({
    x: 100,
    y: 100,
    width: 50,
    height: 50,
    color: rgb(0.8, 0.8, 0.8),
  });
  const bytes = await doc.save();
  return toArrayBuffer(bytes);
}

/**
 * Build a one-page PDF where a single visible email is drawn as two
 * adjacent `drawText` calls ("hello" + "@acme.test") positioned so
 * they visually abut on the same line. pdfjs parses this as two
 * separate TextItems on the same line (`hasEOL === false`), exercising
 * the Fix #3 branch of `pdf-extract` — intra-line items joined without
 * a "\n" so the email regex can still match across the item boundary.
 *
 * Coordinates: "hello" is drawn at (50, 800) with 12pt Helvetica
 * (~34pt wide at that size). The second chunk is drawn at (84, 800)
 * so the glyph origins stand ~0.5pt apart visually while remaining two
 * TextItems at the pdfjs layer.
 */
export async function buildSplitEmailPdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Two adjacent draw calls positioned so the second starts exactly
  // where the first visually ends — no gap (pdfjs would otherwise
  // synthesise a " " between items when the horizontal gap exceeds
  // ~25% of a font-size), yet they remain two distinct TextItems at
  // the pdfjs layer. The filler underneath pushes the raw fullText
  // over the 50-char gate used by the hook.
  const size = 12;
  const leftText = "hello";
  const leftX = 50;
  const leftWidth = font.widthOfTextAtSize(leftText, size);
  page.drawText(leftText, { x: leftX, y: 800, size, font });
  page.drawText("@acme.test", {
    x: leftX + leftWidth,
    y: 800,
    size,
    font,
  });
  page.drawText(
    "Filler line used only to clear the 50-char extract threshold.",
    { x: 50, y: 780, size: 10, font },
  );
  const bytes = await doc.save();
  return toArrayBuffer(bytes);
}

/**
 * Build a one-page PDF that carries both a Title/Author in the /Info
 * dict AND an explicit XMP metadata stream attached to the catalog
 * under /Metadata. Mirrors what Office suites (Word, InDesign,
 * Acrobat) produce on export — their XMP stream duplicates the author
 * / creator / document id fields, which pdf-lib's `setTitle("")` and
 * friends never touch.
 *
 * Tests feed this fixture into `buildRedactedPdf` to prove the overlay
 * strips the XMP reference entirely, not just the /Info entries.
 */
export async function buildPdfWithXmp(
  identifyingName = "Jane Doe",
): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Body text used only to pass the 50-char extract gate.", {
    x: 50,
    y: 800,
    size: 12,
    font,
  });
  doc.setTitle(identifyingName);
  doc.setAuthor(identifyingName);

  // XMP packet mimicking Word/InDesign/Acrobat output: dc:creator plus
  // xmpMM:DocumentID, both duplicating the identifying name so the
  // test can assert the raw bytes no longer contain it after overlay.
  const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/">
      <dc:creator><rdf:Seq><rdf:li>${identifyingName}</rdf:li></rdf:Seq></dc:creator>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${identifyingName}</rdf:li></rdf:Alt></dc:title>
      <xmpMM:DocumentID>uuid:${identifyingName.replace(/\s+/g, "-")}-doc-id</xmpMM:DocumentID>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  const xmpBytes = new TextEncoder().encode(xmp);
  const streamDict = PDFDict.withContext(doc.context);
  streamDict.set(PDFName.of("Type"), PDFName.of("Metadata"));
  streamDict.set(PDFName.of("Subtype"), PDFName.of("XML"));
  streamDict.set(PDFName.of("Length"), doc.context.obj(xmpBytes.length));
  const stream = PDFRawStream.of(streamDict, xmpBytes);
  const ref = doc.context.register(stream);
  doc.catalog.set(PDFName.of("Metadata"), ref);

  const bytes = await doc.save();
  return toArrayBuffer(bytes);
}

/**
 * Return an `ExtractedPdf`-like fragment with one token whose char
 * range is deliberately past the end of `fullText`. Feeds the
 * span-matcher a situation where a sensitive-kind token cannot be
 * mapped to any glyph box — the expected outcome is a `SkippedMatch`,
 * which the hook must surface in `result.skipped`.
 */
export function buildUnmappedSensitiveTokens(): {
  fullText: string;
  spans: PdfSpan[];
  tokens: TokenRange[];
} {
  const fullText = "hello world";
  const spans: PdfSpan[] = [
    {
      page: 1,
      x: 50,
      y: 800,
      w: 40,
      h: 12,
      charStart: 0,
      charEnd: fullText.length,
      text: fullText,
    },
  ];
  const tokens: TokenRange[] = [
    {
      // Range past the end of fullText => no span intersects.
      start: fullText.length + 5,
      end: fullText.length + 15,
      original: "Jane Doe",
      kind: "PERSON",
      label: "[Person 1]",
    },
  ];
  return { fullText, spans, tokens };
}

/**
 * pdf-lib returns a `Uint8Array` backed by a node Buffer in some
 * environments; normalise to a clean ArrayBuffer so test assertions
 * comparing to `ArrayBuffer.byteLength` don't drift.
 */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}
