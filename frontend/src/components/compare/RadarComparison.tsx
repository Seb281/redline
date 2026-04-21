/**
 * Side-by-side radar comparison of two contracts.
 *
 * Decision (locked): NOT an overlay. Each contract gets its own
 * `<RiskRadar>` SVG over its own category set — we don't force a union
 * axis. Category mismatches surface via the summary bar's
 * "unique to one" counter rather than via ghost axes on the radars.
 *
 * Slot A panel carries a 1px ink border; Slot B panel carries a 2px
 * red-accent border so the pair echoes the slot cards and diff rails.
 * The component is purely presentational: no filter wiring, no click
 * handlers.
 */

"use client";

import { useTranslations } from "next-intl";
import type { AnalyzedClause } from "@/types";
import { RiskRadar } from "@/components/RiskRadar";
import { BorderedCard } from "@/components/ui/BorderedCard";
import { MonoLabel } from "@/components/ui/MonoLabel";

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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <RadarPanel
        tone="ink"
        label={labelA}
        clauses={clausesA}
        clausesLabel={t("clauses", { count: clausesA.length })}
      />
      <RadarPanel
        tone="red"
        label={labelB}
        clauses={clausesB}
        clausesLabel={t("clauses", { count: clausesB.length })}
      />
    </div>
  );
}

/**
 * A single radar panel — tone-coded masthead + SVG. Split out so both
 * sides share identical chrome and the container grid stays clean.
 */
function RadarPanel({
  tone,
  label,
  clauses,
  clausesLabel,
}: {
  tone: "ink" | "red";
  label: string;
  clauses: AnalyzedClause[];
  clausesLabel: string;
}) {
  const kickerTone = tone === "red" ? "red" : "ink";

  return (
    <BorderedCard tone={tone} padding="md" data-testid="radar-panel">
      <div className="flex flex-col items-center">
        <MonoLabel tone={kickerTone} className="block">
          {label}
        </MonoLabel>
        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted">
          {clausesLabel}
        </p>
        <div className="mt-3 w-full max-w-[260px]">
          <RiskRadar clauses={clauses} />
        </div>
      </div>
    </BorderedCard>
  );
}
