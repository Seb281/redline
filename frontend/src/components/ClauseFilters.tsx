/** Filter and sort controls for clause list. */

"use client";

import { useTranslations } from "next-intl";
import type { ClauseCategory, RiskLevel } from "@/types";

export type SortOption = "risk-desc" | "risk-asc" | "category";

interface ClauseFiltersProps {
  riskFilter: RiskLevel | "all";
  categoryFilter: ClauseCategory | "all";
  sort: SortOption;
  onRiskFilterChange: (value: RiskLevel | "all") => void;
  onCategoryFilterChange: (value: ClauseCategory | "all") => void;
  onSortChange: (value: SortOption) => void;
  totalCount: number;
  filteredCount: number;
}

const RISK_VALUES: (RiskLevel | "all")[] = [
  "all",
  "high",
  "medium",
  "low",
  "informational",
];

const RISK_KEY: Record<RiskLevel | "all", string> = {
  all: "allRisks",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "info",
};

const CATEGORY_VALUES: (ClauseCategory | "all")[] = [
  "all",
  "non_compete",
  "liability",
  "termination",
  "ip_assignment",
  "confidentiality",
  "governing_law",
  "indemnification",
  "data_protection",
  "payment_terms",
  "limitation_of_liability",
  "force_majeure",
  "dispute_resolution",
  "other",
];

const SORT_VALUES: SortOption[] = ["risk-desc", "risk-asc", "category"];

const SORT_KEY: Record<SortOption, string> = {
  "risk-desc": "sortRiskHighLow",
  "risk-asc": "sortRiskLowHigh",
  category: "sortCategory",
};

const selectClasses =
  "rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-3.5 py-2 text-[15px] text-[var(--text-secondary)] font-[var(--font-body)] theme-transition focus:border-[var(--accent)] focus:outline-none";

/** Filter bar above clause cards. */
export function ClauseFilters({
  riskFilter,
  categoryFilter,
  sort,
  onRiskFilterChange,
  onCategoryFilterChange,
  onSortChange,
  totalCount,
  filteredCount,
}: ClauseFiltersProps) {
  const t = useTranslations("ClauseFilters");
  const tCat = useTranslations("ClauseCategory");
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3.5">
      <select
        value={riskFilter}
        onChange={(e) => onRiskFilterChange(e.target.value as RiskLevel | "all")}
        className={selectClasses}
        aria-label={t("filterByRisk")}
      >
        {RISK_VALUES.map((v) => (
          <option key={v} value={v}>{t(RISK_KEY[v])}</option>
        ))}
      </select>

      <select
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value as ClauseCategory | "all")}
        className={selectClasses}
        aria-label={t("filterByCategory")}
      >
        {CATEGORY_VALUES.map((v) => (
          <option key={v} value={v}>
            {v === "all" ? t("allCategories") : tCat(v)}
          </option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className={selectClasses}
        aria-label={t("sortClauses")}
      >
        {SORT_VALUES.map((v) => (
          <option key={v} value={v}>{t(SORT_KEY[v])}</option>
        ))}
      </select>

      {filteredCount !== totalCount && (
        <span className="text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
          {t("countOf", { filtered: filteredCount, total: totalCount })}
        </span>
      )}
    </div>
  );
}
