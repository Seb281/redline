/**
 * Dismissible pill row reflecting active riskFilter / categoryFilter.
 *
 * Renders null when both filters are "all" (nothing to show).
 * Each pill is a native <button> (keyboard-accessible by default).
 * A "Clear all" link-style button resets both filters at once.
 *
 * Props are plain values + callbacks — state lives in ReportView.
 */

"use client";

import { useTranslations } from "next-intl";
import type { ClauseCategory, RiskLevel } from "@/types";

/** Props for {@link ActiveFilterPills}. */
export interface ActiveFilterPillsProps {
  /** Current risk filter — "all" means inactive. */
  riskFilter: RiskLevel | "all";
  /** Current category filter — "all" means inactive. */
  categoryFilter: ClauseCategory | "all";
  /** Called when the risk pill is dismissed. Should reset riskFilter to "all". */
  onClearRisk: () => void;
  /** Called when the category pill is dismissed. Should reset categoryFilter to "all". */
  onClearCategory: () => void;
  /** Called when "Clear all" is clicked. Should reset both filters to "all". */
  onClearAll: () => void;
}

/** Shared editorial pill — 1px ink rectangle, mono uppercase label. */
const pillClasses =
  "inline-flex items-center gap-2 border border-ink bg-paper px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink transition-colors hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-accent";

/**
 * Row of active filter pills with per-pill dismiss and a "Clear all" control.
 * Returns null when neither riskFilter nor categoryFilter is active.
 */
export function ActiveFilterPills({
  riskFilter,
  categoryFilter,
  onClearRisk,
  onClearCategory,
  onClearAll,
}: ActiveFilterPillsProps) {
  const t = useTranslations("ActiveFilterPills");
  const tRisk = useTranslations("RiskChart");
  const tCat = useTranslations("ClauseCategory");

  const hasRisk = riskFilter !== "all";
  const hasCategory = categoryFilter !== "all";

  if (!hasRisk && !hasCategory) return null;

  const riskLabel = hasRisk ? tRisk(`labels.${riskFilter}`) : null;
  const categoryLabel = hasCategory ? tCat(categoryFilter) : null;

  return (
    <div className="mt-3 mb-2 flex flex-wrap items-center gap-2">
      {hasRisk && riskLabel !== null && (
        <button
          type="button"
          className={pillClasses}
          aria-label={t("removeFilter", { label: riskLabel })}
          onClick={onClearRisk}
        >
          <span className="text-ink-muted">{t("riskPrefix")}</span>
          <span>{riskLabel}</span>
          <span aria-hidden="true" className="text-red-accent">
            ×
          </span>
        </button>
      )}

      {hasCategory && categoryLabel !== null && (
        <button
          type="button"
          className={pillClasses}
          aria-label={t("removeFilter", { label: categoryLabel })}
          onClick={onClearCategory}
        >
          <span className="text-ink-muted">{t("categoryPrefix")}</span>
          <span>{categoryLabel}</span>
          <span aria-hidden="true" className="text-red-accent">
            ×
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={onClearAll}
        className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted underline-offset-2 transition-colors hover:text-red-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-accent"
      >
        {t("clearAll")}
      </button>
    </div>
  );
}
