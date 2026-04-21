/**
 * Saved analyses list.
 *
 * SP-5 retention controls live here: each row shows an expiry pill
 * ("Expires in 12 days" / "Pinned"), plus pin/extend/delete buttons.
 * Pinning is optimistic — we patch the local list state immediately
 * and only revert if the backend call fails, because the pin toggle
 * needs to feel instant for it to be used at all.
 *
 * Editorial treatment: Masthead + PageShell width="md", borderless
 * rectangular rows separated by 1px paper-edge rules, mono meta, serif
 * filename headings, and a StickyActionBar footer for the compare
 * hand-off. No rounded cards; the list is the page.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LoginPrompt } from "@/components/LoginPrompt";
import {
  deleteAnalysis,
  extendAnalysis,
  listAnalyses,
  pinAnalysis,
} from "@/lib/api";
import { getRetentionStatus } from "@/lib/retention";
import type { AnalysisListItem } from "@/types";
import { PageShell } from "@/components/PageShell";
import {
  Button,
  Kicker,
  Masthead,
  MonoLabel,
  StickyActionBar,
} from "@/components/ui";

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
      <main>
        <PageShell width="md" className="py-16 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-paper-edge border-t-ink" />
        </PageShell>
      </main>
    );
  }

  // Not authenticated — show login prompt
  if (!isAuthenticated) {
    return (
      <main>
        <PageShell width="sm" className="pb-16">
          <Masthead meta="HISTORY" title={t("title")} lede={t("loginPrompt")} />
          <div className="mt-10">
            <LoginPrompt />
          </div>
        </PageShell>
      </main>
    );
  }

  return (
    <main>
      <PageShell width="md" className="pb-16">
        <Masthead meta="HISTORY" title={t("title")} lede={t("infoLine")} />

        {/* Loading */}
        {isLoading && (
          <div className="mt-16 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-paper-edge border-t-ink" />
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <p className="mt-12 border-y border-paper-edge py-10 text-center font-serif text-[17px] italic text-red-accent">
            {error}
          </p>
        )}

        {/* Empty state */}
        {!isLoading && !error && analyses.length === 0 && (
          <div className="mt-16 flex flex-col items-center gap-4 border-y border-paper-edge py-16 text-center">
            <Kicker tone="muted">{t("empty")}</Kicker>
            <p className="t-reading max-w-[40ch] text-[16px] italic text-ink-2">
              {t("empty")}
            </p>
            <Link
              href="/"
              className="font-mono text-[11px] uppercase tracking-[1.5px] text-ink underline-offset-4 hover:text-red-accent hover:underline"
            >
              {t("analyzeLink")} →
            </Link>
          </div>
        )}

        {/* Analysis list */}
        {!isLoading && !error && analyses.length > 0 && (
          <div className="mt-10 border-t border-ink">
            {analyses.map((analysis) => {
              const retention = getRetentionStatus(
                analysis.expires_at,
                analysis.pinned,
              );
              const isPending = pendingId === analysis.id;
              const isSelected = selectedIds.has(analysis.id);

              // Retention pill tone. Mono chip; color hierarchy:
              // pinned → red-accent, expiring soon → warn, else muted.
              const pillTone = retention.pinned
                ? "border-red-accent/60 text-red-accent bg-red-soft"
                : retention.expired
                  ? "border-paper-edge text-ink-muted bg-paper-2"
                  : retention.daysRemaining <= 7
                    ? "border-warn/60 text-warn bg-warn-soft"
                    : "border-paper-edge text-ink-muted bg-paper";

              return (
                <div
                  key={analysis.id}
                  className={`flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-paper-edge py-5 transition-colors last:border-b-0 ${
                    isSelected ? "bg-paper-2" : "hover:bg-paper-2"
                  }`}
                  data-testid={`analysis-row-${analysis.id}`}
                >
                  {/* Multi-select checkbox for the compare hand-off. */}
                  <label
                    className="flex cursor-pointer items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(analysis.id)}
                      className="h-4 w-4 cursor-pointer accent-red-accent"
                      aria-label={t("compareSelectAria", {
                        filename: analysis.filename,
                      })}
                      data-testid={`compare-select-${analysis.id}`}
                    />
                  </label>

                  <Link
                    href={`/history/${analysis.id}`}
                    className="flex flex-1 min-w-0 flex-col gap-1 no-underline"
                  >
                    <h2 className="m-0 truncate font-serif text-[20px] font-light leading-tight tracking-[-0.005em] text-ink">
                      {analysis.filename}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted">
                      {analysis.contract_type && (
                        <span>{analysis.contract_type}</span>
                      )}
                      <span>
                        {new Date(analysis.created_at).toLocaleDateString()}
                      </span>
                      <span>
                        {t("clauseCount", { count: analysis.clause_count })}
                      </span>
                      <span>{analysis.analysis_mode}</span>
                      <span
                        className={`inline-block border px-2 py-[1px] font-mono text-[9.5px] font-semibold uppercase tracking-[1.2px] ${pillTone}`}
                        data-testid="retention-pill"
                      >
                        {retention.label}
                      </span>
                    </div>
                  </Link>

                  <div className="flex items-center gap-4">
                    {/* Risk counts — mono, coloured per risk ramp. */}
                    <div className="flex items-baseline gap-2 font-mono text-[12px] font-semibold tracking-[0.5px]">
                      {analysis.risk_high > 0 && (
                        <span className="text-red-accent">
                          {analysis.risk_high}H
                        </span>
                      )}
                      {analysis.risk_medium > 0 && (
                        <span className="text-warn">
                          {analysis.risk_medium}M
                        </span>
                      )}
                      {analysis.risk_low > 0 && (
                        <span className="text-ok">{analysis.risk_low}L</span>
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
                        className="p-2 text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
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
                      className={`p-2 transition-colors disabled:opacity-40 ${
                        analysis.pinned
                          ? "text-red-accent"
                          : "text-ink-muted hover:text-ink"
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
                      className="p-2 text-ink-muted transition-colors hover:text-red-accent"
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
      </PageShell>

      {/* Editorial compare bar — visible as soon as one row is selected.
          StickyActionBar sits at viewport bottom with paper-tint blur.
          Compare stays disabled unless exactly 2 are selected; the count
          messaging makes the rule visible. */}
      {selectedIds.size > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-40"
          data-testid="compare-bar"
        >
          <StickyActionBar
            left={
              <MonoLabel tone="muted">
                {t("compareSelectedCount", { count: selectedIds.size })}
              </MonoLabel>
            }
            right={
              <>
                <Button
                  variant="link"
                  size="md"
                  onClick={() => setSelectedIds(new Set())}
                >
                  {t("compareClear")}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCompareSelected}
                  disabled={!canCompare}
                  data-testid="compare-go"
                >
                  {t("compareGo")}
                </Button>
              </>
            }
          />
        </div>
      )}
    </main>
  );
}
