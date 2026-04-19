/**
 * PDF text extraction for the SP-3 client-side redaction pipeline.
 *
 * Walks every page of the input PDF via pdfjs-dist, concatenates every
 * `TextItem.str` into a single `fullText` string, and records the glyph
 * box for each text run in a parallel `PdfSpan[]`. Downstream modules
 * (`tokenize-for-pdf`, `span-matcher`, `pdf-overlay`) index into
 * `fullText` by character offsets, so the concatenation rules are the
 * load-bearing invariant of the whole pipeline.
 *
 * Separator policy (privacy-critical, see SP-3 fix #3):
 *
 *   pdfjs frequently splits a visibly-continuous word into two
 *   TextItems at a kerning boundary (`"hello"` + `"@acme.test"`). If
 *   every item were joined with "\n", the email regex — which does not
 *   match "\n" — would never see the token, no pattern match would be
 *   emitted, no SkippedMatch would fire, and the email would stay
 *   visible in the output PDF with no banner.
 *
 *   So we only insert "\n" when pdfjs reports `hasEOL === true` on the
 *   preceding item (an actual visual end-of-line) or at a page
 *   boundary. Intra-line items are joined with the empty string. The
 *   charStart/charEnd of every span therefore maps onto `fullText`
 *   exactly — the `spans[i].text` slice equals `fullText.slice(cs, ce)`
 *   by construction, which is the load-bearing invariant downstream
 *   modules rely on.
 */

import { getDocument } from "pdfjs-dist";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  TextItem,
  TextMarkedContent,
} from "pdfjs-dist/types/src/display/api";
import type { ExtractedPdf, PdfSpan } from "./types";
import { registerPdfWorker } from "./pdf-worker";

/**
 * Custom error name used by `extractPdf` so the hook can distinguish
 * "this PDF won't parse" from generic JS errors and surface a
 * targeted message.
 */
const PDF_EXTRACT_ERROR = "PdfExtractError";

/**
 * Extracts text content + glyph positions from a native PDF.
 *
 * The returned `bytes` field is the SAME ArrayBuffer passed in —
 * `pdf-overlay` reloads the doc with pdf-lib later, and making the
 * original bytes part of the ExtractedPdf shape avoids threading the
 * File through the hook state separately.
 *
 * Throws an Error with `.name === "PdfExtractError"` on corrupt /
 * encrypted PDFs so the caller can translate to a `PipelineError`
 * with `stage: "extract"`.
 */
export async function extractPdf(bytes: ArrayBuffer): Promise<ExtractedPdf> {
  registerPdfWorker();

  // pdfjs mutates the buffer it receives, so we hand it a view over a
  // copy to protect the caller's original bytes. The ExtractedPdf still
  // carries the untouched `bytes` back out so pdf-lib sees pristine
  // input in the overlay stage.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(new Uint8Array(bytes));

  let doc: PDFDocumentProxy;
  try {
    doc = await getDocument({ data: copy }).promise;
  } catch (err) {
    const wrapped = new Error(
      err instanceof Error ? err.message : "Could not read PDF",
    );
    wrapped.name = PDF_EXTRACT_ERROR;
    throw wrapped;
  }

  const spans: PdfSpan[] = [];
  let fullText = "";

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page: PDFPageProxy = await doc.getPage(pageNum);
      const content = await page.getTextContent();

      for (const item of content.items as Array<TextItem | TextMarkedContent>) {
        // TextMarkedContent entries carry no glyph box; skip them. The
        // `str` check also defensively filters any non-TextItem that
        // slipped through.
        if (!isTextItem(item)) continue;

        const charStart = fullText.length;
        fullText += item.str;
        const charEnd = fullText.length;

        // Empty strings happen (font-only markers, zero-width joiners).
        // Emitting them would produce zero-width spans that the matcher
        // would then emit as zero-width rects — skip.
        if (charEnd > charStart) {
          const [, , , , e, f] = item.transform as number[];
          spans.push({
            page: pageNum,
            x: e,
            y: f,
            w: item.width,
            h: item.height,
            charStart,
            charEnd,
            text: item.str,
          });
        }
        // Only insert "\n" at actual visual line breaks (pdfjs
        // `hasEOL`). Intra-line items are joined without a separator
        // so a word split into multiple items at a kerning boundary
        // (e.g. "hello" + "@acme.test") concatenates back into the
        // regex-matchable form in `fullText`.
        if (item.hasEOL) fullText += "\n";
      }
      // Page separator so cross-page token lookups can be distinguished
      // from within-page line breaks if we ever need to.
      fullText += "\n";
    }
  } finally {
    await doc.destroy().catch(() => {
      // pdfjs rejects destroy() if already destroyed; nothing to recover.
    });
  }

  return {
    bytes,
    fullText,
    spans,
    pageCount: doc.numPages,
  };
}

/**
 * Narrow the pdfjs items union to TextItem. TextMarkedContent has a
 * `type` discriminator but no `str`; checking `str` existence is the
 * robust approach since pdfjs does not export a type-guard.
 */
function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return typeof (item as TextItem).str === "string";
}
