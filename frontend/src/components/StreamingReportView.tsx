/**
 * Progressive report view rendered during streaming analysis.
 *
 * Shows overview, clauses, and summary as they arrive from the NDJSON
 * stream. Once analysis completes, page.tsx transitions to the full
 * ReportView with filters and export.
 */

"use client";

import { useTranslations } from "next-intl";
import type { StreamingAnalysisState } from "@/hooks/useStreamingAnalysis";
import type { UploadResponse } from "@/types";
import { AnalysisFooter } from "@/components/AnalysisFooter";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { ClauseCard } from "@/components/ClauseCard";
import { ContractOverview } from "@/components/ContractOverview";
import { RedactionPreview } from "@/components/RedactionPreview";
import { RiskChart } from "@/components/RiskChart";
import { RolePicker } from "@/components/RolePicker";
import { UnusualClausesCallout } from "@/components/UnusualClausesCallout";
import { CitationNavProvider } from "@/contexts/CitationNavContext";
import { rebuildScrubbed } from "@/lib/redaction";
import { BorderedCard, Button, Kicker } from "@/components/ui";

interface StreamingReportViewProps {
  state: StreamingAnalysisState;
  upload: UploadResponse;
  onReset: () => void;
  /**
   * Callback fired when the user picks (or skips) a party in the role
   * picker shown between the overview and extraction passes. `null`
   * means "skip — use default weaker-party framing".
   */
  onRolePicked: (role: string | null) => void;
  /**
   * Callback fired when the user confirms the redaction preview.
   * SP-1.9: receives the set of tokens to leave visible (disabled) —
   * the hook re-derives the active map from labels + raw text.
   */
  onRedactionConfirmed: (disabledTokens: Set<string>) => void;
  /** Callback fired when the user edits a party label in the RedactionPreview. */
  onEditPartyLabel: (index: number, rawLabel: string) => void;
  /** Retry the last failed step (overview or analysis). */
  onRetry?: () => void;
  /** How many retries have been attempted so far. */
  retryCount?: number;
}

