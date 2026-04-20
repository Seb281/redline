/**
 * Side-by-side radar comparison of two contracts.
 *
 * Decision (locked): NOT an overlay. Each contract gets its own
 * `<RiskRadar>` SVG over its own category set — we don't force a union
 * axis. Category mismatches surface via the summary bar's
 * "unique to one" counter rather than via ghost axes on the radars.
 *
 * The component is purely presentational: no filter wiring, no click
 * handlers. Tooltips + vertex colouring come for free from `RiskRadar`.
 */

"use client";

import { useTranslations } from "next-intl";
import type { AnalyzedClause } from "@/types";
import { RiskRadar } from "@/components/RiskRadar";

/** Props for {@link RadarComparison}. */
interface RadarComparisonProps {
  labelA: string;
  labelB: string;
  clausesA: AnalyzedClause[];
  clausesB: AnalyzedClause[];
}

/**
 * Renders two stacked radars (one per contract) in a responsive grid —
 * column on desktop, row on mobile. Each panel carries the contract
 * label and total clause count so users can tell them apart without
 * needing to read the larger metadata cards above.
 */
export function RadarComparison({
  labelA,
  labelB,
  clausesA,
  clausesB,
}: RadarComparisonProps) {
  const t = useTranslations("Compare");

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <RadarPanel
        label={labelA}
        clauses={clausesA}
        clausesLabel={t("clauses", { count: clausesA.length })}
      />
      <RadarPanel
        label={labelB}
        clauses={clausesB}
        clausesLabel={t("clauses", { count: clausesB.length })}
      />
    </div>
  );
}

/**
 * A single radar panel — title + SVG. Split out so both sides share
 * identical chrome and the container grid stays clean.
 */
function RadarPanel({
  label,
  clauses,
  clausesLabel,
}: {
  label: string;
  clauses: AnalyzedClause[];
  clausesLabel: string;
}) {
  return (
    <div
      className="flex flex-col items-center rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 theme-transition"
      data-testid="radar-panel"
    >
      <p className="mb-1 text-center text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] font-[var(--font-heading)]">
        {label}
      </p>
      <p className="mb-3 text-center text-[12px] text-[var(--text-muted)] font-[var(--font-body)]">
        {clausesLabel}
      </p>
      <div className="w-full max-w-[260px]">
        <RiskRadar clauses={clauses} />
      </div>
    </div>
  );
}
