/** Full report view — overview, risk summary, filters, clause cards, sticky export bar. */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { AnalyzedClause, AnalyzeResponse, ClauseCategory, RiskLevel } from "@/types";
import { writeCarriedAnalysis } from "@/lib/compare/session";
import { AnalysisFooter } from "@/components/AnalysisFooter";
import { ClauseCard } from "@/components/ClauseCard";
import { ClauseFilters, type SortOption } from "@/components/ClauseFilters";
import { ContractOverview } from "@/components/ContractOverview";
import { Disclaimer } from "@/components/Disclaimer";
import { LoginPrompt } from "@/components/LoginPrompt";
import { RiskChart } from "@/components/RiskChart";
import { RiskRadar } from "@/components/RiskRadar";
import { ActiveFilterPills } from "@/components/ActiveFilterPills";
import { UnusualClausesCallout } from "@/components/UnusualClausesCallout";
import { useAuth } from "@/contexts/AuthContext";
import { CitationNavProvider } from "@/contexts/CitationNavContext";
import { downloadMarkdown, downloadPdf, type MarkdownLabels } from "@/lib/export";
import {
  buildReceipt,
  downloadReceipt,
  type TransparencyReceipt,
} from "@/lib/transparency-receipt";
import { fetchTransparencyReceipt } from "@/lib/api";

interface ReportViewProps {
  data: AnalyzeResponse;
  onReset: () => void;
  onOpenChat?: () => void;
  onAskAboutClause?: (clause: AnalyzedClause) => void;
  /** Persist the analysis. Returns the saved analysis ID. */
  onSave?: () => Promise<string>;
  /**
   * SP-9 — original upload filename, echoed into the transparency
   * receipt for identification. Optional so callers that genuinely
   * don't have one (e.g. demo contracts mid-flight) still work.
   */
  filename?: string | null;
  /**
   * SP-9 — saved-analysis id when rendering a row from history. Lets
   * the receipt download pull the stable server-side copy instead of
   * rebuilding locally.
   */
  savedId?: string | null;
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
export function ReportView({ data, onReset, onOpenChat, onAskAboutClause, onSave, filename, savedId }: ReportViewProps) {
  const t = useTranslations("ReportView");
  const tExport = useTranslations("Export");
  const tCat = useTranslations("ClauseCategory");

  /**
   * Resolve all Markdown export labels into a plain object. The
   * exporter is a pure function so we snapshot translations here
   * rather than passing `t` through. `useMemo` keeps the object
   * identity stable across renders when only unrelated state changes.
   */
  const markdownLabels = useMemo<MarkdownLabels>(() => ({
    title: tExport("title"),
    disclaimerLabel: tExport("disclaimerLabel"),
    disclaimerBody: tExport("disclaimerBody"),
    contractOverview: tExport("contractOverview"),
    type: tExport("type"),
    parties: tExport("parties"),
    effectiveDate: tExport("effectiveDate"),
    duration: tExport("duration"),
    value: tExport("value"),
    jurisdiction: tExport("jurisdiction"),
    keyTerms: tExport("keyTerms"),
    summary: tExport("summary"),
    totalClauses: tExport("totalClauses"),
    highRisk: tExport("highRisk"),
    mediumRisk: tExport("mediumRisk"),
    lowRisk: tExport("lowRisk"),
    informational: tExport("informational"),
    topRisks: tExport("topRisks"),
    unusualClauses: tExport("unusualClauses"),
    atypicalDefault: tExport("atypicalDefault"),
    atypicalGeneric: tExport("atypicalGeneric"),
    clauses: tExport("clauses"),
    riskSuffix: tExport("riskSuffix"),
    atypicalBadge: tExport("atypicalBadge"),
    risk: tExport("risk"),
    suggestion: tExport("suggestion"),
    cited: tExport("cited"),
    originalClauseText: tExport("originalClauseText"),
    riskLevel: {
      high: tExport("riskLevel.high"),
      medium: tExport("riskLevel.medium"),
      low: tExport("riskLevel.low"),
      informational: tExport("riskLevel.informational"),
    },
    categoryLabel: {
      non_compete: tCat("non_compete"),
      liability: tCat("liability"),
      termination: tCat("termination"),
      ip_assignment: tCat("ip_assignment"),
      confidentiality: tCat("confidentiality"),
      governing_law: tCat("governing_law"),
      indemnification: tCat("indemnification"),
      data_protection: tCat("data_protection"),
      payment_terms: tCat("payment_terms"),
      limitation_of_liability: tCat("limitation_of_liability"),
      force_majeure: tCat("force_majeure"),
      dispute_resolution: tCat("dispute_resolution"),
      other: tCat("other"),
    },
  }), [tExport, tCat]);
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ClauseCategory | "all">("all");
  const [sort, setSort] = useState<SortOption>("risk-desc");

  // Save state
  type SaveState = "idle" | "login" | "saving" | "saved" | "error";
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  // SP-9 — remember the saved analysis id after a successful save so the
  // transparency-receipt download can pull the server-stable copy on the
  // second click. Initialised from the `savedId` prop so the history
  // detail path uses the existing row id without a round-trip through
  // `onSave`.
  const [persistedId, setPersistedId] = useState<string | null>(
    savedId ?? null,
  );

  // When user becomes authenticated while LoginPrompt is showing,
  // dismiss the prompt so the Save button is ready to click.
  useEffect(() => {
    if (isAuthenticated && saveState === "login") {
      setSaveState("idle");
    }
  }, [isAuthenticated, saveState]);

  /** Handle save click — shows LoginPrompt if not authenticated. */
  const handleSave = useCallback(async () => {
    if (!onSave) return;

    if (!isAuthenticated) {
      setSaveState("login");
      return;
    }

    setSaveState("saving");
    setSaveError(null);
    try {
      const newId = await onSave();
      setPersistedId(newId);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : t("save"));
    }
  }, [isAuthenticated, onSave, t]);

