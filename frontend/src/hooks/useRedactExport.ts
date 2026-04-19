/**
 * Hook that drives the SP-3 client-side PDF redaction flow (Smart-only).
 *
 * State machine (mirrors `useStreamingAnalysis` shape):
 *
 *   idle
 *     → extracting        (start() validates file, parses PDF)
 *     → running_overview  (fetch Pass 0 for role labels)
 *     → awaiting_preview  (UI shows `RedactionPreview` with tokens)
 *     → redacting         (confirmPreview() paints overlay)
 *     → complete          (Blob ready for download)
 *     → error             (any stage: see PipelineError.stage)
 *
 * Pass 0 failure is a recoverable error: the extracted PDF stays in
 * memory and the UI exposes `retryOverview()` so the user can re-run
 * the Pass 0 call without re-uploading. This matches the product
 * promise that `/redact` is about semantic role labels — we refuse to
 * silently fall back to pattern-only output.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { extractPdf } from "@/lib/redact-export/pdf-extract";
import { findMatches } from "@/lib/redact-export/span-matcher";
import { buildRedactedPdf } from "@/lib/redact-export/pdf-overlay";
import { tokenizeForPdf } from "@/lib/redact-export/tokenize-for-pdf";
import type {
  ExtractedPdf,
  PipelineError,
  RedactStatus,
  SkippedMatch,
  TokenKind,
  TokenRange,
} from "@/lib/redact-export/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_TEXT_CHARS = 50;

/** Empty per-kind tally — used as the `matchesByKind` zero value. */
function zeroKindTally(): Record<TokenKind, number> {
  return {
    PERSON: 0,
    ORG: 0,
    EMAIL: 0,
    PHONE: 0,
    IBAN: 0,
    VAT: 0,
    ADDRESS: 0,
    POSTCODE: 0,
    ID_NUMBER: 0,
    DOB: 0,
    BANK: 0,
    COMPANY_REG: 0,
    URL: 0,
    DATE: 0,
    MONEY: 0,
    OTHER: 0,
  };
}

export interface UseRedactExportApi {
  status: RedactStatus;
  error: PipelineError | null;
  /** Populated after extraction so the UI can render the RedactionPreview. */
  preview: { extracted: ExtractedPdf; tokens: TokenRange[] } | null;
  /** Populated on `complete`: the redacted PDF Blob and per-kind stats. */
  result: {
    blob: Blob;
    filename: string;
    skipped: SkippedMatch[];
    matchesByKind: Record<TokenKind, number>;
  } | null;
  /** Kick the pipeline off. Validates the file synchronously first. */
  start: (file: File) => Promise<void>;
  /**
   * Re-run Pass 0 against the cached extracted PDF. Only valid when
   * the hook is in `error` with `stage === "overview"` — otherwise
   * no-ops. Lets the user recover from a transient Mistral failure
   * without re-uploading.
   */
  retryOverview: () => Promise<void>;
  /** User confirms the preview (optionally disabling some kinds). */
  confirmPreview: (disabledKinds: Set<TokenKind>) => Promise<void>;
  reset: () => void;
}

