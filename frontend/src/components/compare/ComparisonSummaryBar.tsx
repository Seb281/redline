/**
 * Horizontal summary band — 4 StatBlocks + overall-lean sentence +
 * jurisdiction pair — rendered above the diff table.
 *
 * Purely presentational. Derives its labels from the `Compare`
 * namespace and renders `ComparisonStats` + light contract metadata
 * without touching engine logic.
 */

"use client";

import { useTranslations } from "next-intl";
import type { ComparisonStats } from "@/lib/compare/types";
import type { ContractOverview } from "@/types";
import { MonoLabel } from "@/components/ui/MonoLabel";

/** Props for {@link ComparisonSummaryBar}. */
interface ComparisonSummaryBarProps {
  stats: ComparisonStats;
  labelA: string;
  labelB: string;
  overviewA: ContractOverview;
  overviewB: ContractOverview;
}

/**
 * StatBlock variant — Fraunces numeral + mono caption — with an
 * explicit `data-testid` so the compare tests can still count cards.
 * Reimplemented locally (rather than reused from ui/StatBlock) only
 * because the tests expect the `compare-stat-card` testid.
 */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1" data-testid="compare-stat-card">
      <MonoLabel tone="muted">{label}</MonoLabel>
      <span className="font-serif text-[36px] font-light leading-none text-ink">
        {value}
      </span>
    </div>
  );
}

/**
 * Reads the `governing_jurisdiction` string per contract (already
 * human-formatted upstream). Returns the string or a dash fallback —
 * translation happens in the caller's locale.
 */
function juris(overview: ContractOverview, dash: string): string {
  const j = overview.governing_jurisdiction;
  return j && j.trim().length > 0 ? j : dash;
}

/**
 * Collects citation codes attached to clauses of the given overview.
 * `ComparisonSummaryBar` only knows overviews here, not clauses, so we
 * accept the counts pre-computed by the caller.
 */
export function ComparisonSummaryBar({
  stats,
  labelA,
  labelB,
  overviewA,
  overviewB,
}: ComparisonSummaryBarProps) {
  const t = useTranslations("Compare");
  const dash = t("jurisdictionUnknown");

  const leanLabel =
    stats.overallLean === "a"
      ? t("leanA", { label: labelA })
      : stats.overallLean === "b"
        ? t("leanB", { label: labelB })
        : t("leanComparable");

  return (
    <section className="flex flex-col gap-6 border-y border-ink py-6">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <StatCard
          label={t("statRiskierIn", { label: labelB })}
          value={stats.riskierInB}
        />
        <StatCard
          label={t("statRiskierIn", { label: labelA })}
          value={stats.riskierInA}
        />
        <StatCard label={t("statUniqueToOne")} value={stats.uniqueToOne} />
        <StatCard label={t("statSameRisk")} value={stats.sameRiskLevel} />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-paper-edge pt-4">
        <span
          className="font-serif text-[18px] italic font-light leading-tight text-red-accent"
          data-testid="compare-lean-badge"
        >
          {leanLabel}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[1.5px] text-ink-muted">
          {t("jurisdictionPair", {
            a: juris(overviewA, dash),
            b: juris(overviewB, dash),
          })}
        </span>
      </div>
    </section>
  );
}