  /**
   * SP-9 — download the transparency receipt for this analysis.
   *
   * Prefers the backend endpoint whenever a persisted id is available so
   * the receipt carries server-side provenance (authoritative source for
   * a saved row). Falls back to the pure client builder for anonymous
   * sessions or when the backend call fails — users must always be able
   * to pull the AI Act disclosure even if persistence is offline.
   */
  const handleDownloadReceipt = useCallback(async () => {
    let receipt: TransparencyReceipt;
    if (persistedId) {
      try {
        receipt = (await fetchTransparencyReceipt(
          persistedId,
        )) as unknown as TransparencyReceipt;
      } catch {
        receipt = buildReceipt(data, { id: persistedId, filename });
      }
    } else {
      receipt = buildReceipt(data, { filename });
    }
    downloadReceipt(receipt);
  }, [data, filename, persistedId]);

  // Hand this analysis off to /compare as slot A and navigate. The
  // label prefers the contract_type because the report never carries a
  // filename from the upload screen; a translated fallback keeps the
  // slot card readable when the overview is sparse.
  const handleCompare = useCallback(() => {
    const label =
      (data.overview.contract_type ?? "").trim() || t("compareFallbackLabel");
    writeCarriedAnalysis({ label, data });
    router.push("/compare");
  }, [data, router, t]);

  const { summary, clauses } = data;
  const filteredClauses = useFilteredClauses(clauses, riskFilter, categoryFilter, sort);

