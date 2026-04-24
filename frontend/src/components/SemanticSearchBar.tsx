/**
 * SP-10 Arc 3 Task 3.2 — cross-analysis semantic search bar.
 *
 * Drops on top of the saved-analyses list on the ``/history`` page.
 * Flow:
 *   1. User types a free-text query and hits Search (or Enter).
 *   2. Client calls the Next.js ``/api/search/embed-query`` route — keeps
 *      ``MISTRAL_API_KEY`` server-side while letting the backend
 *      receive a plain 1024-float array (matches the pipeline split).
 *   3. Client forwards the embedding to the backend
 *      ``POST /api/search/semantic`` which runs the pgvector HNSW cosine
 *      query scoped to the authenticated user.
 *   4. Hits render as tappable rows that deep-link into the saved
 *      analysis report, anchored at the matched clause via a
 *      ``#clause-<index>`` hash.
 *
 * Design tenets:
 *   - **Search bar is a layered affordance, not the primary page
 *     control.** The list below is still the default, search is
 *     opt-in. Keeps the history page usable without JS/LLM.
 *   - **No live-search / debounce-fetch.** Every query round-trip costs
 *     a Mistral call + a pgvector lookup; firing on keystroke would be
 *     silly. Submit-driven only.
 *   - **Fail-soft.** Any error collapses to a translated message under
 *     the input; the user can retry without losing the query.
 */

"use client";

import { useCallback, useState, useMemo, useId, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { embedSearchQuery, semanticSearch } from "@/lib/api";
import type { SemanticSearchHit } from "@/types";

/** Minimum chars before a query is considered worth sending. */
const MIN_QUERY_CHARS = 3;

/** Default top-k to request. Matches the backend default. */
const DEFAULT_TOP_K = 20;

/** Render the match score as an integer percentage clamped to ``[0, 100]``. */
function formatSimilarityPercent(similarity: number): number {
  const clamped = Math.max(0, Math.min(1, similarity));
  return Math.round(clamped * 100);
}

/**
 * Build a trimmed snippet from the clause text so rows stay visually
 * tight. Prefers a whole-word cut to avoid mid-word ellipses, and
 * preserves the full string when it already fits.
 */
function snippet(text: string | null | undefined, max = 180): string {
  if (!text) return "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

/** Map the backend risk_level strings onto the accent vars already in use. */
function riskClass(risk: string | null): string {
  switch (risk) {
    case "high":
      return "text-[var(--risk-high)]";
    case "medium":
      return "text-[var(--risk-medium)]";
    case "low":
      return "text-[var(--risk-low)]";
    default:
      return "text-[var(--text-muted)]";
  }
}

interface SemanticSearchBarProps {
  /**
   * Called after a successful search; lets the page clear its local
   * multi-select state so a hit-click doesn't carry stale ticks into
   * the report view. Optional because the bar is also useful in
   * read-only contexts (e.g. future library-compare panel).
   */
  onResults?: (count: number) => void;
}

export function SemanticSearchBar({ onResults }: SemanticSearchBarProps = {}) {
  const t = useTranslations("SemanticSearch");

  const inputId = useId();
  const statusId = useId();

  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SemanticSearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();
  const canSubmit = trimmed.length >= MIN_QUERY_CHARS && !isSearching;

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit) return;

      setIsSearching(true);
      setError(null);
      setResults(null);
      try {
        const embedding = await embedSearchQuery(trimmed);
        const { results: hits } = await semanticSearch(
          embedding,
          DEFAULT_TOP_K,
        );
        setResults(hits);
        onResults?.(hits.length);
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("error");
        setError(msg || t("error"));
      } finally {
        setIsSearching(false);
      }
    },
    [canSubmit, trimmed, t, onResults],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setResults(null);
    setError(null);
  }, []);

  /** Stable key for each result row. */
  const rows = useMemo(() => results ?? [], [results]);

  return (
    <section
      className="mb-6 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 theme-transition"
      aria-labelledby={`${inputId}-label`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" role="search">
        <label
          id={`${inputId}-label`}
          htmlFor={inputId}
          className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]"
        >
          {t("label")}
        </label>

        <div className="flex items-center gap-2">
          <input
            id={inputId}
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            aria-describedby={statusId}
            className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-[15px] text-[var(--text-primary)] font-[var(--font-body)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            data-testid="semantic-search-input"
          />

          {query.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={t("clearAria")}
              className="rounded p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
              data-testid="semantic-search-clear"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            aria-label={t("submitAria")}
            className="rounded border border-[var(--accent)] px-4 py-2 text-[14px] font-medium text-[var(--accent)] font-[var(--font-body)] transition-colors hover:bg-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="semantic-search-submit"
          >
            {isSearching ? t("searching") : t("submit")}
          </button>
        </div>

        {/* Inline status / errors live in a single aria-live region so
            screen readers announce them without having to re-find the
            bar. Muted by default, accent-colored on error. */}
        <p
          id={statusId}
          aria-live="polite"
          className={`min-h-[1.25rem] text-[12px] font-[var(--font-body)] ${
            error ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
          }`}
          data-testid="semantic-search-status"
        >
          {error
            ? error
            : isSearching
              ? t("searching")
              : trimmed.length > 0 && trimmed.length < MIN_QUERY_CHARS
                ? t("minLength")
                : results !== null
                  ? results.length === 0
                    ? t("noResults")
                    : t("resultCount", { count: results.length })
                  : ""}
        </p>
      </form>

      {/* Results — rendered only after at least one successful search. */}
      {results !== null && results.length > 0 && (
        <ul className="mt-4 space-y-2" data-testid="semantic-search-results">
          {rows.map((hit) => {
            const percent = formatSimilarityPercent(hit.similarity);
            const title = hit.clause_title ?? hit.filename;
            const excerpt = snippet(hit.clause_text);
            const href = `/history/${hit.analysis_id}#clause-${hit.clause_index}`;

            return (
              <li
                key={`${hit.analysis_id}-${hit.clause_index}`}
                className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] theme-transition hover:bg-[var(--bg-secondary)]"
                data-testid="semantic-search-result"
              >
                <Link
                  href={href}
                  className="block px-3 py-2.5 no-underline"
                  aria-label={t("openAnalysis")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-[var(--text-primary)] font-[var(--font-body)]">
                        {title}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-muted)] font-[var(--font-body)]">
                        <span className="truncate">{hit.filename}</span>
                        {hit.contract_type && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{hit.contract_type}</span>
                          </>
                        )}
                        {hit.risk_level && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className={riskClass(hit.risk_level)}>
                              {hit.risk_level}
                            </span>
                          </>
                        )}
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
                      data-testid="semantic-search-score"
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
    </section>
  );
}
