/**
 * Barrel export for the client-side PDF redaction pipeline.
 *
 * Intentionally narrow surface: consumers import types and the worker
 * registrar from here. The individual pipeline modules (pdf-extract,
 * span-matcher, pdf-overlay, tokenize-for-pdf) land in Phase 1 and will
 * be re-exported from this file as they are added.
 */

export type {
  ExtractedPdf,
  PdfMatch,
  PdfSpan,
  PipelineError,
  RedactMode,
  RedactStatus,
  SkippedMatch,
  TokenKind,
  TokenRange,
} from "./types";
export { SENSITIVE_KINDS } from "./types";
export { registerPdfWorker } from "./pdf-worker";
export { extractPdf } from "./pdf-extract";
export { findMatches } from "./span-matcher";
export { buildRedactedPdf } from "./pdf-overlay";
export { quickTokenize, smartTokenize } from "./tokenize-for-pdf";