  const handlePdfExport = async () => {
    setExporting(true);
    try {
      await downloadPdf(data);
    } catch {
      alert(t("pdfExportFailed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <CitationNavProvider>
      <div className="pb-24">
      {/* Contract overview */}
      <ContractOverview overview={data.overview} />

      {/* Risk summary — stat cards + radar + donut */}
      <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-start">
        {/* Stat cards — 4 up, span full width on mobile, flex column on desktop */}
        <div className="grid grid-cols-4 gap-4 md:flex-1">
          <div className="rounded border border-[var(--risk-high-border)] bg-[var(--risk-high-bg)] p-5 text-center theme-transition">
            <p className="text-[36px] font-bold text-[var(--risk-high)] font-[var(--font-body)]">
              {summary.risk_breakdown.high}
            </p>
            <p className="text-sm text-[var(--risk-high)] opacity-70 font-[var(--font-body)]">{t("highRisk")}</p>
          </div>
          <div className="rounded border border-[var(--risk-medium-border)] bg-[var(--risk-medium-bg)] p-5 text-center theme-transition">
            <p className="text-[36px] font-bold text-[var(--risk-medium)] font-[var(--font-body)]">
              {summary.risk_breakdown.medium}
            </p>
            <p className="text-sm text-[var(--risk-medium)] opacity-70 font-[var(--font-body)]">{t("mediumRisk")}</p>
          </div>
          <div className="rounded border border-[var(--risk-low-border)] bg-[var(--risk-low-bg)] p-5 text-center theme-transition">
            <p className="text-[36px] font-bold text-[var(--risk-low)] font-[var(--font-body)]">
              {summary.risk_breakdown.low}
            </p>
            <p className="text-sm text-[var(--risk-low)] opacity-70 font-[var(--font-body)]">{t("lowRisk")}</p>
          </div>
          <div className="rounded border border-[var(--risk-info-border)] bg-[var(--risk-info-bg)] p-5 text-center theme-transition">
            <p className="text-[36px] font-bold text-[var(--risk-info)] font-[var(--font-body)]">
              {summary.risk_breakdown.informational}
            </p>
            <p className="text-sm text-[var(--risk-info)] opacity-70 font-[var(--font-body)]">{t("info")}</p>
          </div>
        </div>

        {/* Charts — stacked on mobile, side-by-side on desktop */}
        <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
          {/* Radar takes dominant width (~2× donut); max-w caps growth on huge screens */}
          <div className="w-full max-w-[200px] md:w-[200px]">
            <RiskRadar
              clauses={clauses}
              activeCategory={categoryFilter}
              onSpokeClick={(cat) => setCategoryFilter(cat)}
            />
          </div>
          <RiskChart
            breakdown={summary.risk_breakdown}
            activeRisk={riskFilter}
            onSegmentClick={(risk) => setRiskFilter(risk)}
          />
        </div>
      </div>

      {/* Top risks callout */}
      {summary.top_risks.length > 0 && (
        <div className="mb-7 rounded border border-[var(--risk-high-border)] bg-[var(--accent-subtle)] px-5 py-3.5 theme-transition">
          <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
            {t("topRisks")}
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

      {/* Active filter pills — dismissible row reflecting current riskFilter/categoryFilter */}
      <ActiveFilterPills
        riskFilter={riskFilter}
        categoryFilter={categoryFilter}
        onClearRisk={() => setRiskFilter("all")}
        onClearCategory={() => setCategoryFilter("all")}
        onClearAll={() => {
          setRiskFilter("all");
          setCategoryFilter("all");
        }}
      />

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
        {filteredClauses.map((clause, i) => (
          <ClauseCard
            key={`${clause.title}-${clause.risk_level}-${i}`}
            clause={clause}
            onAskAbout={onAskAboutClause}
          />
        ))}
        {filteredClauses.length === 0 && (
          <p className="py-9 text-center text-[17px] text-[var(--text-muted)] font-[var(--font-body)]">
            {t("noClauses")}
          </p>
        )}
      </div>

      {/* Disclaimer */}
      <Disclaimer />

      {/* Transparency colophon — EU AI Act disclosure of the machine
          that produced the analysis. Guarded with optional chaining so
          any stray legacy caller without provenance won't crash. */}
      {data.provenance && (
        <AnalysisFooter
          provenance={data.provenance}
          onDownloadReceipt={handleDownloadReceipt}
        />
      )}

      {/* Sticky export bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]/95 backdrop-blur-sm theme-transition">
        {/* Login prompt — slides in above buttons when save requires auth */}
        {saveState === "login" && (
          <div className="mx-auto max-w-4xl px-5 pt-3 sm:px-7">
            <LoginPrompt message={t("loginToSave")} />
          </div>
        )}

        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5 sm:px-7">
          <div className="flex gap-2.5">
            {/* Save button */}
            {onSave && (
              <>
                {saveState === "saved" ? (
                  <Link
                    href="/history"
                    className="rounded border border-green-500/30 bg-green-500/10 px-5 py-2.5 text-[15px] font-medium text-green-600 no-underline transition-colors hover:bg-green-500/20 font-[var(--font-body)] dark:text-green-400"
                  >
                    {t("saved")}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveState === "saving"}
                    className="rounded border border-[var(--accent)] px-5 py-2.5 text-[15px] font-medium text-[var(--accent)] font-[var(--font-body)] transition-colors hover:bg-[var(--accent)] hover:text-white disabled:opacity-50"
                  >
                    {saveState === "saving" ? t("saving") : t("save")}
                  </button>
                )}
                {saveState === "error" && saveError && (
                  <span className="self-center text-sm text-[var(--accent)] font-[var(--font-body)]">
                    {saveError}
                  </span>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => downloadMarkdown(data, markdownLabels)}
              className="rounded border border-[var(--border-primary)] px-5 py-2.5 text-[15px] font-medium text-[var(--text-secondary)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              {t("exportMd")}
            </button>
            <button
              type="button"
              onClick={handlePdfExport}
              disabled={exporting}
              className="rounded border border-[var(--border-primary)] px-5 py-2.5 text-[15px] font-medium text-[var(--text-secondary)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
            >
              {exporting ? t("generating") : t("exportPdf")}
            </button>
            <button
              type="button"
              onClick={handleCompare}
              className="rounded border border-[var(--border-primary)] px-5 py-2.5 text-[15px] font-medium text-[var(--text-secondary)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              {t("compare")}
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded px-5 py-2.5 text-[15px] text-[var(--text-muted)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
            >
              {t("newContract")}
            </button>
          </div>
          <div className="flex items-center gap-3">
            {onOpenChat && (
              <button
                type="button"
                onClick={onOpenChat}
                className="rounded border border-[var(--accent)] px-5 py-2.5 text-[15px] font-medium text-[var(--accent)] font-[var(--font-body)] transition-colors hover:bg-[var(--accent)] hover:text-white"
              >
                {t("askAi")}
              </button>
            )}
            <span className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">{t("notLegalAdvice")}</span>
          </div>
        </div>
      </div>
      </div>
    </CitationNavProvider>
  );
}
