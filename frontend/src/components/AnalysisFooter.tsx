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
import { LEGACY_PROVENANCE_PROVIDER } from "@/lib/analyzer";
import type { AnalysisProvenance, ReasoningEffortLabel } from "@/types";

interface AnalysisFooterProps {
  provenance: AnalysisProvenance;
}

/** Uppercase micro-label styling used throughout the expanded panel. */
const LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]";

/** Monospace value styling for identifiers and timestamps. */
const VALUE_CLASS =
  "text-[13px] text-[var(--text-secondary)] font-[var(--font-mono)] select-all break-all";

/** Map an effort level to a restrained text color token. */
function effortColor(level: ReasoningEffortLabel): string {
  if (level === "high") return "var(--accent)";
  if (level === "medium") return "var(--text-secondary)";
  return "var(--text-muted)";
}

/** Stacked label + monospace value block used in the expanded panel.
 * Renders an em-dash for empty values so the grid stays readable when
 * a provenance field happens to be blank. */
function MetaField({ label, value }: { label: string; value: string }) {
  const displayValue = value && value.trim() ? value : "\u2014";
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL_CLASS}>{label}</span>
      <span className={VALUE_CLASS}>{displayValue}</span>
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
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[13px] text-[var(--text-tertiary)] font-[var(--font-body)]">
        {name}
      </span>
      <span
        className="text-[13px] font-[var(--font-mono)] uppercase tracking-[1px]"
        style={{ color: effortColor(effort) }}
      >
        {effort}
      </span>
    </div>
  );
}

/** Graceful fallback for saved analyses predating transparency logging. */
function LegacyFooter() {
  return (
    <footer className="mt-10 border-t border-[var(--border-primary)] pt-5 pb-3 theme-transition">
      <p className="text-[12px] italic text-[var(--text-muted)] font-[var(--font-body)]">
        Recorded before transparency logging was enabled
      </p>
    </footer>
  );
}

/** Colophon footer rendered at the tail of an analysis report. */
export function AnalysisFooter({ provenance }: AnalysisFooterProps) {
  const [expanded, setExpanded] = useState(false);

  if (provenance.provider === LEGACY_PROVENANCE_PROVIDER) {
    return <LegacyFooter />;
  }

  // Prefer snapshot; fall back to model when snapshot is empty.
  const identifier = provenance.snapshot?.trim() || provenance.model;
  const idClass =
    "text-[13px] text-[var(--text-secondary)] font-[var(--font-mono)] select-all break-all";
  const sepClass =
    "text-[13px] text-[var(--text-muted)] font-[var(--font-mono)] select-none px-1";

  return (
    <footer className="mt-10 border-t border-[var(--border-primary)] pt-5 pb-3 theme-transition">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
          <span
            className="text-[13px] font-semibold uppercase tracking-[2px] text-[var(--text-tertiary)] font-[var(--font-body)]"
          >
            Recorded by
          </span>
          {/* Each identifier is its own `select-all` span so a single
              click copies JUST that value (the separator dots are
              `select-none` and stay out of the selection). */}
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
          className="group inline-flex items-center gap-1 self-start text-[12px] uppercase tracking-[1.5px] text-[var(--text-tertiary)] font-[var(--font-body)] transition-colors hover:text-[var(--text-secondary)] hover:underline"
        >
          <span>details</span>
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
        className={`grid overflow-hidden transition-all duration-200 ease-out ${expanded ? "max-h-[400px] opacity-100 mt-6" : "max-h-0 opacity-0"}`}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <MetaField label="Provider" value={provenance.provider} />
            <MetaField label="Model" value={provenance.model} />
            <MetaField label="Snapshot" value={provenance.snapshot} />
            <MetaField label="Region" value={provenance.region} />
            <MetaField
              label="Prompt template"
              value={provenance.prompt_template_version}
            />
            <MetaField label="Recorded at" value={provenance.timestamp} />
            <MetaField
              label="Redaction"
              value={
                provenance.redaction_location === "client"
                  ? "Analysis: client-side · Chat: API-boundary"
                  : provenance.redaction_location === "server"
                    ? "API boundary (server-side)"
                    : "\u2014"
              }
            />
          </div>

          <div className="flex flex-col gap-3">
            <span className={LABEL_CLASS}>Pass effort</span>
            <div className="flex flex-col gap-2">
              <PassEffortRow
                name="Overview"
                effort={provenance.reasoning_effort_per_pass.overview}
              />
              <PassEffortRow
                name="Extraction"
                effort={provenance.reasoning_effort_per_pass.extraction}
              />
              <PassEffortRow
                name="Risk"
                effort={provenance.reasoning_effort_per_pass.risk}
              />
              <PassEffortRow
                name="Think hard"
                effort={provenance.reasoning_effort_per_pass.think_hard}
              />
            </div>
          </div>
        </div>

        <p className="mt-5 text-[12px] italic text-[var(--text-muted)] font-[var(--font-body)]">
          This analysis was produced by a generative AI system. Logged per EU AI Act transparency requirements.
        </p>
      </div>
    </footer>
  );
}
