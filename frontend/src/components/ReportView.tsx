/**
 * Full report view — editorial restyle.
 *
 * Wraps the analysis output in a paper/ink editorial layout: contract
 * standfirst, risk stat band, radar + donut, top-risks call-out, filters,
 * clause dossier, colophon, and a sticky action bar at the foot.
 */

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
import { Button } from "@/components/ui/Button";
import { Kicker } from "@/components/ui/Kicker";
import { StatBlock } from "@/components/ui/StatBlock";
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
  sort: SortOption,
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
export function ReportView({
  data,
  onReset,
  onOpenChat,
  onAskAboutClause,
  onSave,
  filename,
  savedId,
}: ReportViewProps) {
  const t = useTranslations("ReportView");
  const tExport = useTranslations("Export");
  const tCat = useTranslations("ClauseCategory");

  /**
   * Resolve all Markdown export labels into a plain object. The
   * exporter is a pure function so we snapshot translations here
   * rather than passing `t` through. `useMemo` keeps the object
   * identity stable across renders when only unrelated state changes.
   */
  const markdownLabels = useMemo<MarkdownLabels>(
    () => ({
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
    }),
    [tExport, tCat],
  );
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
  const [persistedId, setPersistedId] = useState<string | null>(savedId ?? null);

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
      <div className="pb-28">
        {/* Contract standfirst */}
        <ContractOverview overview={data.overview} />

        {/* Risk stat band — 4-up StatBlocks on paper-edge rails */}
        <section className="mt-10 border-y border-paper-edge py-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <StatBlock
              value={summary.risk_breakdown.high}
              label={t("highRisk")}
              size="lg"
            />
            <StatBlock
              value={summary.risk_breakdown.medium}
              label={t("mediumRisk")}
              size="lg"
            />
            <StatBlock
              value={summary.risk_breakdown.low}
              label={t("lowRisk")}
              size="lg"
            />
            <StatBlock
              value={summary.risk_breakdown.informational}
              label={t("info")}
              size="lg"
            />
          </div>
        </section>

        {/* Charts — radar + donut, side-by-side on desktop */}
        <section className="mt-6 flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-center">
          <div className="w-full max-w-[220px] md:w-[220px]">
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
        </section>

        {/* Top risks — editorial callout with numbered items */}
        {summary.top_risks.length > 0 && (
          <section className="mt-10 border-t border-ink pt-5">
            <Kicker tone="red" className="mb-3">
              {t("topRisks")}
            </Kicker>
            <ol className="flex flex-col gap-2">
              {summary.top_risks.map((risk, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-4 border-b border-paper-edge pb-2 last:border-b-0"
                >
                  <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="t-reading flex-1 text-[16px] text-ink-2">
                    {risk}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Unusual clauses */}
        <UnusualClausesCallout clauses={clauses} />

        {/* Active filter pills */}
        <div className="mt-8">
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
        </div>

        {/* Filters bar */}
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

        {/* Clause dossier */}
        <div className="mt-5 flex flex-col gap-4">
          {filteredClauses.map((clause, i) => (
            <ClauseCard
              key={`${clause.title}-${clause.risk_level}-${i}`}
              clause={clause}
              onAskAbout={onAskAboutClause}
            />
          ))}
          {filteredClauses.length === 0 && (
            <p className="t-reading py-10 text-center text-[16px] italic text-ink-muted">
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

        {/* Sticky action bar — save + exports + compare + new + chat. */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-paper/95 backdrop-blur-sm">
          {saveState === "login" && (
            <div className="mx-auto w-full max-w-[1440px] px-6 pt-3 md:px-10">
              <LoginPrompt message={t("loginToSave")} />
            </div>
          )}
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-6 py-3 md:flex-row md:items-center md:justify-between md:px-10">
            <div className="flex flex-wrap items-center gap-2">
              {onSave && (
                <>
                  {saveState === "saved" ? (
                    <Link
                      href="/history"
                      className="inline-flex items-center justify-center border border-ok px-4 py-2 font-sans text-[13px] font-medium text-ok no-underline transition-colors hover:bg-ok-soft"
                    >
                      {t("saved")}
                    </Link>
                  ) : (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleSave}
                      disabled={saveState === "saving"}
                    >
                      {saveState === "saving" ? t("saving") : t("save")}
                    </Button>
                  )}
                  {saveState === "error" && saveError && (
                    <span className="font-mono text-[10.5px] uppercase tracking-[1.2px] text-red-accent">
                      {saveError}
                    </span>
                  )}
                </>
              )}
              <Button
                variant="ghost"
                size="md"
                onClick={() => downloadMarkdown(data, markdownLabels)}
              >
                {t("exportMd")}
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={handlePdfExport}
                disabled={exporting}
              >
                {exporting ? t("generating") : t("exportPdf")}
              </Button>
              <Button variant="ghost" size="md" onClick={handleCompare}>
                {t("compare")}
              </Button>
              <Button variant="link" size="md" onClick={onReset}>
                {t("newContract")}
              </Button>
            </div>
            <div className="flex items-center gap-4">
              {onOpenChat && (
                <Button variant="danger" size="md" onClick={onOpenChat}>
                  {t("askAi")}
                </Button>
              )}
              <span className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted">
                {t("notLegalAdvice")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </CitationNavProvider>
  );
}
