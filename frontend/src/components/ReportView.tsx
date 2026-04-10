/** Full report view — overview, risk summary, filters, clause cards, sticky export bar. */

"use client";

import { useMemo, useState } from "react";
import type { AnalyzedClause, AnalyzeResponse, ClauseCategory, RiskLevel } from "@/types";
import { ClauseCard } from "@/components/ClauseCard";
import { ClauseFilters, type SortOption } from "@/components/ClauseFilters";
import { ContractOverview } from "@/components/ContractOverview";
import { RiskChart } from "@/components/RiskChart";
import { UnusualClausesCallout } from "@/components/UnusualClausesCallout";
import { downloadMarkdown, downloadPdf } from "@/lib/export";

interface ReportViewProps {
  data: AnalyzeResponse;
  onReset: () => void;
}

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

/** Applies filters and sorting to clause list. */
function useFilteredClauses(
  clauses: AnalyzedClause[],
  riskFilter: RiskLevel | "all",
  categoryFilter: ClauseCategory | "all",
  sort: SortOption
) {
  return useMemo(() => {
    let result = clauses;

    if (riskFilter !== "all") {
      result = result.filter((c) => c.risk_level === riskFilter);
    }
    if (categoryFilter !== "all") {
      result = result.filter((c) => c.category === categoryFilter);
    }

    return [...result].sort((a, b) => {
      if (sort === "risk-desc") return RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level];
      if (sort === "risk-asc") return RISK_ORDER[b.risk_level] - RISK_ORDER[a.risk_level];
      return a.category.localeCompare(b.category);
    });
  }, [clauses, riskFilter, categoryFilter, sort]);
}

/** Full analysis report with overview, summary, filters, clause cards, and export bar. */
export function ReportView({ data, onReset }: ReportViewProps) {
  const [exporting, setExporting] = useState(false);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ClauseCategory | "all">("all");
  const [sort, setSort] = useState<SortOption>("risk-desc");

  const { summary, clauses } = data;
  const filteredClauses = useFilteredClauses(clauses, riskFilter, categoryFilter, sort);

  const handlePdfExport = async () => {
    setExporting(true);
    try {
      await downloadPdf(data);
    } catch {
      alert("PDF export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="pb-20">
      {/* Contract overview */}
      <ContractOverview overview={data.overview} />

      {/* Risk summary — cards + chart */}
      <div className="mb-6 flex gap-4">
        <div className="grid flex-1 grid-cols-3 gap-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-950/40">
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {summary.risk_breakdown.high}
            </p>
            <p className="text-xs text-red-500 dark:text-red-400/70">High Risk</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-900 dark:bg-yellow-950/40">
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {summary.risk_breakdown.medium}
            </p>
            <p className="text-xs text-yellow-500 dark:text-yellow-400/70">Medium Risk</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950/40">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {summary.risk_breakdown.low}
            </p>
            <p className="text-xs text-green-500 dark:text-green-400/70">Low Risk</p>
          </div>
        </div>
        <RiskChart breakdown={summary.risk_breakdown} />
      </div>

      {/* Top risks callout */}
      {summary.top_risks.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
          <p className="mb-1 text-xs font-semibold uppercase text-red-600 dark:text-red-400">
            Top Risks
          </p>
          <ul className="text-sm text-[var(--text-secondary)]">
            {summary.top_risks.map((risk, i) => (
              <li key={i}>• {risk}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Unusual clauses */}
      <UnusualClausesCallout clauses={clauses} />

      {/* Filters */}
      <ClauseFilters
        riskFilter={riskFilter}
        categoryFilter={categoryFilter}
        sort={sort}
        onRiskFilterChange={setRiskFilter}
        onCategoryFilterChange={setCategoryFilter}
        onSortChange={setSort}
        totalCount={clauses.length}
        filteredCount={filteredClauses.length}
      />

      {/* Clause cards */}
      <div className="space-y-3">
        {filteredClauses.map((clause, i) => (
          <ClauseCard key={i} clause={clause} />
        ))}
        {filteredClauses.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">
            No clauses match the current filters.
          </p>
        )}
      </div>

      {/* Sticky export bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]/95 backdrop-blur-sm theme-transition">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadMarkdown(data)}
              className="rounded-md border border-[var(--border-primary)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              Export Markdown
            </button>
            <button
              type="button"
              onClick={handlePdfExport}
              disabled={exporting}
              className="rounded-md border border-[var(--border-primary)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
            >
              {exporting ? "Generating..." : "Export PDF"}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-md px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
            >
              New Contract
            </button>
          </div>
          <span className="text-xs text-[var(--text-muted)]">Not legal advice</span>
        </div>
      </div>
    </div>
  );
}
