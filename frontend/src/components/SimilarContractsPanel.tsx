/**
 * SP-10 Arc 3 Task 3.3 — library-comparison panel for the saved-analysis
 * report page.
 *
 * Answers "have I seen a contract like this one before?" by matching the
 * current report's aggregate anchor (contract type, key terms, top-risk
 * clause titles) against every other clause vector the user has saved
 * and returning the closest contracts.
 *
 * Affordance tenets:
 *   - **Low-prominence.** Rendered as a collapsible ``<details>`` beneath
 *     the report. The discovery value is real but opt-in — nobody opens
 *     a saved analysis to see a cross-reference wall before they've read
 *     the thing itself.
 *   - **Lazy-load.** One Mistral-embed + one pgvector query per panel
 *     expansion, not per page mount. If the user never opens the panel
 *     we never pay for the work.
 *   - **Self-filtered by contract id.** The current analysis is always
 *     excluded — a contract matching itself is noise, not discovery.
 *   - **Fail-soft.** Any failure collapses to a single translated line
 *     inside the panel. The rest of the report must stay usable.
 */

"use client";

import { useCallback, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { embedSearchQuery, findSimilarContracts } from "@/lib/api";
import {
  buildLibraryQueryText,
  formatLibrarySimilarityPercent,
} from "@/lib/similar-contracts";
import type {
  AnalyzedClause,
  ContractOverview,
  SimilarContractHit,
} from "@/types";

/**
 * Upper bound on rows returned. Five is plenty for a discovery panel —
 * the backend cap (20) is there for safety, not to feed the UI.
 */
const LIBRARY_PANEL_TOP_K = 5;

interface SimilarContractsPanelProps {
  /** Id of the currently-rendered saved analysis. Excluded from matches. */
  currentAnalysisId: string;
  overview: ContractOverview;
  clauses: AnalyzedClause[];
}

type PanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; hits: SimilarContractHit[] }
  | { status: "error"; message: string };

export function SimilarContractsPanel({
  currentAnalysisId,
  overview,
  clauses,
}: SimilarContractsPanelProps) {
  const t = useTranslations("SimilarContracts");
  const panelId = useId();

  const [state, setState] = useState<PanelState>({ status: "idle" });

  /**
   * Fire the embed + search chain once the panel is opened. Guarded so
   * repeated opens don't re-hit the API when we already have results.
   */
  const runSearch = useCallback(async () => {
    if (state.status === "loading" || state.status === "ready") return;

    setState({ status: "loading" });
    try {
      const queryText = buildLibraryQueryText(overview, clauses);
      if (!queryText) {
        setState({ status: "ready", hits: [] });
        return;
      }

      const embedding = await embedSearchQuery(queryText);
      const { results } = await findSimilarContracts(
        embedding,
        currentAnalysisId,
        LIBRARY_PANEL_TOP_K,
      );
      setState({ status: "ready", hits: results });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("error");
      setState({ status: "error", message: message || t("error") });
    }
  }, [state.status, overview, clauses, currentAnalysisId, t]);

  /**
   * ``<details>`` fires ``onToggle`` on every open/close transition.
   * We want to search the first time the user opens the panel and on
   * explicit retries after an error — not on every close/reopen.
   */
  const handleToggle = useCallback(
    (event: React.SyntheticEvent<HTMLDetailsElement>) => {
      if (event.currentTarget.open && state.status === "idle") {
        void runSearch();
      }
    },
    [runSearch, state.status],
  );

  const handleRetry = useCallback(() => {
    setState({ status: "idle" });
    void runSearch();
  }, [runSearch]);

  return (
    <details
      id={panelId}
      onToggle={handleToggle}
      className="mt-8 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] theme-transition"
      data-testid="similar-contracts-panel"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-[14px] font-medium text-[var(--text-primary)] font-[var(--font-body)] [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <span>{t("title")}</span>
          <span
            aria-hidden="true"
            className="text-[var(--text-muted)] transition-transform"
          >
            ▾
          </span>
        </span>
      </summary>

      <div className="border-t border-[var(--border-primary)] px-4 py-3">
        <p className="mb-3 text-[12px] text-[var(--text-muted)] font-[var(--font-body)]">
          {t("description")}
        </p>

        {state.status === "loading" && (
          <p
            className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]"
            data-testid="similar-contracts-loading"
          >
            {t("loading")}
          </p>
        )}

        {state.status === "error" && (
          <div
            className="flex flex-wrap items-center justify-between gap-3"
            data-testid="similar-contracts-error"
          >
            <p className="text-[13px] text-[var(--accent)] font-[var(--font-body)]">
              {state.message}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded border border-[var(--border-primary)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)]"
              data-testid="similar-contracts-retry"
            >
              {t("retry")}
            </button>
          </div>
        )}

        {state.status === "ready" && state.hits.length === 0 && (
          <p
            className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]"
            data-testid="similar-contracts-empty"
          >
            {t("empty")}
          </p>
        )}

        {state.status === "ready" && state.hits.length > 0 && (
          <ul
            className="space-y-2"
            data-testid="similar-contracts-results"
          >
            {state.hits.map((hit) => {
              const percent = formatLibrarySimilarityPercent(hit.similarity);
              const href = `/history/${hit.analysis_id}#clause-${hit.best_clause_index}`;

              return (
                <li
                  key={hit.analysis_id}
                  className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] theme-transition hover:bg-[var(--bg-secondary)]"
                  data-testid="similar-contracts-result"
                >
                  <Link
                    href={href}
                    className="block px-3 py-2.5 no-underline"
                    aria-label={t("openAria")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[var(--text-primary)] font-[var(--font-body)]">
                          {hit.filename}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-muted)] font-[var(--font-body)]">
                          {hit.contract_type && (
                            <span className="truncate">
                              {hit.contract_type}
                            </span>
                          )}
                          {hit.best_clause_title && (
                            <>
                              {hit.contract_type && (
                                <span aria-hidden="true">·</span>
                              )}
                              <span className="truncate">
                                {t("bestClause", {
                                  title: hit.best_clause_title,
                                })}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] font-[var(--font-body)]"
                        aria-label={t("similarity", { percent })}
                        data-testid="similar-contracts-score"
                      >
                        {t("similarity", { percent })}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
