/** Full report view — overview, risk summary, filters, clause cards, sticky export bar. */

"use client";

import { useMemo, useState } from "react";
import type { AnalyzedClause, AnalyzeResponse, ClauseCategory, RiskLevel } from "@/types";
import { ClauseCard } from "@/components/ClauseCard";
import { ClauseFilters, type SortOption } from "@/components/ClauseFilters";
import { ContractOverview } from "@/components/ContractOverview";
import { Disclaimer } from "@/components/Disclaimer";
import { RiskChart } from "@/components/RiskChart";
import { UnusualClausesCallout } from "@/components/UnusualClausesCallout";
import { CitationNavProvider } from "@/contexts/CitationNavContext";
import { downloadMarkdown, downloadPdf } from "@/lib/export";

interface ReportViewProps {
  data: AnalyzeResponse;
  onReset: () => void;
  onOpenChat?: () => void;
  onAskAboutClause?: (clause: AnalyzedClause) => void;
}

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, informational: 3 };

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
export function ReportView({ data, onReset, onOpenChat, onAskAboutClause }: ReportViewProps) {
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
    <CitationNavProvider>
      <div className="pb-24">
      {/* Contract overview */}
      <ContractOverview overview={data.overview} />

      {/* Risk summary — cards + chart */}
      <div className="mb-7 flex gap-5">
        <div className="grid flex-1 grid-cols-4 gap-4">
          <div className="rounded border border-[var(--risk-high-border)] bg-[var(--risk-high-bg)] p-5 text-center theme-transition">
            <p className="text-[36px] font-bold text-[var(--risk-high)] font-[var(--font-body)]">
              {summary.risk_breakdown.high}
            </p>
            <p className="text-sm text-[var(--risk-high)] opacity-70 font-[var(--font-body)]">High Risk</p>
          </div>
          <div className="rounded border border-[var(--risk-medium-border)] bg-[var(--risk-medium-bg)] p-5 text-center theme-transition">
            <p className="text-[36px] font-bold text-[var(--risk-medium)] font-[var(--font-body)]">
              {summary.risk_breakdown.medium}
            </p>
            <p className="text-sm text-[var(--risk-medium)] opacity-70 font-[var(--font-body)]">Medium Risk</p>
          </div>
          <div className="rounded border border-[var(--risk-low-border)] bg-[var(--risk-low-bg)] p-5 text-center theme-transition">
            <p className="text-[36px] font-bold text-[var(--risk-low)] font-[var(--font-body)]">
              {summary.risk_breakdown.low}
            </p>
            <p className="text-sm text-[var(--risk-low)] opacity-70 font-[var(--font-body)]">Low Risk</p>
          </div>
          <div className="rounded border border-[var(--risk-info-border)] bg-[var(--risk-info-bg)] p-5 text-center theme-transition">
            <p className="text-[36px] font-bold text-[var(--risk-info)] font-[var(--font-body)]">
              {summary.risk_breakdown.informational}
            </p>
            <p className="text-sm text-[var(--risk-info)] opacity-70 font-[var(--font-body)]">Info</p>
          </div>
        </div>
        <RiskChart breakdown={summary.risk_breakdown} />
      </div>

      {/* Top risks callout */}
      {summary.top_risks.length > 0 && (
        <div className="mb-7 rounded border border-[var(--risk-high-border)] bg-[var(--accent-subtle)] px-5 py-3.5 theme-transition">
          <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
            Top Risks
          </p>
          <ul className="text-[15px] text-[var(--text-secondary)] font-[var(--font-body)]">
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
      <div className="space-y-4">
        {filteredClauses.map((clause) => (
          <ClauseCard key={`${clause.title}-${clause.risk_level}`} clause={clause} onAskAbout={onAskAboutClause} />
        ))}
        {filteredClauses.length === 0 && (
          <p className="py-9 text-center text-[17px] text-[var(--text-muted)] font-[var(--font-body)]">
            No clauses match the current filters.
          </p>
        )}
      </div>

      {/* Disclaimer */}
      <Disclaimer />

      {/* Sticky export bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]/95 backdrop-blur-sm theme-transition">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5 sm:px-7">
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => downloadMarkdown(data)}
              className="rounded border border-[var(--border-primary)] px-5 py-2.5 text-[15px] font-medium text-[var(--text-secondary)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              Export Markdown
            </button>
            <button
              type="button"
              onClick={handlePdfExport}
              disabled={exporting}
              className="rounded border border-[var(--border-primary)] px-5 py-2.5 text-[15px] font-medium text-[var(--text-secondary)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
            >
              {exporting ? "Generating..." : "Export PDF"}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded px-5 py-2.5 text-[15px] text-[var(--text-muted)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
            >
              New Contract
            </button>
          </div>
          <div className="flex items-center gap-3">
            {onOpenChat && (
              <button
                type="button"
                onClick={onOpenChat}
                className="rounded border border-[var(--accent)] px-5 py-2.5 text-[15px] font-medium text-[var(--accent)] font-[var(--font-body)] transition-colors hover:bg-[var(--accent)] hover:text-white"
              >
                Ask AI
              </button>
            )}
            <span className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">Not legal advice</span>
          </div>
        </div>
      </div>
      </div>
    </CitationNavProvider>
  );
}
