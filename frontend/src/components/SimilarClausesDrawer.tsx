/**
 * SP-10 Arc 3 Task 3.4 — per-clause similar-clauses drawer.
 *
 * Opened from a ``Find similar clauses`` button inside a ``ClauseCard``.
 * Takes the selected clause, embeds ``"{title}. {clause_text}"`` via
 * ``/api/search/embed-query`` (server-side so ``MISTRAL_API_KEY`` stays
 * off the browser), then runs the backend semantic-search endpoint with
 * ``exclude_analysis_id`` pinned to the current report — a clause
 * searching inside its own analysis would otherwise return its own
 * siblings as the strongest matches, which tells the user nothing.
 *
 * Affordance tenets:
 *   - **Slide-in panel**, mirroring ``ChatPanel``'s right-side pattern
 *     so the report underneath stays visible while results render.
 *   - **Lazy-load.** A new embed + search fires the first time each
 *     clause is opened; revisiting the drawer without changing the
 *     selected clause reuses the cached results.
 *   - **Fail-soft.** Any error collapses to a single translated line
 *     inside the drawer with a retry button.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { embedSearchQuery, semanticSearch } from "@/lib/api";
import type { AnalyzedClause, SemanticSearchHit } from "@/types";

/**
 * Max hits shown in the drawer. Narrower than the history search bar
 * because the drawer is contextual — the user is asking about *this*
 * clause, not browsing; a short list keeps the drawer scannable.
 */
const SIMILAR_CLAUSES_TOP_K = 10;

/** Per-clause drawer cache key — the clause index inside the current analysis. */
type DrawerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; hits: SemanticSearchHit[] }
  | { status: "error"; message: string };

interface SimilarClausesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * The currently-displayed analysis id. Pinned as the ``exclude`` filter
   * so the drawer cannot echo the caller's own siblings.
   *
   * ``null`` is legal — the report view (live analysis) has no saved id
   * yet, and in that case there is nothing to exclude anyway.
   */
  currentAnalysisId: string | null;
  clause: AnalyzedClause | null;
}

/**
 * Build the embed query for a clause — ``"{title}. {clause_text}"``.
 * Trimmed + collapsed so repeated whitespace inside the contract text
 * doesn't eat into the embed model's token budget.
 */
function buildClauseQuery(clause: AnalyzedClause): string {
  const title = clause.title?.trim() ?? "";
  const text = clause.clause_text?.trim().replace(/\s+/g, " ") ?? "";
  if (title && text) return `${title}. ${text}`;
  return title || text;
}

/** Render the cosine similarity as a clamped integer percentage. */
function formatPercent(similarity: number): number {
  return Math.round(Math.max(0, Math.min(1, similarity)) * 100);
}

