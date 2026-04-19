/** Load a saved analysis and render the full report with chat. */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ChatPanel } from "@/components/ChatPanel";
import { ReportView } from "@/components/ReportView";
import { extendAnalysis, getAnalysis, pinAnalysis } from "@/lib/api";
import { legacyProvenance } from "@/lib/analyzer";
import { getRetentionStatus } from "@/lib/retention";
import type { AnalyzedClause, AnalyzeResponse, SavedAnalysis } from "@/types";

export default function HistoryDetailPage() {
  const t = useTranslations("HistoryDetail");
  const tChat = useTranslations("ChatPanel");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [analysis, setAnalysis] = useState<SavedAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retentionPending, setRetentionPending] = useState(false);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState<string | null>(null);

  /** Fetch the saved analysis from the backend. */
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/history");
      return;
    }

    getAnalysis(id)
      .then(setAnalysis)
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("failedToLoad")),
      )
      .finally(() => setIsLoading(false));
  }, [id, isAuthenticated, authLoading, router, t]);

  const handleReset = useCallback(() => {
    router.push("/");
  }, [router]);

  /** Open chat with a pre-populated question about a specific clause. */
  const handleAskAboutClause = useCallback(
    (clause: AnalyzedClause) => {
      setChatQuestion(tChat("askClausePrompt", { title: clause.title }));
      setChatOpen(true);
    },
    [tChat],
  );

  /** Toggle the pin flag from the retention bar. */
  const handleTogglePin = useCallback(async () => {
    if (!analysis) return;
    const next = !analysis.pinned;
    setRetentionPending(true);
    try {
      const resp = await pinAnalysis(analysis.id, next);
      setAnalysis(
        (prev) =>
          prev && {
            ...prev,
            pinned: resp.pinned,
            expires_at: resp.expires_at,
          },
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : t("pinFailed"));
    } finally {
      setRetentionPending(false);
    }
  }, [analysis, t]);

  /** Reset the retention clock from the retention bar. */
  const handleExtend = useCallback(async () => {
    if (!analysis) return;
    setRetentionPending(true);
    try {
      const resp = await extendAnalysis(analysis.id);
      setAnalysis(
        (prev) => prev && { ...prev, expires_at: resp.expires_at },
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : t("extendFailed"));
    } finally {
      setRetentionPending(false);
    }
  }, [analysis, t]);

  // Loading
  if (isLoading || authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />
      </main>
    );
  }

  // Error or not found
  if (error || !analysis) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="mb-2 text-xl font-medium text-[var(--text-primary)] font-[var(--font-heading)]">
          {t("notFound")}
        </h1>
        <p className="mb-6 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
          {error ?? t("deletedFallback")}
        </p>
        <button
          type="button"
          onClick={() => router.push("/history")}
          className="text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
        >
          {t("backHistory")}
        </button>
      </main>
    );
  }

  // Reconstruct AnalyzeResponse from saved data. Rows saved before
  // SP-1 Phase 5 have no provenance — the backend migration seeds the
  // column with `'{}'::jsonb`, so an empty object (not just
  // null/undefined) must also trigger the legacy placeholder.
  const hasProvenance =
    analysis.provenance && Object.keys(analysis.provenance).length > 0;
  const analyzeResponse: AnalyzeResponse = {
    overview: analysis.overview,
    summary: analysis.summary,
    clauses: analysis.clauses,
    provenance: hasProvenance ? analysis.provenance! : legacyProvenance(),
  };

  const retention = getRetentionStatus(analysis.expires_at, analysis.pinned);

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-7">
      {/* SP-5 retention bar */}
      <div
        className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-2.5 text-[13px] font-[var(--font-body)]"
        data-testid="retention-bar"
      >
        <span className="text-[var(--text-secondary)]">
          {retention.pinned
            ? t("pinnedNotice")
            : retention.expired
              ? t("expiredNotice")
              : t("autoDeleteIn", { days: retention.daysRemaining })}
        </span>
        <div className="flex items-center gap-2">
          {!analysis.pinned && (
            <button
              type="button"
              onClick={handleExtend}
              disabled={retentionPending}
              className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
              data-testid="retention-extend"
            >
              {t("keepMoreDays")}
            </button>
          )}
          <button
            type="button"
            onClick={handleTogglePin}
            disabled={retentionPending}
            className={`rounded border px-3 py-1 text-[12px] transition-colors disabled:opacity-40 ${
              analysis.pinned
                ? "border-[var(--accent)] bg-[var(--accent)] text-white hover:opacity-90"
                : "border-[var(--border-primary)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
            }`}
            data-testid="retention-pin"
          >
            {analysis.pinned ? t("unpin") : t("pinForever")}
          </button>
        </div>
      </div>

      <ReportView
        data={analyzeResponse}
        onReset={handleReset}
        onOpenChat={() => setChatOpen(true)}
        onAskAboutClause={handleAskAboutClause}
      />
      <ChatPanel
        isOpen={chatOpen}
        onToggle={() => setChatOpen((o) => !o)}
        analysis={analyzeResponse}
        initialQuestion={chatQuestion}
        onInitialQuestionConsumed={() => setChatQuestion(null)}
      />
    </main>
  );
}
