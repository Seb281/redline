/**
 * Progressive report view rendered during streaming analysis.
 *
 * Shows overview, clauses, and summary as they arrive from the NDJSON
 * stream. Once analysis completes, page.tsx transitions to the full
 * ReportView with filters and export.
 */

"use client";

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
  const { overview, clauses, clauseCount, summary, provenance, status, error, rawText, tokenMap } = state;

  // Nothing yet — show initial loading state with stepper.
  if (!overview && (status === "analyzing_overview" || status === "analyzing")) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        {/* File info bar */}
        <div className="mb-9 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5 py-3 text-[15px] text-[var(--text-secondary)] font-[var(--font-body)] theme-transition">
          {upload.filename} · {upload.page_count} {upload.page_count === 1 ? "page" : "pages"} · {upload.char_count.toLocaleString()} chars
        </div>
        <div className="w-full max-w-md">
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
      <div className="mb-7 flex gap-5">
        <div className="grid flex-1 grid-cols-4 gap-4">
          {(["high", "medium", "low", "informational"] as const).map((level) => {
            const value = summary?.risk_breakdown[level];
            const colorMap = {
              high: { text: "var(--risk-high)", border: "var(--risk-high-border)", bg: "var(--risk-high-bg)" },
              medium: { text: "var(--risk-medium)", border: "var(--risk-medium-border)", bg: "var(--risk-medium-bg)" },
              low: { text: "var(--risk-low)", border: "var(--risk-low-border)", bg: "var(--risk-low-bg)" },
              informational: { text: "var(--risk-info)", border: "var(--risk-info-border)", bg: "var(--risk-info-bg)" },
            }[level];
            const label = { high: "High Risk", medium: "Medium Risk", low: "Low Risk", informational: "Info" }[level];

            return (
              <div
                key={level}
                className="rounded border p-5 text-center theme-transition"
                style={{ borderColor: colorMap.border, backgroundColor: colorMap.bg }}
              >
                <p className="text-[36px] font-bold font-[var(--font-body)]" style={{ color: colorMap.text }}>
                  {value ?? "—"}
                </p>
                <p className="text-sm opacity-70 font-[var(--font-body)]" style={{ color: colorMap.text }}>
                  {label}
                </p>
              </div>
            );
          })}
        </div>
        {summary ? (
          <RiskChart breakdown={summary.risk_breakdown} />
        ) : (
          <div className="flex flex-col items-center justify-center" style={{ width: 90 }}>
            <div className="h-[90px] w-[90px] animate-pulse rounded-full bg-[var(--bg-tertiary)]" />
            <p className="mt-1.5 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">clauses</p>
          </div>
        )}
      </div>

      {/* Top risks — only after complete */}
      {summary && summary.top_risks.length > 0 && (
        <div className="mb-7 rounded border border-[var(--risk-high-border)] bg-[var(--accent-subtle)] px-5 py-3.5 theme-transition">
          <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
            Top Risks
          </p>
          <ul className="text-[15px] text-[var(--text-secondary)] font-[var(--font-body)]">
            {summary.top_risks.map((risk, i) => (
              <li key={i}>• {risk}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Unusual clauses — only after complete */}
      {summary && <UnusualClausesCallout clauses={clauses} />}

      {/* Error banner with retry */}
      {error && (
        <div className="mb-5 flex items-center justify-between rounded border border-[var(--risk-high-border)] bg-[var(--risk-high-bg)] px-5 py-3.5 theme-transition">
          <p className="text-[15px] text-[var(--risk-high)] font-[var(--font-body)]">
            {(retryCount ?? 0) >= 2
              ? "Analysis failed. Check your connection and try again."
              : `Analysis error: ${error}`}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-4 rounded border border-[var(--risk-high-border)] px-4 py-2 text-[15px] font-medium text-[var(--risk-high)] font-[var(--font-body)] transition-colors hover:bg-[var(--risk-high-bg)]"
            >
              Retry
            </button>
          )}
        </div>
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
              className="animate-pulse rounded border border-[var(--border-primary)] border-l-4 border-l-[var(--border-secondary)] bg-[var(--bg-card)] p-5 theme-transition"
            >
              <div className="mb-3.5 flex gap-2.5">
                <div className="h-6 w-18 rounded bg-[var(--bg-tertiary)]" />
                <div className="h-6 w-28 rounded bg-[var(--bg-tertiary)]" />
              </div>
              <div className="mb-2.5 h-5 w-56 rounded bg-[var(--bg-tertiary)]" />
              <div className="h-3.5 w-full rounded bg-[var(--bg-tertiary)]" />
            </div>
          ))}
        </div>
      )}

      {/* Transparency colophon — EU AI Act disclosure of the machine
          that produced the analysis. Only render once provenance is
          attached (i.e. after the `complete` event). */}
      {provenance && <AnalysisFooter provenance={provenance} />}

      {/* Bottom bar — reset only during streaming, full actions after complete */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]/95 backdrop-blur-sm theme-transition">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5 sm:px-7">
          <button
            type="button"
            onClick={onReset}
            className="rounded px-5 py-2.5 text-[15px] text-[var(--text-muted)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
          >
            Cancel
          </button>
          {status === "analyzing" && (
            <span className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">
              Analysis in progress...
            </span>
          )}
        </div>
      </div>
      </div>
    </CitationNavProvider>
  );
}
