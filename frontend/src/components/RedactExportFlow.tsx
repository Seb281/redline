/**
 * Top-level orchestrator for the /redact flow.
 *
 * State lives in `useRedactExport`. This component translates `status`
 * into the right sub-component and owns no data — each stage is
 * independently testable via its own component file.
 *
 * Flow:
 *   idle / extracting / running_overview → RedactFileUpload
 *   awaiting_preview                     → RedactPreviewPanel
 *   redacting                            → inline spinner
 *   complete                             → RedactDownloadCard
 *   error                                → editorial alert card
 */

"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRedactExport } from "@/hooks/useRedactExport";
import { RedactFileUpload } from "@/components/RedactFileUpload";
import { RedactPreviewPanel } from "@/components/RedactPreviewPanel";
import { RedactDownloadCard } from "@/components/RedactDownloadCard";
import { PageShell } from "@/components/PageShell";
import {
  BorderedCard,
  Button,
  Kicker,
  Masthead,
  MonoLabel,
} from "@/components/ui";

/** Main /redact page UI — drives the redact-export state machine. */
export function RedactExportFlow() {
  const t = useTranslations("RedactExportFlow");
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
    hook.start(file);
  };

  const isProcessing =
    hook.status === "extracting" || hook.status === "running_overview";

  // Overview-stage errors keep the extracted PDF cached, so the retry
  // button re-runs Pass 0 without forcing a re-upload. Any other error
  // stage needs a full reset via "Start over".
  const canRetryOverview =
    hook.status === "error" && hook.error?.stage === "overview";

  return (
    <main>
      <PageShell width="md" className="pb-16">
        <Masthead meta={t("label")} title={t("heading")} lede={t("description")} />

        <section className="mt-12">
          {/* Upload zone */}
          {(hook.status === "idle" ||
            hook.status === "extracting" ||
            hook.status === "running_overview") && (
            <RedactFileUpload
              onFileSelected={handleFileSelected}
              isProcessing={isProcessing}
              error={
                hook.status === "idle" && hook.error
                  ? t(`errors.${hook.error.code}`)
                  : null
              }
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
            <div className="flex flex-col items-center gap-5 py-20">
              <div
                aria-hidden
                className="h-9 w-9 animate-spin border-2 border-paper-edge border-t-ink"
              />
              <MonoLabel tone="muted">{t("building")}</MonoLabel>
            </div>
          )}

          {/* Download card */}
          {hook.status === "complete" && hook.result && (
            <RedactDownloadCard
              blob={hook.result.blob}
              filename={hook.result.filename}
              matchesByKind={hook.result.matchesByKind}
              skipped={hook.result.skipped}
              onStartOver={() => hook.reset()}
            />
          )}

          {/* Hard-error banner (extract / overview / build failures) */}
          {hook.status === "error" && hook.error && (
            <BorderedCard
              tone="red"
              padding="md"
              role="alert"
              className="flex flex-col gap-4"
            >
              <Kicker tone="red">{t("label")}</Kicker>
              <p className="m-0 font-serif text-[20px] italic leading-snug text-ink">
                {t(`errors.${hook.error.code}`)}
                {hook.error.detail ? ` — ${hook.error.detail}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {canRetryOverview && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => hook.retryOverview()}
                  >
                    {t("retry")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => hook.reset()}
                >
                  {t("startOver")}
                </Button>
              </div>
            </BorderedCard>
          )}
        </section>

        {/* How it works strip — idle only */}
        {hook.status === "idle" && (
          <section className="mt-14 border-t border-paper-edge pt-8">
            <MonoLabel tone="muted" className="block">
              {t("howItWorks")}
            </MonoLabel>
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
              <HowItWorksCell n="01" title={t("step1")} body={t("step1Desc")} />
              <HowItWorksCell n="02" title={t("step2")} body={t("step2Desc")} />
              <HowItWorksCell n="03" title={t("step3")} body={t("step3Desc")} />
            </div>
            <p className="mt-10 border-t border-paper-edge pt-5 text-center font-serif text-[15px] italic text-ink-muted">
              {t("footer")}
            </p>
          </section>
        )}
      </PageShell>
    </main>
  );
}

/** Numbered "how it works" cell — mono ordinal, serif title, reading body. */
function HowItWorksCell({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <BorderedCard tone="edge" padding="md" className="flex flex-col gap-3">
      <MonoLabel tone="red">{n}</MonoLabel>
      <h3 className="m-0 font-serif text-[20px] font-light leading-tight text-ink">
        {title}
      </h3>
      <p className="m-0 t-reading text-[14.5px] text-ink-2">{body}</p>
    </BorderedCard>
  );
}