/** Short excerpt for a hit row — avoids overflowing the drawer width. */
function snippet(text: string | null | undefined, max = 160): string {
  if (!text) return "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

export function SimilarClausesDrawer({
  isOpen,
  onClose,
  currentAnalysisId,
  clause,
}: SimilarClausesDrawerProps) {
  const t = useTranslations("SimilarClauses");

  const [state, setState] = useState<DrawerState>({ status: "idle" });
  /**
   * Cache key for the currently-cached result set. We only re-fire the
   * pipeline when the user selects a *different* clause — closing and
   * re-opening the drawer on the same clause should be instant.
   */
  const cachedKeyRef = useRef<string | null>(null);

  const runSearch = useCallback(async () => {
    if (!clause) return;

    setState({ status: "loading" });
    try {
      const queryText = buildClauseQuery(clause);
      if (!queryText) {
        setState({ status: "ready", hits: [] });
        return;
      }

      const embedding = await embedSearchQuery(queryText);
      const { results } = await semanticSearch(
        embedding,
        SIMILAR_CLAUSES_TOP_K,
        currentAnalysisId,
      );
      setState({ status: "ready", hits: results });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("error");
      setState({ status: "error", message: message || t("error") });
    }
  }, [clause, currentAnalysisId, t]);

  /**
   * Drive the load lifecycle: when the drawer opens for a new clause,
   * fire the search. Guarded against re-firing on every parent rerender
   * by keying off the clause's title + text, which is how we identify
   * "same clause vs different clause" from the outside.
   *
   * ``react-hooks/set-state-in-effect`` disabled: this is the canonical
   * fetch-on-open pattern — the async ``runSearch`` flips state to
   * ``loading`` before awaiting so the UI can render the spinner while
   * the network call is in flight. There is no external system to sync
   * against; the effect *is* the trigger.
   */
  useEffect(() => {
    if (!isOpen || !clause) return;
    const key = `${currentAnalysisId ?? ""}|${clause.title}|${clause.clause_text}`;
    if (cachedKeyRef.current === key && state.status !== "idle") return;
    cachedKeyRef.current = key;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runSearch();
  }, [isOpen, clause, currentAnalysisId, runSearch, state.status]);

  /**
   * Retry after an error without closing + reopening the drawer.
   * Clearing the cache key + returning to ``idle`` is enough — the
   * ``useEffect`` above re-fires ``runSearch`` once the new render lands.
   * Avoids the double-fire that would otherwise happen if we also
   * called ``runSearch`` directly here.
   */
  const handleRetry = useCallback(() => {
    cachedKeyRef.current = null;
    setState({ status: "idle" });
  }, []);

  return (
    <>
      {/* Mobile scrim — tapping outside closes the drawer. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 right-0 z-50 flex h-full w-full flex-col border-l border-[var(--border-primary)] bg-[var(--bg-primary)] transition-transform duration-300 sm:w-[420px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label={t("heading")}
        aria-hidden={!isOpen}
        data-testid="similar-clauses-drawer"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-primary)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
              {t("heading")}
            </h2>
            {clause && (
              <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)] font-[var(--font-body)]">
                {clause.title}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
            aria-label={t("close")}
            data-testid="similar-clauses-close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {state.status === "loading" && (
            <p
              className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]"
              data-testid="similar-clauses-loading"
            >
              {t("loading")}
            </p>
          )}

          {state.status === "error" && (
            <div
              className="flex flex-col gap-3"
              data-testid="similar-clauses-error"
            >
              <p className="text-[13px] text-[var(--accent)] font-[var(--font-body)]">
                {state.message}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                className="self-start rounded border border-[var(--border-primary)] px-3 py-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)]"
                data-testid="similar-clauses-retry"
              >
                {t("retry")}
              </button>
            </div>
          )}

          {state.status === "ready" && state.hits.length === 0 && (
            <p
              className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]"
              data-testid="similar-clauses-empty"
            >
              {t("empty")}
            </p>
          )}

          {state.status === "ready" && state.hits.length > 0 && (
            <ul className="space-y-2" data-testid="similar-clauses-results">
              {state.hits.map((hit) => {
                const percent = formatPercent(hit.similarity);
                const href = `/history/${hit.analysis_id}#clause-${hit.clause_index}`;
                const title = hit.clause_title ?? hit.filename;
                const excerpt = snippet(hit.clause_text);
                return (
                  <li
                    key={`${hit.analysis_id}-${hit.clause_index}`}
                    className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] theme-transition hover:bg-[var(--bg-secondary)]"
                    data-testid="similar-clauses-result"
                  >
                    <Link
                      href={href}
                      className="block px-3 py-2.5 no-underline"
                      aria-label={t("openAria")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-[var(--text-primary)] font-[var(--font-body)]">
                            {title}
                          </p>
                          <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)] font-[var(--font-body)]">
                            {hit.filename}
                            {hit.contract_type && ` · ${hit.contract_type}`}
                          </p>
                          {excerpt && (
                            <p className="mt-1 line-clamp-2 text-[13px] text-[var(--text-secondary)] font-[var(--font-body)]">
                              {excerpt}
                            </p>
                          )}
                        </div>
                        <span
                          className="shrink-0 rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] font-[var(--font-body)]"
                          aria-label={t("similarity", { percent })}
                          data-testid="similar-clauses-score"
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
      </aside>
    </>
  );
}
