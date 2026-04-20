/**
 * Horizontal summary bar: 4 stat cards + overall-lean badge +
 * jurisdiction + applicable-law row.
 *
 * Purely presentational. Derives its labels from the `Compare`
 * namespace and renders `ComparisonStats` + light contract metadata
 * without touching engine logic.
 */

"use client";

import { useTranslations } from "next-intl";
import type { ComparisonStats } from "@/lib/compare/types";
import type { ContractOverview } from "@/types";

/** Props for {@link ComparisonSummaryBar}. */
interface ComparisonSummaryBarProps {
  stats: ComparisonStats;
  labelA: string;
  labelB: string;
  overviewA: ContractOverview;
  overviewB: ContractOverview;
}

/** Single stat card — label on top, big number below. */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex min-w-[120px] flex-1 flex-col rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-4 py-3 theme-transition"
      data-testid="compare-stat-card"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] font-[var(--font-heading)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
        {value}
      </p>
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      <div className="flex flex-wrap items-center gap-3 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-4 py-3 text-[13px] text-[var(--text-secondary)] font-[var(--font-body)] theme-transition">
        <span
          className="font-semibold text-[var(--accent)]"
          data-testid="compare-lean-badge"
        >
          {leanLabel}
        </span>
        <span className="h-3 w-px bg-[var(--border-primary)]" aria-hidden />
        <span>
          {t("jurisdictionPair", {
            a: juris(overviewA, dash),
            b: juris(overviewB, dash),
          })}
        </span>
      </div>
    </div>
  );
}
