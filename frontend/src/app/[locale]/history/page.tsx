/**
 * Saved analyses list.
 *
 * SP-5 retention controls live here: each row shows an expiry pill
 * ("Expires in 12 days" / "Pinned"), plus pin/extend/delete buttons.
 * Pinning is optimistic — we patch the local list state immediately
 * and only revert if the backend call fails, because the pin toggle
 * needs to feel instant for it to be used at all.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LoginPrompt } from "@/components/LoginPrompt";
import { SemanticSearchBar } from "@/components/SemanticSearchBar";
import {
  deleteAnalysis,
  extendAnalysis,
  listAnalyses,
  pinAnalysis,
} from "@/lib/api";
import { getRetentionStatus } from "@/lib/retention";
import type { AnalysisListItem } from "@/types";

export default function HistoryPage() {
  const t = useTranslations("History");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  /**
   * Multi-select state for the compare hand-off. Empty set → no
   * checkboxes are ticked. We deliberately only enable "Compare"
   * when *exactly two* rows are selected: one vs many or many vs many
   * would need a more complex chooser we don't want to ship yet.
   */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /** Toggle membership of an id in the selection set. */
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Selected ids ordered by their appearance in the current list. */
  const orderedSelected = useMemo(
    () => analyses.filter((a) => selectedIds.has(a.id)).map((a) => a.id),
    [analyses, selectedIds],
  );

  const canCompare = orderedSelected.length === 2;

  /** Fire the compare hand-off — first-selected becomes slot A. */
  const handleCompareSelected = useCallback(() => {
    if (!canCompare) return;
    const [a, b] = orderedSelected;
    router.push(`/compare?a=${a}&b=${b}`);
  }, [canCompare, orderedSelected, router]);

  /** Fetch analyses when authenticated. */
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    listAnalyses()
      .then(setAnalyses)
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("failedToLoad")),
      )
      .finally(() => setHasFetched(true));
  }, [isAuthenticated, authLoading, t]);

  /** Derived loading — true while authenticated but fetch hasn't completed. */
  const isLoading = isAuthenticated && !authLoading && !hasFetched;

  /** Delete an analysis with confirmation. */
  const handleDelete = useCallback(
    async (id: string, filename: string) => {
      if (!confirm(t("deleteConfirm", { filename }))) return;

      try {
        await deleteAnalysis(id);
        setAnalyses((prev) => prev.filter((a) => a.id !== id));
      } catch (err) {
        alert(err instanceof Error ? err.message : t("deleteFailed"));
      }
    },
    [t],
  );

  /** Toggle the pin flag — optimistic local update, revert on failure. */
  const handleTogglePin = useCallback(
    async (item: AnalysisListItem) => {
      const next = !item.pinned;
      setPendingId(item.id);
      setAnalyses((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, pinned: next } : a)),
      );
      try {
        const resp = await pinAnalysis(item.id, next);
        setAnalyses((prev) =>
          prev.map((a) =>
            a.id === item.id
              ? { ...a, pinned: resp.pinned, expires_at: resp.expires_at }
              : a,
          ),
        );
      } catch (err) {
        // Revert the local change on failure.
        setAnalyses((prev) =>
          prev.map((a) =>
            a.id === item.id ? { ...a, pinned: item.pinned } : a,
          ),
        );
        alert(err instanceof Error ? err.message : t("pinFailed"));
      } finally {
        setPendingId(null);
      }
    },
    [t],
  );

  /** Reset the retention clock to now + RETENTION_DAYS. */
  const handleExtend = useCallback(async (item: AnalysisListItem) => {
    setPendingId(item.id);
    try {
      const resp = await extendAnalysis(item.id);
      setAnalyses((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, expires_at: resp.expires_at } : a,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : t("extendFailed"));
    } finally {
      setPendingId(null);
    }
  }, [t]);

  // Auth loading
  if (authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />
      </main>
    );
  }

  // Not authenticated — show login prompt
  if (!isAuthenticated) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="mb-2 text-center text-xl font-medium text-[var(--text-primary)] font-[var(--font-heading)]">
          {t("title")}
        </h1>
        <p className="mb-6 text-center text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
          {t("loginPrompt")}
        </p>
        <LoginPrompt />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-7">
      <h1 className="mb-2 text-xl font-medium text-[var(--text-primary)] font-[var(--font-heading)]">
        {t("title")}
      </h1>
      <p className="mb-6 text-[13px] text-[var(--text-muted)] font-[var(--font-body)]">
        {t("infoLine")}
      </p>

      {/* SP-10 Arc 3 Task 3.2 — semantic search bar. Only rendered when
          there is at least one analysis to search across; hiding it on
          an empty list avoids pointing users at a control that would
          always return zero hits. */}
      {!isLoading && !error && analyses.length > 0 && <SemanticSearchBar />}

      {/* Loading */}
      {isLoading && (
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <p className="py-12 text-center text-[15px] text-[var(--accent)] font-[var(--font-body)]">
          {error}
        </p>
      )}

      {/* Empty state */}
      {!isLoading && !error && analyses.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-[17px] text-[var(--text-muted)] font-[var(--font-body)]">
            {t("empty")}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
          >
            {t("analyzeLink")}
          </Link>
        </div>
      )}

      {/* Analysis list */}
      {!isLoading && !error && analyses.length > 0 && (
        <div className="space-y-3">
          {analyses.map((analysis) => {
            const retention = getRetentionStatus(
              analysis.expires_at,
              analysis.pinned,
            );
            const isPending = pendingId === analysis.id;
            const pillStyle = retention.pinned
              ? "border-[var(--accent)] text-[var(--accent)]"
              : retention.daysRemaining <= 7
                ? "border-[var(--risk-medium-border,#f59e0b)] text-[var(--risk-medium,#b45309)]"
                : "border-[var(--border-primary)] text-[var(--text-muted)]";

            return (
              <div
                key={analysis.id}
                className="flex items-center justify-between rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--bg-secondary)] theme-transition"
                data-testid={`analysis-row-${analysis.id}`}
              >
                {/* Multi-select checkbox for the compare hand-off.
                    A clicked label inside the row link would navigate;
                    we keep this as a plain button outside the Link. */}
                <label
                  className="mr-3 flex cursor-pointer items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(analysis.id)}
                    onChange={() => toggleSelected(analysis.id)}
                    className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                    aria-label={t("compareSelectAria", {
                      filename: analysis.filename,
                    })}
                    data-testid={`compare-select-${analysis.id}`}
                  />
                </label>

                <Link
                  href={`/history/${analysis.id}`}
                  className="flex-1 no-underline"
                >
                  <p className="text-[15px] font-medium text-[var(--text-primary)] font-[var(--font-body)]">
                    {analysis.filename}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
                    {analysis.contract_type && (
                      <span>{analysis.contract_type}</span>
                    )}
                    <span>
                      {new Date(analysis.created_at).toLocaleDateString()}
                    </span>
                    <span>{t("clauseCount", { count: analysis.clause_count })}</span>
                    <span className="capitalize">
                      {analysis.analysis_mode}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${pillStyle}`}
                      data-testid="retention-pill"
                    >
                      {retention.label}
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-3">
                  {/* Risk counts */}
                  <div className="flex gap-2 text-sm font-medium font-[var(--font-body)]">
                    {analysis.risk_high > 0 && (
                      <span className="text-[var(--risk-high)]">
                        {analysis.risk_high}H
                      </span>
                    )}
                    {analysis.risk_medium > 0 && (
                      <span className="text-[var(--risk-medium)]">
                        {analysis.risk_medium}M
                      </span>
                    )}
                    {analysis.risk_low > 0 && (
                      <span className="text-[var(--risk-low)]">
                        {analysis.risk_low}L
                      </span>
                    )}
                  </div>

                  {/* Extend — hidden when pinned (no-op then) */}
                  {!analysis.pinned && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleExtend(analysis);
                      }}
                      disabled={isPending}
                      className="rounded p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-40"
                      aria-label={t("extendAria")}
                      data-testid="extend-button"
                      title={t("extendKeep")}
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
                      >
                        <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                        <polyline points="21 3 21 8 16 8" />
                      </svg>
                    </button>
                  )}

                  {/* Pin toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleTogglePin(analysis);
                    }}
                    disabled={isPending}
                    className={`rounded p-2 transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40 ${
                      analysis.pinned
                        ? "text-[var(--accent)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                    aria-pressed={analysis.pinned ?? false}
                    aria-label={analysis.pinned ? t("unpinAria") : t("pinAria")}
                    data-testid="pin-button"
                    title={analysis.pinned ? t("unpinTitle") : t("pinTitle")}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill={analysis.pinned ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 17v5" />
                      <path d="M9 10.76V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4.76a2 2 0 0 0 1.11 1.79l1.78.9A2 2 0 0 1 19 13.24V15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1.76a2 2 0 0 1 1.11-1.79l1.78-.9A2 2 0 0 0 9 10.76z" />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(analysis.id, analysis.filename)
                    }
                    className="rounded p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)]"
                    aria-label={t("deleteAria")}
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
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating compare bar — visible as soon as one row is selected.
          Explicit "Clear" escape hatch so the user is never stuck with
          a leftover tick. Compare stays disabled unless exactly 2 are
          selected; the count messaging makes the rule visible. */}
      {selectedIds.size > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]/95 backdrop-blur-sm theme-transition"
          data-testid="compare-bar"
        >
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3.5 sm:px-7">
            <p className="text-[13px] text-[var(--text-secondary)] font-[var(--font-body)]">
              {t("compareSelectedCount", { count: selectedIds.size })}
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded px-4 py-2 text-[14px] text-[var(--text-muted)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
              >
                {t("compareClear")}
              </button>
              <button
                type="button"
                onClick={handleCompareSelected}
                disabled={!canCompare}
                className="rounded border border-[var(--accent)] px-4 py-2 text-[14px] font-medium text-[var(--accent)] font-[var(--font-body)] transition-colors hover:bg-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="compare-go"
              >
                {t("compareGo")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
