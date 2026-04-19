/**
 * Maps token character ranges (offsets into `fullText`) back to pdfjs
 * glyph coordinates so `pdf-overlay` can draw white rectangles + labels
 * at the right pixels.
 *
 * A single token may overlap multiple spans — when pdfjs splits a run
 * across text items (kerning, font change) or across a page break.
 * We emit one `PdfMatch` per overlapping span so each visible rect
 * stays aligned with the actual glyphs rather than being one big
 * rectangle that overshoots whitespace gaps.
 *
 * A token that matches zero spans is surfaced as a `SkippedMatch` so
 * the UI can gate the download when a sensitive kind was left visible
 * (silent partial redaction is worse than no redaction — see the SP-3
 * spec's privacy-critical rule).
 */

import type { PdfMatch, PdfSpan, SkippedMatch, TokenRange } from "./types";

/** Inputs arriving sorted by `charStart` (guaranteed by `extractPdf`). */
export interface SpanMatchResult {
  matches: PdfMatch[];
  skipped: SkippedMatch[];
}

/**
 * For each token in `tokenRanges`, produce one `PdfMatch` per
 * overlapping span with pixel coordinates clipped to the intersection.
 *
 * Assumes `spans` is sorted by `charStart` (extractPdf guarantees
 * this). A linear scan is fine for the ~10k tokens worst-case we
 * expect in a 50-page legal contract.
 *
 * Coordinate math: pdfjs reports `x,y` at the glyph origin (bottom-left
 * baseline) and `w,h` for the full run. We clip x+w to the character
 * range using a linear interpolation over the run's character length —
 * cheaper than querying pdfjs for per-glyph positions and accurate
 * enough for rectangle overlays, where a few points of horizontal
 * slack is visually invisible. Vertical clipping is not done: a
 * sub-glyph height rect would look worse than covering the full line.
 */
export function findMatches(
  tokenRanges: TokenRange[],
  spans: PdfSpan[],
): SpanMatchResult {
  const matches: PdfMatch[] = [];
  const skipped: SkippedMatch[] = [];

  for (const token of tokenRanges) {
    let anyOverlap = false;
    for (const span of spans) {
      // Quick reject: spans past the token end cannot overlap.
      if (span.charStart >= token.end) break;
      if (span.charEnd <= token.start) continue;

      const iStart = Math.max(span.charStart, token.start);
      const iEnd = Math.min(span.charEnd, token.end);
      if (iEnd <= iStart) continue;

      const spanLen = span.charEnd - span.charStart;
      // Defensive: spanLen should never be zero (extractPdf drops
      // empty spans), but guard against a future regression producing
      // NaN rectangles that pdf-lib silently draws at the origin.
      const ratioStart = spanLen === 0 ? 0 : (iStart - span.charStart) / spanLen;
      const ratioLen = spanLen === 0 ? 0 : (iEnd - iStart) / spanLen;

      matches.push({
        page: span.page,
        x: span.x + ratioStart * span.w,
        y: span.y,
        w: ratioLen * span.w,
        h: span.h,
        label: token.label,
        kind: token.kind,
      });
      anyOverlap = true;
    }
    if (!anyOverlap) {
      skipped.push({ label: token.label, kind: token.kind, original: token.original });
    }
  }

  return { matches, skipped };
}
