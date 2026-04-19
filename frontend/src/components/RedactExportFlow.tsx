/**
 * Top-level orchestrator for the /redact flow.
 *
 * WHY this is a pure-render orchestrator:
 * All state lives in `useRedactExport`. This component just translates
 * `status` into which sub-component to show. No data fetching here —
 * sub-components receive only the props they need, making each stage
 * independently testable.
 *
 * Flow:
 *   idle          → RedactFileUpload
 *   extracting /
 *   running_overview → RedactFileUpload (isProcessing=true)
 *   awaiting_preview → RedactPreviewPanel
 *   redacting     → inline spinner
 *   complete      → RedactDownloadCard
 *   error         → error banner + "Start over"
 */

"use client";

import { useEffect, useState } from "react";
import { useRedactExport } from "@/hooks/useRedactExport";
import { RedactFileUpload } from "@/components/RedactFileUpload";
import { RedactPreviewPanel } from "@/components/RedactPreviewPanel";
import { RedactDownloadCard } from "@/components/RedactDownloadCard";
import type { RedactMode } from "@/lib/redact-export/types";

/** Main /redact page UI — drives the redact-export state machine. */
export function RedactExportFlow() {
  const [mode, setMode] = useState<RedactMode>("quick");
  const hook = useRedactExport();

  // Register the pdfjs web worker inside an effect so pdfjs module-level
  // code (which touches DOMMatrix) only runs in the browser, never during
  // Next.js server-side prerendering. The registrar is idempotent — safe
  // to call on every mount even though it only sets workerSrc once.
  useEffect(() => {
    import("@/lib/redact-export").then(({ registerPdfWorker }) => {
      registerPdfWorker();
    });
  }, []);

  const handleFileSelected = (file: File) => {
    hook.start(file, mode);
  };

  const handleModeChange = (m: RedactMode) => {
    setMode(m);
  };

  const isProcessing =
    hook.status === "extracting" || hook.status === "running_overview";

  return (
    <div className="mx-auto max-w-4xl px-5 py-9 sm:px-7">
      {/* Page header */}
      <div className="pb-10 pt-14 text-center">
        <p className="mb-4 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
          Privacy-first redaction
        </p>
        <h1 className="mx-auto mb-4 max-w-[540px] text-[40px] font-normal leading-[1.3] text-[var(--text-primary)] font-[var(--font-heading)]">
          Strip PII from your PDF — in the browser.
        </h1>
        <p className="mx-auto max-w-[450px] text-[17px] text-[var(--text-tertiary)] font-[var(--font-body)]">
          Upload a native PDF. Names, emails, and identifiers are replaced with
          labelled boxes. Your file never leaves your device in Quick mode.
        </p>
      </div>

      {/* Upload + mode toggle */}
      {(hook.status === "idle" ||
        hook.status === "extracting" ||
        hook.status === "running_overview") && (
        <RedactFileUpload
          mode={mode}
          onModeChange={handleModeChange}
          onFileSelected={handleFileSelected}
          isProcessing={isProcessing}
          error={hook.status === "idle" ? (hook.error?.message ?? null) : null}
        />
      )}

      {/* Redaction preview — kind-level toggles */}
      {hook.status === "awaiting_preview" && hook.preview && (
        <RedactPreviewPanel
          tokens={hook.preview.tokens}
          fullText={hook.preview.extracted.fullText}
          onConfirm={(disabledKinds) => hook.confirmPreview(disabledKinds)}
          onCancel={() => hook.reset()}
        />
      )}

      {/* Building PDF spinner */}
      {hook.status === "redacting" && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />
          <p className="text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)]">
            Building redacted PDF…
          </p>
        </div>
      )}

      {/* Download card */}
      {hook.status === "complete" && hook.result && (
        <RedactDownloadCard
          blob={hook.result.blob}
          filename={hook.result.filename}
          matchesByKind={hook.result.matchesByKind}
          skipped={hook.result.skipped}
          smartFallbackNotice={hook.smartFallbackNotice}
          onStartOver={() => hook.reset()}
        />
      )}

      {/* Hard-error banner (extract / build failures) */}
      {hook.status === "error" && hook.error && (
        <div className="rounded border border-[var(--risk-high-border,#ef4444)] bg-[var(--risk-high-bg,#fef2f2)] px-5 py-4">
          <p className="text-[15px] font-semibold text-[var(--risk-high,#dc2626)] font-[var(--font-body)]">
            {hook.error.message}
          </p>
          <button
            type="button"
            onClick={() => hook.reset()}
            className="mt-3 rounded border border-[var(--border-primary)] px-4 py-2 text-[14px] text-[var(--text-secondary)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)]"
          >
            Start over
          </button>
        </div>
      )}

      {/* How it works strip */}
      {hook.status === "idle" && (
        <div className="mx-auto mt-14 max-w-[540px]">
          <p className="mb-4 text-center text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
            How it works
          </p>
          <div className="flex gap-4">
            <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 theme-transition">
              <p className="text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">
                1. Upload
              </p>
              <p className="mt-1.5 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
                Native PDF, stays in browser
              </p>
            </div>
            <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 theme-transition">
              <p className="text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">
                2. Review
              </p>
              <p className="mt-1.5 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
                Toggle which entity types to redact
              </p>
            </div>
            <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 theme-transition">
              <p className="text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">
                3. Download
              </p>
              <p className="mt-1.5 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
                Layout-preserving PDF with labelled boxes
              </p>
            </div>
          </div>
          <div className="mt-10 border-t border-[var(--border-primary)] pt-5 text-center">
            <p className="text-[15px] italic text-[var(--text-muted)] font-[var(--font-heading)]">
              Built by a corporate lawyer turned developer. Not legal advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
