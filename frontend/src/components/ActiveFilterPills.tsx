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

/** Shared CSS classes for a single filter pill. */
const pillClasses =
  "inline-flex items-center gap-1.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-card)] px-2.5 py-0.5 text-[12px] text-[var(--text-secondary)] font-[var(--font-body)] theme-transition hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

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

  /** Human label for the active risk level (from RiskChart.labels namespace). */
  const riskLabel = hasRisk ? tRisk(`labels.${riskFilter}`) : null;

  /** Human label for the active category (from ClauseCategory namespace). */
  const categoryLabel = hasCategory ? tCat(categoryFilter) : null;

  return (
    <div className="mt-4 mb-2 flex flex-wrap items-center gap-2">
      {/* Risk pill */}
      {hasRisk && riskLabel !== null && (
        <button
          type="button"
          className={pillClasses}
          aria-label={t("removeFilter", { label: riskLabel })}
          onClick={onClearRisk}
        >
          <span>
            <span className="font-semibold">{t("riskPrefix")}</span>{" "}
            {riskLabel}
          </span>
          <span aria-hidden="true" className="text-[11px] opacity-60">
            ×
          </span>
        </button>
      )}

      {/* Category pill */}
      {hasCategory && categoryLabel !== null && (
        <button
          type="button"
          className={pillClasses}
          aria-label={t("removeFilter", { label: categoryLabel })}
          onClick={onClearCategory}
        >
          <span>
            <span className="font-semibold">{t("categoryPrefix")}</span>{" "}
            {categoryLabel}
          </span>
          <span aria-hidden="true" className="text-[11px] opacity-60">
            ×
          </span>
        </button>
      )}

      {/* Clear all */}
      <button
        type="button"
        onClick={onClearAll}
        className="text-[12px] text-[var(--text-muted)] font-[var(--font-body)] underline underline-offset-2 hover:text-[var(--text-secondary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        {t("clearAll")}
      </button>
    </div>
  );
}
