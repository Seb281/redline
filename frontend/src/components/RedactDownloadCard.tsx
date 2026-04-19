/**
 * Post-redaction summary card for the /redact flow.
 *
 * Responsibilities:
 * - Display per-kind match counts so the user can see what was redacted.
 * - Surface a skipped-match banner when the span-matcher could not locate
 *   coordinates for some tokens (rare: custom ToUnicode maps / glyph gaps).
 *   WHY the banner severity matters: a silent partial redaction is worse
 *   than no redaction — the user must consciously accept that risk.
 *   Red + gated checkbox when any skipped kind is in SENSITIVE_KINDS.
 *   Yellow (no gate) when all skips are low-sensitivity (dates, amounts).
 * - Trigger the Blob URL download with a well-named file.
 * - Offer "Start over" to reset the hook to idle.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// Note: useState retained for the `reviewed` checkbox state below.
import type { SkippedMatch, TokenKind } from "@/lib/redact-export/types";
import { SENSITIVE_KINDS } from "@/lib/redact-export/types";

interface RedactDownloadCardProps {
  blob: Blob;
  filename: string;
  matchesByKind: Record<TokenKind, number>;
  skipped: SkippedMatch[];
  onStartOver: () => void;
}

const KIND_ORDER: TokenKind[] = [
  "PERSON",
  "ORG",
  "EMAIL",
  "IBAN",
  "PHONE",
  "ADDRESS",
  "POSTCODE",
  "ID_NUMBER",
  "DOB",
  "BANK",
  "COMPANY_REG",
  "VAT",
  "URL",
  "DATE",
  "MONEY",
  "OTHER",
];

function kindLabel(kind: TokenKind): string {
  switch (kind) {
    case "PERSON":
      return "People";
    case "ORG":
      return "Organisations";
    case "EMAIL":
      return "Emails";
    case "IBAN":
      return "IBANs";
    case "PHONE":
      return "Phone numbers";
    case "VAT":
      return "VAT numbers";
    case "ADDRESS":
      return "Addresses";
    case "POSTCODE":
      return "Postcodes";
    case "ID_NUMBER":
      return "ID numbers";
    case "DOB":
      return "Dates of birth";
    case "BANK":
      return "Bank details";
    case "COMPANY_REG":
      return "Company registrations";
    case "URL":
      return "URLs";
    case "DATE":
      return "Dates";
    case "MONEY":
      return "Amounts";
    default:
      return "Other";
  }
}

/** Download card shown after the redacted PDF has been built. */
export function RedactDownloadCard({
  blob,
  filename,
  matchesByKind,
  skipped,
  onStartOver,
}: RedactDownloadCardProps) {
  // Blob URL lives in a ref so we can revoke on unmount without triggering
  // a re-render (URL.createObjectURL is an external side-effect, not state).
  // We create it eagerly on component mount via useMemo-equivalent ref init.
  const blobUrlRef = useRef<string | null>(null);

  // Create and revoke the object URL as an external cleanup concern.
  // We use a layout effect so the URL is ready before the first paint and
  // the cleanup fires synchronously before the browser can observe a stale
  // href on the anchor element.
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    return () => {
      URL.revokeObjectURL(url);
      blobUrlRef.current = null;
    };
  }, [blob]);

  // Build the set of skipped kinds that are sensitive so we know the
  // banner severity and whether to gate the download.
  const skippedKinds = new Set(skipped.map((s) => s.kind));
  const sensitiveSkippedKinds = Array.from(skippedKinds).filter((k) =>
    SENSITIVE_KINDS.has(k),
  );
  const hasSensitiveSkips = sensitiveSkippedKinds.length > 0;
  const hasAnySkips = skipped.length > 0;

  // Gate checkbox — only shown when sensitive kinds were skipped.
  const [reviewed, setReviewed] = useState(false);
  const canDownload = !hasSensitiveSkips || reviewed;

  const handleDownload = useCallback(() => {
    const url = blobUrlRef.current;
    if (!url || !canDownload) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }, [filename, canDownload]);

  const totalMatches = Object.values(matchesByKind).reduce(
    (sum, n) => sum + n,
    0,
  );

  return (
    <div
      className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-6 py-5 theme-transition"
      data-testid="redact-download-card"
    >
      {/* Success header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-subtle)]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--accent)]"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">
            Redacted PDF ready
          </p>
          <p className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]">
            {totalMatches} item{totalMatches !== 1 ? "s" : ""} redacted
          </p>
        </div>
      </div>

      {/* Per-kind counts */}
      {totalMatches > 0 && (
        <div className="mb-4 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] divide-y divide-[var(--border-primary)]">
          {KIND_ORDER.filter((k) => matchesByKind[k] > 0).map((kind) => (
            <div
              key={kind}
              className="flex items-center justify-between px-4 py-2"
            >
              <span className="text-[13px] text-[var(--text-secondary)] font-[var(--font-body)]">
                {kindLabel(kind)}
              </span>
              <span className="text-[13px] font-medium text-[var(--text-primary)] font-[var(--font-body)]">
                {matchesByKind[kind]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Skipped-match banner — severity varies by kind */}
      {hasAnySkips && (
        <div
          className={`mb-4 rounded border px-4 py-3 ${
            hasSensitiveSkips
              ? "border-[var(--risk-high-border,#ef4444)] bg-[var(--risk-high-bg,#fef2f2)]"
              : "border-[var(--risk-medium-border)] bg-[var(--risk-medium-bg)]"
          }`}
          data-testid="skipped-match-banner"
        >
          <p
            className={`text-[13px] font-semibold font-[var(--font-body)] ${
              hasSensitiveSkips
                ? "text-[var(--risk-high,#dc2626)]"
                : "text-[var(--risk-medium)]"
            }`}
          >
            {hasSensitiveSkips
              ? "Warning: some sensitive tokens could not be located in the PDF layout"
              : "Note: some low-sensitivity tokens were not matched in the PDF layout"}
          </p>
          {hasSensitiveSkips && (
            <p className="mt-1 text-[12px] text-[var(--text-secondary)] font-[var(--font-body)]">
              Affected categories:{" "}
              {sensitiveSkippedKinds.map(kindLabel).join(", ")}. These may
              appear unredacted in the output. This is caused by custom font
              encoding in the source PDF.
            </p>
          )}
          {/* Gate checkbox — only when sensitive kinds skipped */}
          {hasSensitiveSkips && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
                data-testid="reviewed-checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span className="text-[13px] text-[var(--text-secondary)] font-[var(--font-body)]">
                I have reviewed this and understand the file may contain
                unredacted sensitive data
              </span>
            </label>
          )}
        </div>
      )}

      {/* Download + start over */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onStartOver}
          className="text-[15px] text-[var(--text-muted)] font-[var(--font-body)] transition-colors hover:text-[var(--text-secondary)]"
        >
          Start over
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!canDownload}
          className="flex items-center gap-2 rounded border border-[var(--accent)] bg-[var(--accent)] px-5 py-2.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="download-button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download redacted PDF
        </button>
      </div>
    </div>
  );
}
