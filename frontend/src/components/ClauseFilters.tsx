/** Filter and sort controls for clause list. */

"use client";

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

const RISK_OPTIONS: { value: RiskLevel | "all"; label: string }[] = [
  { value: "all", label: "All risks" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CATEGORY_OPTIONS: { value: ClauseCategory | "all"; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "non_compete", label: "Non-Compete" },
  { value: "liability", label: "Liability" },
  { value: "termination", label: "Termination" },
  { value: "ip_assignment", label: "IP Assignment" },
  { value: "confidentiality", label: "Confidentiality" },
  { value: "governing_law", label: "Governing Law" },
  { value: "indemnification", label: "Indemnification" },
  { value: "data_protection", label: "Data Protection" },
  { value: "payment_terms", label: "Payment Terms" },
  { value: "limitation_of_liability", label: "Limitation of Liability" },
  { value: "force_majeure", label: "Force Majeure" },
  { value: "dispute_resolution", label: "Dispute Resolution" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "risk-desc", label: "Risk: High → Low" },
  { value: "risk-asc", label: "Risk: Low → High" },
  { value: "category", label: "Category" },
];

const selectClasses =
  "rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)] font-[var(--font-body)] theme-transition focus:border-[var(--accent)] focus:outline-none";

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
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <select
        value={riskFilter}
        onChange={(e) => onRiskFilterChange(e.target.value as RiskLevel | "all")}
        className={selectClasses}
        aria-label="Filter by risk level"
      >
        {RISK_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value as ClauseCategory | "all")}
        className={selectClasses}
        aria-label="Filter by category"
      >
        {CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className={selectClasses}
        aria-label="Sort clauses"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {filteredCount !== totalCount && (
        <span className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]">
          {filteredCount} of {totalCount} clauses
        </span>
      )}
    </div>
  );
}
