/**
 * Editorial colophon rendered at the tail of every analysis report.
 *
 * Names the machine that wrote the analysis: provider, model snapshot,
 * region, timestamp, and the reasoning effort applied per pipeline
 * pass. Logged per EU AI Act transparency requirements so a user
 * reading a saved analysis can trace exactly which system produced it
 * and under which prompt-template contract.
 *
 * Two variants:
 *   - Fresh analyses: collapsed summary row with a disclosure toggle
 *     revealing a full metadata table.
 *   - Legacy placeholder (pre-Phase 5 saved rows): a single muted line
 *     explaining that transparency logging was not yet enabled when
 *     this analysis was produced.
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LEGACY_PROVENANCE_PROVIDER } from "@/lib/analyzer";
import type { AnalysisProvenance, ReasoningEffortLabel } from "@/types";
import { MonoLabel } from "@/components/ui/MonoLabel";

interface AnalysisFooterProps {
  provenance: AnalysisProvenance;
  /**
   * SP-9 — trigger a download of the machine-readable transparency
   * receipt (JSON). Optional so the footer still renders when mounted
   * outside `ReportView` (e.g. the saved-analysis preview in the
   * history tests). When omitted, the download affordance is hidden
   * rather than rendered in a half-wired state.
   */
  onDownloadReceipt?: () => void | Promise<void>;
}

/** Map an effort level to a restrained editorial tone class. */
function effortToneClass(level: ReasoningEffortLabel): string {
  if (level === "high") return "text-red-accent";
  if (level === "medium") return "text-ink-2";
  return "text-ink-muted";
}

/** Stacked label + monospace value block used in the expanded panel.
 * Renders an em-dash for empty values so the grid stays readable when
 * a provenance field happens to be blank. */
function MetaField({ label, value }: { label: string; value: string }) {
  const displayValue = value && value.trim() ? value : "\u2014";
  return (
    <div className="flex flex-col gap-1">
      <MonoLabel tone="muted">{label}</MonoLabel>
      <span className="font-mono text-[12px] text-ink-2 select-all break-all">
        {displayValue}
      </span>
    </div>
  );
}

/** Pass-effort row: human-readable pass name on the left, effort on the right. */
function PassEffortRow({
  name,
  effort,
}: {
  name: string;
  effort: ReasoningEffortLabel;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-paper-edge py-1.5 last:border-b-0">
      <span className="t-reading text-[14px] text-ink-2">{name}</span>
      <span
        className={`font-mono text-[11px] uppercase tracking-[1.2px] ${effortToneClass(effort)}`}
      >
        {effort}
      </span>
    </div>
  );
}

/** Graceful fallback for saved analyses predating transparency logging. */
function LegacyFooter() {
  const t = useTranslations("AnalysisFooter");
  return (
    <footer className="mt-10 border-t border-ink pt-4 pb-3">
      <p className="font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted">
        {t("legacyNote")}
      </p>
    </footer>
  );
}

/** Colophon footer rendered at the tail of an analysis report. */
export function AnalysisFooter({
  provenance,
  onDownloadReceipt,
}: AnalysisFooterProps) {
  const t = useTranslations("AnalysisFooter");
  const [expanded, setExpanded] = useState(false);

  if (provenance.provider === LEGACY_PROVENANCE_PROVIDER) {
    return <LegacyFooter />;
  }

  // Prefer snapshot; fall back to model when snapshot is empty.
  const identifier = provenance.snapshot?.trim() || provenance.model;
  const idClass =
    "font-mono text-[11px] text-ink-2 select-all break-all";
  const sepClass =
    "font-mono text-[11px] text-ink-muted select-none px-1";

  return (
    <footer className="mt-10 border-t border-ink pt-5 pb-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-4">
          <MonoLabel tone="muted">{t("recordedBy")}</MonoLabel>
          <span
            data-testid="collapsed-summary"
            className="flex flex-wrap items-baseline"
          >
            <span className={idClass}>{identifier}</span>
            <span className={sepClass} aria-hidden="true">·</span>
            <span className={idClass}>{provenance.region}</span>
            <span className={sepClass} aria-hidden="true">·</span>
            <span className={idClass}>{provenance.timestamp}</span>
          </span>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="group inline-flex items-center gap-1 self-start font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent"
        >
          <span>{t("details")}</span>
          <span
            data-glyph
            className={`inline-block transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            {"\u25BE"}
          </span>
        </button>
      </div>

      <div
        className={`grid overflow-hidden transition-all duration-200 ease-out ${expanded ? "max-h-[480px] opacity-100 mt-6" : "max-h-0 opacity-0"}`}
      >
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <MetaField label={t("provider")} value={provenance.provider} />
            <MetaField label={t("model")} value={provenance.model} />
            <MetaField label={t("snapshot")} value={provenance.snapshot} />
            <MetaField label={t("region")} value={provenance.region} />
            <MetaField
              label={t("promptTemplate")}
              value={provenance.prompt_template_version}
            />
            <MetaField label={t("recordedAt")} value={provenance.timestamp} />
            <MetaField
              label={t("redaction")}
              value={
                provenance.redaction_location === "client"
                  ? t("clientAnalysis")
                  : provenance.redaction_location === "server"
                    ? t("apiBoundary")
                    : "\u2014"
              }
            />
            <MetaField
              label={t("schemaVersion")}
              value={provenance.schema_version ?? "\u2014"}
            />
          </div>

          <div className="flex flex-col gap-3">
            <MonoLabel tone="muted">{t("passEffort")}</MonoLabel>
            <div className="border-t border-paper-edge">
              <PassEffortRow
                name={t("passOverview")}
                effort={provenance.reasoning_effort_per_pass.overview}
              />
              <PassEffortRow
                name={t("passExtraction")}
                effort={provenance.reasoning_effort_per_pass.extraction}
              />
              <PassEffortRow
                name={t("passRisk")}
                effort={provenance.reasoning_effort_per_pass.risk}
              />
              <PassEffortRow
                name={t("passThinkHard")}
                effort={provenance.reasoning_effort_per_pass.think_hard}
              />
            </div>
          </div>
        </div>

        <p className="t-reading mt-5 text-[13px] italic text-ink-muted">
          {t("disclosure")}
        </p>

        <div className="mt-4 flex flex-col gap-3 border-t border-paper-edge pt-4 sm:flex-row sm:items-center sm:justify-between">
          {onDownloadReceipt && (
            <button
              type="button"
              onClick={() => {
                void onDownloadReceipt();
              }}
              data-testid="download-transparency-receipt"
              className="inline-flex items-baseline gap-1 self-start font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent hover:underline"
            >
              <span>{t("downloadReceipt")}</span>
            </button>
          )}
          <Link
            href="/transparency"
            className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent hover:underline"
          >
            {t("transparencyPageLink")}
          </Link>
        </div>
      </div>

      {provenance.text_source === "ocr" && (
        <p
          className="mt-4 font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted"
          data-testid="ocr-note"
        >
          {t("ocrNote")}
        </p>
      )}
      {provenance.text_source === "hybrid" && (
        <p
          className="mt-4 font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted"
          data-testid="ocr-note"
        >
          {t("hybridOcrNote")}
        </p>
      )}
    </footer>
  );
}
