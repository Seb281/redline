/**
 * Shared types for the client-side PDF redaction pipeline.
 *
 * Pipeline stages consume these in the order:
 *   pdf-extract → tokenize-for-pdf → span-matcher → pdf-overlay
 *
 * `charStart`/`charEnd` indices always refer to the single `fullText` string
 * produced by `extractPdf` — never to page-local offsets. This is the
 * load-bearing invariant of the whole pipeline.
 */

/** User-visible mode toggle. Quick = pattern-only, zero LLM. Smart = Pass 0 for role labels. */
export type RedactMode = "quick" | "smart";

/**
 * One text run emitted by pdfjs, carrying both the string and the glyph box.
 * Multiple spans may belong to the same line; a single token may straddle
 * two or more spans (the span-matcher emits one rectangle per span).
 */
export interface PdfSpan {
  /** 1-indexed page number as displayed in the PDF. */
  page: number;
  /** pdfjs x origin (bottom-left, in points). */
  x: number;
  /** pdfjs y origin (bottom-left baseline, in points). */
  y: number;
  /** Rendered width of the span in points. */
  w: number;
  /** Rendered height of the span in points (glyph height, not line height). */
  h: number;
  /** Inclusive start index of the span's text in `fullText`. */
  charStart: number;
  /** Exclusive end index of the span's text in `fullText`. */
  charEnd: number;
  /** Literal string for this span (already unicode-normalised by pdfjs). */
  text: string;
}

/**
 * Output of `extractPdf`. `fullText` concatenates spans with "\n" between
 * pdfjs items and pages; those separator characters occupy char indices but
 * have no corresponding span — span-matcher skips them by construction.
 */
export interface ExtractedPdf {
  /** Original file bytes, retained for `pdf-lib` overlay in the final stage. */
  bytes: ArrayBuffer;
  /** Single concatenated text string; all token ranges index into this. */
  fullText: string;
  /** Spans ordered by appearance. */
  spans: PdfSpan[];
  /** Number of pages in the document. */
  pageCount: number;
}

/**
 * A single tokenization result: one substring of `fullText` plus the label
 * that should be drawn on top of it in the output PDF.
 * Emitted by `tokenize-for-pdf` after merging pattern matches with optional
 * Pass-0-derived role labels.
 */
export interface TokenRange {
  /** Inclusive start in `fullText`. */
  start: number;
  /** Exclusive end in `fullText`. */
  end: number;
  /** Literal original substring (for dev logging only — never rendered). */
  original: string;
  /** Redaction kind: drives the privacy-sensitive skipped-match banner. */
  kind: TokenKind;
  /** Human-readable label drawn on the output PDF, e.g. "[Provider]" or "[Email 1]". */
  label: string;
}

/** Kinds worth surfacing separately. Sensitive kinds gate the download when skipped. */
export type TokenKind =
  | "PERSON"
  | "ORG"
  | "EMAIL"
  | "PHONE"
  | "IBAN"
  | "ADDRESS"
  | "POSTCODE"
  | "DATE"
  | "MONEY"
  | "OTHER";

/**
 * Concrete rectangle to draw in the output PDF. One token can produce
 * multiple matches (split across spans or pages); each carries the same
 * `label`.
 */
export interface PdfMatch {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  kind: TokenKind;
}

/**
 * A token the span-matcher located in `fullText` but could not map to any
 * pdfjs coordinate. Rare (custom ToUnicode maps, glyph/char mismatches) but
 * privacy-critical: if `kind` is sensitive, the UI must gate the download.
 */
export interface SkippedMatch {
  label: string;
  kind: TokenKind;
  original: string;
}

/** Kinds that escalate the skipped-match banner to red + require user confirmation. */
export const SENSITIVE_KINDS: ReadonlySet<TokenKind> = new Set([
  "PERSON",
  "ORG",
  "EMAIL",
  "IBAN",
]);

/** State-machine phases for the `/redact` flow hook. */
export type RedactStatus =
  | "idle"
  | "extracting"
  | "awaiting_preview"
  | "running_overview"
  | "redacting"
  | "complete"
  | "error";

/** Normalised pipeline error surfaced to the UI. */
export interface PipelineError {
  stage: "upload" | "extract" | "overview" | "redact" | "build";
  message: string;
  /** If true, the `/redact` flow stays usable and can retry; otherwise requires "Start over". */
  recoverable: boolean;
}