/** Hook that owns the redact-export state machine. */
export function useRedactExport(): UseRedactExportApi {
  const [status, setStatus] = useState<RedactStatus>("idle");
  const [error, setError] = useState<PipelineError | null>(null);
  const [preview, setPreview] = useState<
    { extracted: ExtractedPdf; tokens: TokenRange[] } | null
  >(null);
  const [result, setResult] = useState<UseRedactExportApi["result"]>(null);

  // File metadata we need at confirm-time (download filename) is
  // stashed in a ref so the confirmPreview closure doesn't have to
  // capture it via state (which would fight React 19 transitions).
  const fileRef = useRef<File | null>(null);
  // Cached extracted PDF so `retryOverview()` can skip re-parsing
  // after a transient Pass 0 failure. Cleared on `reset()` and on
  // successful transition into `awaiting_preview`.
  const extractedRef = useRef<ExtractedPdf | null>(null);
  // Parties that Pass 0 returned but that never matched the PDF text
  // (casing / whitespace mismatch, etc.). Surfaced into
  // `result.skipped` so the sensitive-kind banner trips even though
  // no corresponding token entered the span-matcher.
  const smartSkippedRef = useRef<SkippedMatch[]>([]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setPreview(null);
    setResult(null);
    fileRef.current = null;
    extractedRef.current = null;
    smartSkippedRef.current = [];
  }, []);

  /**
   * Run the Pass 0 → tokenize → preview sequence against an already-
   * extracted PDF. Shared between `start()` (first run) and
   * `retryOverview()` (after a transient Mistral failure).
   */
  const runOverview = useCallback(async (extracted: ExtractedPdf) => {
    setStatus("running_overview");
    try {
      const { ranges, skipped } = await tokenizeForPdf(extracted.fullText);
      smartSkippedRef.current = skipped;
      setPreview({ extracted, tokens: ranges });
      setStatus("awaiting_preview");
    } catch (err) {
      setStatus("error");
      setError({
        stage: "overview",
        message:
          err instanceof Error && err.name === "SmartOverviewError"
            ? "AI role labels unavailable. Try again in a moment."
            : err instanceof Error
              ? err.message
              : "AI role labels unavailable.",
        recoverable: true,
      });
    }
  }, []);

  const start = useCallback(
    async (file: File) => {
      // Reset derived state on a fresh run — synchronously inside
      // this callback so the caller can await the whole pipeline
      // without observing a stale `complete` status between runs.
      setError(null);
      setPreview(null);
      setResult(null);
      fileRef.current = file;
      extractedRef.current = null;
      smartSkippedRef.current = [];

      // ----- Upload validation (fail fast, never touch pdfjs) -----
      if (file.type !== "application/pdf") {
        setStatus("error");
        setError({
          stage: "upload",
          message: "Only native PDFs are supported. Convert DOCX first.",
          recoverable: true,
        });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setStatus("error");
        setError({
          stage: "upload",
          message: "File too large (max 10 MB).",
          recoverable: true,
        });
        return;
      }

      setStatus("extracting");
      let extracted: ExtractedPdf;
      try {
        const bytes = await file.arrayBuffer();
        extracted = await extractPdf(bytes);
      } catch (err) {
        setStatus("error");
        setError({
          stage: "extract",
          message:
            err instanceof Error
              ? err.message
              : "Could not read PDF structure. File may be corrupted.",
          recoverable: true,
        });
        return;
      }

      if (extracted.fullText.length < MIN_TEXT_CHARS) {
        setStatus("error");
        setError({
          stage: "extract",
          message:
            "This PDF looks scanned. Layout-preserving redaction needs selectable text.",
          recoverable: true,
        });
        return;
      }

      extractedRef.current = extracted;
      await runOverview(extracted);
    },
    [runOverview],
  );

  const retryOverview = useCallback(async () => {
    const cached = extractedRef.current;
    if (!cached) return;
    setError(null);
    await runOverview(cached);
  }, [runOverview]);

  const confirmPreview = useCallback(
    async (disabledKinds: Set<TokenKind>) => {
      const current = preview;
      if (!current) return;
      const filteredTokens = current.tokens.filter(
        (t) => !disabledKinds.has(t.kind),
      );
      setStatus("redacting");
      try {
        const { matches, skipped } = findMatches(
          filteredTokens,
          current.extracted.spans,
        );
        const redactedBytes = await buildRedactedPdf(
          current.extracted.bytes,
          matches,
        );
        // Copy into a fresh Uint8Array so the resulting Blob owns its
        // own buffer — pdf-lib may return a view over an internal
        // pooled buffer that could be mutated by subsequent runs.
        const copy = new Uint8Array(redactedBytes.byteLength);
        copy.set(redactedBytes);
        const blob = new Blob([copy.buffer], { type: "application/pdf" });
        const filename = buildFilename(fileRef.current?.name ?? "contract.pdf");
        const matchesByKind = zeroKindTally();
        for (const m of matches) {
          matchesByKind[m.kind] = (matchesByKind[m.kind] ?? 0) + 1;
        }
        // Merge Pass 0 unmatched-party skips with the span-matcher
        // skips so a single `result.skipped` array drives the banner.
        const mergedSkipped: SkippedMatch[] = [
          ...skipped,
          ...smartSkippedRef.current,
        ];
        setResult({
          blob,
          filename,
          skipped: mergedSkipped,
          matchesByKind,
        });
        setStatus("complete");
      } catch (err) {
        setStatus("error");
        setError({
          stage: "build",
          message:
            err instanceof Error
              ? err.message
              : "Could not build redacted PDF. Please retry or use a different file.",
          recoverable: true,
        });
      }
    },
    [preview],
  );

  return {
    status,
    error,
    preview,
    result,
    start,
    retryOverview,
    confirmPreview,
    reset,
  };
}

/** `contract.pdf` → `contract-redacted.pdf`. Preserves the user's base name. */
function buildFilename(original: string): string {
  const dot = original.lastIndexOf(".");
  const base = dot > 0 ? original.slice(0, dot) : original;
  return `${base}-redacted.pdf`;
}