/** Renders analysis results progressively as clauses stream in. */
export function StreamingReportView({
  state,
  upload,
  onReset,
  onRolePicked,
  onRedactionConfirmed,
  onEditPartyLabel,
  onRetry,
  retryCount,
}: StreamingReportViewProps) {
  const t = useTranslations("StreamingReportView");
  const { overview, clauses, clauseCount, summary, provenance, status, error, rawText, tokenMap } = state;

  // Nothing yet — show initial loading state with stepper.
  if (!overview && (status === "analyzing_overview" || status === "analyzing")) {
    return (
      <div className="py-10">
        <p className="font-mono text-[11px] uppercase tracking-[1.8px] text-red-accent">
          {t("passThreeOfFive")}
        </p>
        <h1 className="mt-4 font-serif text-[48px] font-light leading-[0.98] tracking-[-0.02em] text-ink m-0 md:text-[64px]">
          {t.rich("readingTitle", {
            em: (chunks) => (
              <em className="italic text-red-accent">{chunks}</em>
            ),
            br: () => <br />,
          })}
        </h1>
        <p className="t-reading text-ink-2 mt-6 max-w-[52ch] text-[18px] m-0">
          {t("readingLede")}
        </p>

        {/* File info line */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-paper-edge pt-4 font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
          <span className="text-ink-2">{upload.filename}</span>
          <span>{t("pages", { count: upload.page_count })}</span>
          <span>{t("chars", { count: upload.char_count })}</span>
        </div>

        <div className="mt-8">
          <AnalysisProgress
            status={status}
            analyzedCount={clauses.length}
            totalCount={clauseCount}
          />
        </div>
      </div>
    );
  }

  return (
    <CitationNavProvider>
      <div className="pb-24">
      {/* Step indicator */}
      <AnalysisProgress
        status={status}
        analyzedCount={clauses.length}
        totalCount={clauseCount}
      />

      {/* Contract overview — appears as soon as Pass 0 finishes */}
      {overview && (
        <ContractOverview overview={overview} labels={state.editableLabels} />
      )}

      {/* Redaction preview — shown between Pass 0 and role pick so the user
          can audit/toggle every PII token before the text hits Pass 1/2. */}
      {status === "awaiting_redaction" && rawText && tokenMap && (
        <RedactionPreview
          raw={rawText}
          scrubbed={rebuildScrubbed(
            rawText,
            tokenMap,
            tokenMap,
            overview?.pii_entities ?? [],
          )}
          tokenMap={tokenMap}
          parties={state.overview!.parties}
          editableLabels={state.editableLabels}
          onEditLabel={onEditPartyLabel}
          onConfirm={onRedactionConfirmed}
          onCancel={onReset}
        />
      )}

      {/* Role picker — shown between redaction and Pass 1 so the user can
          declare which party they are before risk analysis runs. */}
      {status === "awaiting_role" && overview && (
        <RolePicker
          parties={overview.parties}
          labels={state.editableLabels}
          onPick={onRolePicked}
        />
      )}

      {/* Risk summary — placeholder until complete */}
      <div className="mb-8 flex gap-5">
        <div className="grid flex-1 grid-cols-4 gap-4">
          {(["high", "medium", "low", "informational"] as const).map((level) => {
            const value = summary?.risk_breakdown[level];
            const toneClass = {
              high: "text-red-accent",
              medium: "text-warn",
              low: "text-ok",
              informational: "text-info",
            }[level];
            const label = { high: t("highRisk"), medium: t("mediumRisk"), low: t("lowRisk"), informational: t("info") }[level];

            return (
              <BorderedCard
                key={level}
                tone="edge"
                padding="sm"
                className="text-center"
              >
                <p className={`m-0 font-serif text-[32px] font-light leading-none ${toneClass}`}>
                  {value ?? "—"}
                </p>
                <p className="mt-2 m-0 font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted">
                  {label}
                </p>
              </BorderedCard>
            );
          })}
        </div>
        {summary ? (
          <RiskChart breakdown={summary.risk_breakdown} />
        ) : (
          <div className="flex flex-col items-center justify-center" style={{ width: 90 }}>
            <div className="h-[90px] w-[90px] animate-pulse border border-paper-edge bg-paper-2" />
            <p className="mt-2 m-0 font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted">{t("clauses")}</p>
          </div>
        )}
      </div>

      {/* Top risks — only after complete */}
      {summary && summary.top_risks.length > 0 && (
        <BorderedCard tone="red" padding="md" className="mb-7">
          <Kicker tone="red">{t("topRisks")}</Kicker>
          <ul className="mt-3 m-0 list-disc space-y-1 pl-5 t-reading text-[15px] text-ink-2 marker:text-red-accent">
            {summary.top_risks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </BorderedCard>
      )}

      {/* Unusual clauses — only after complete */}
      {summary && <UnusualClausesCallout clauses={clauses} />}

      {/* Error banner with retry */}
      {error && (
        <BorderedCard
          tone="red"
          padding="md"
          className="mb-6 flex flex-wrap items-center justify-between gap-4"
          role="alert"
        >
          <p className="m-0 font-serif text-[16px] italic text-ink">
            {(retryCount ?? 0) >= 2
              ? t("analysisFailed")
              : t("analysisError", { error })}
          </p>
          {onRetry && (
            <Button variant="danger" size="md" onClick={onRetry}>
              {t("retry")}
            </Button>
          )}
        </BorderedCard>
      )}

      {/* Clause cards — each animates in */}
      <div className="space-y-4">
        {clauses.map((clause, i) => (
          <div key={`${clause.title}-${clause.risk_level}-${i}`} className="clause-enter">
            <ClauseCard clause={clause} />
          </div>
        ))}
      </div>

      {/* Skeleton placeholders for remaining clauses */}
      {status === "analyzing" && clauseCount !== null && clauses.length < clauseCount && (
        <div className="mt-4 space-y-4">
          {Array.from({ length: Math.min(clauseCount - clauses.length, 3) }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="animate-pulse border border-paper-edge border-l-2 border-l-ink-muted bg-paper p-5"
            >
              <div className="mb-3 flex gap-2">
                <div className="h-5 w-16 bg-paper-2" />
                <div className="h-5 w-24 bg-paper-2" />
              </div>
              <div className="mb-2 h-5 w-56 bg-paper-2" />
              <div className="h-3 w-full bg-paper-2" />
            </div>
          ))}
        </div>
      )}

      {/* Transparency colophon — EU AI Act disclosure of the machine
          that produced the analysis. Only render once provenance is
          attached (i.e. after the `complete` event). */}
      {provenance && <AnalysisFooter provenance={provenance} />}

      {/* Bottom action bar — editorial sticky footer matching StickyActionBar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3 sm:px-7">
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[11px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent"
          >
            {t("cancel")}
          </button>
          {status === "analyzing" && (
            <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
              {t("inProgress")}
            </span>
          )}
        </div>
      </div>
      </div>
    </CitationNavProvider>
  );
}
