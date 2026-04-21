/**
 * Post-redaction summary card for the /redact flow.
 *
 * Responsibilities:
 * - Display per-kind match counts so the user can see what was redacted.
 * - Surface a skipped-match banner when the span-matcher could not locate
 *   coordinates for some tokens (rare: custom ToUnicode maps / glyph gaps).
 *   A silent partial redaction is worse than no redaction — the user must
 *   consciously accept that risk. Red callout + gated checkbox when any
 *   skipped kind is in SENSITIVE_KINDS; quiet note for low-sensitivity
 *   skips (dates, amounts) where no gate is needed.
 * - Trigger the Blob URL download with a well-named file.
 * - Offer "Start over" to reset the hook to idle.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { SkippedMatch, TokenKind } from "@/lib/redact-export/types";
import { SENSITIVE_KINDS } from "@/lib/redact-export/types";
import {
  BorderedCard,
  Button,
  Kicker,
  MonoLabel,
} from "@/components/ui";

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

/** Download card shown after the redacted PDF has been built. */
export function RedactDownloadCard({
  blob,
  filename,
  matchesByKind,
  skipped,
  onStartOver,
}: RedactDownloadCardProps) {
  const t = useTranslations("RedactDownloadCard");
  const kindLabel = (k: TokenKind): string => t(`kinds.${k}`);

  // Blob URL lives in a ref so we can revoke on unmount without triggering
  // a re-render. URL.createObjectURL is an external side-effect, not state.
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    return () => {
      URL.revokeObjectURL(url);
      blobUrlRef.current = null;
    };
  }, [blob]);

  const skippedKinds = new Set(skipped.map((s) => s.kind));
  const sensitiveSkippedKinds = Array.from(skippedKinds).filter((k) =>
    SENSITIVE_KINDS.has(k),
  );
  const hasSensitiveSkips = sensitiveSkippedKinds.length > 0;
  const hasAnySkips = skipped.length > 0;

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
    <BorderedCard
      tone="edge"
      padding="md"
      data-testid="redact-download-card"
    >
      {/* Success masthead */}
      <Kicker tone="red">{t("ready")}</Kicker>
      <p className="mt-3 mb-5 font-serif text-[15px] italic text-ink-2">
        {t("count", { count: totalMatches })}
      </p>

      {/* Per-kind counts */}
      {totalMatches > 0 && (
        <div className="mb-5 border border-paper-edge bg-paper">
          {KIND_ORDER.filter((k) => matchesByKind[k] > 0).map((kind, idx) => (
            <div
              key={kind}
              className={`flex items-center justify-between px-4 py-2.5 ${
                idx > 0 ? "border-t border-paper-edge" : ""
              }`}
            >
              <MonoLabel tone="muted">{kindLabel(kind)}</MonoLabel>
              <span className="font-mono text-[12px] text-ink">
                {matchesByKind[kind]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Skipped-match banner — severity varies by kind */}
      {hasAnySkips && (
        <BorderedCard
          tone={hasSensitiveSkips ? "red" : "edge"}
          padding="sm"
          className="mb-5"
          data-testid="skipped-match-banner"
        >
          <MonoLabel tone={hasSensitiveSkips ? "red" : "muted"}>
            {hasSensitiveSkips ? t("warnUnmatched") : t("noteLowSensitivity")}
          </MonoLabel>
          {hasSensitiveSkips && (
            <>
              <p className="mt-2 m-0 t-reading text-[14px] text-ink-2">
                {t("affectedCategories", {
                  kinds: sensitiveSkippedKinds.map(kindLabel).join(", "),
                })}{" "}
                {t("warnReason")}
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                  data-testid="reviewed-checkbox"
                  className="mt-0.5 h-4 w-4 accent-red-accent"
                />
                <span className="t-reading text-[14px] text-ink-2">
                  {t("reviewed")}
                </span>
              </label>
            </>
          )}
        </BorderedCard>
      )}

      {/* Download + start over */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-edge pt-5">
        <Button variant="ghost" size="md" onClick={onStartOver}>
          {t("startOver")}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleDownload}
          disabled={!canDownload}
          data-testid="download-button"
        >
          {t("download")}
        </Button>
      </div>
    </BorderedCard>
  );
}
