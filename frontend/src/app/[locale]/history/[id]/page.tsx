/** Load a saved analysis and render the full report with chat. */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ChatPanel } from "@/components/ChatPanel";
import { SavedAnalysisReport } from "@/components/SavedAnalysisReport";
import { extendAnalysis, getAnalysis, pinAnalysis } from "@/lib/api";
import { legacyProvenance } from "@/lib/analyzer";
import { getRetentionStatus } from "@/lib/retention";
import type { AnalyzedClause, AnalyzeResponse, SavedAnalysis } from "@/types";
import { PageShell } from "@/components/PageShell";
import { BorderedCard, Button, Kicker, MonoLabel } from "@/components/ui";

export default function HistoryDetailPage() {
  const t = useTranslations("HistoryDetail");
  const tChat = useTranslations("ChatPanel");
  const currentLocale = useLocale();
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
      <main>
        <PageShell width="lg" className="py-16 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-paper-edge border-t-ink" />
        </PageShell>
      </main>
    );
  }

  // Error or not found
  if (error || !analysis) {
    return (
      <main>
        <PageShell width="sm" className="py-16 text-center">
          <Kicker tone="muted">{t("notFound")}</Kicker>
          <p className="mt-3 font-serif text-[24px] font-light italic text-ink">
            {error ?? t("deletedFallback")}
          </p>
          <div className="mt-6">
            <Button
              variant="link"
              size="md"
              onClick={() => router.push("/history")}
            >
              ← {t("backHistory")}
            </Button>
          </div>
        </PageShell>
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

  // SP-7 Layer B' — language-mismatch badge.
  // Render only when the saved analysis recorded a locale AND it differs
  // from the active UI locale. Absent `analysis_locale` (pre-Layer-B'
  // rows) means "unknown"; we say nothing rather than guess, to avoid
  // labelling a legacy EN analysis as non-English by accident.
  const savedLocale = analyzeResponse.provenance.analysis_locale;
  const localeMismatch =
    typeof savedLocale === "string" && savedLocale !== currentLocale;
  const localeLabelMap: Record<string, string> = {
    en: t("savedLocaleEnglish"),
    fr: t("savedLocaleFrench"),
    de: t("savedLocaleGerman"),
    nl: t("savedLocaleDutch"),
    es: t("savedLocaleSpanish"),
    it: t("savedLocaleItalian"),
  };

  const retentionSummary = retention.pinned
    ? t("pinnedNotice")
    : retention.expired
      ? t("expiredNotice")
      : t("autoDeleteIn", { days: retention.daysRemaining });

  return (
    <main>
      <PageShell width="lg" className="py-9">
        {localeMismatch && savedLocale && (
          <BorderedCard
            tone="edge"
            padding="sm"
            className="mb-4 flex items-center gap-3"
            data-testid="saved-locale-badge"
          >
            <MonoLabel tone="red">LOCALE</MonoLabel>
            <p className="m-0 font-serif text-[15px] italic text-ink-2">
              {t("savedLocaleBadge", {
                language:
                  localeLabelMap[savedLocale] ?? savedLocale.toUpperCase(),
              })}
            </p>
          </BorderedCard>
        )}

        {/* SP-5 retention bar — editorial variant. */}
        <BorderedCard
          tone="edge"
          padding="sm"
          className="mb-6 flex flex-wrap items-center justify-between gap-3"
          data-testid="retention-bar"
        >
          <div className="flex items-baseline gap-3">
            <MonoLabel tone={retention.pinned ? "red" : "muted"}>
              {retention.pinned
                ? "PINNED"
                : retention.expired
                  ? "EXPIRED"
                  : "RETENTION"}
            </MonoLabel>
            <p className="m-0 font-serif text-[15px] italic text-ink-2">
              {retentionSummary}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!analysis.pinned && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExtend}
                disabled={retentionPending}
                data-testid="retention-extend"
              >
                {t("keepMoreDays")}
              </Button>
            )}
            <Button
              variant={analysis.pinned ? "primary" : "ghost"}
              size="sm"
              onClick={handleTogglePin}
              disabled={retentionPending}
              data-testid="retention-pin"
            >
              {analysis.pinned ? t("unpin") : t("pinForever")}
            </Button>
          </div>
        </BorderedCard>

        <SavedAnalysisReport
          data={analyzeResponse}
          onReset={handleReset}
          onOpenChat={() => setChatOpen(true)}
          onAskAboutClause={handleAskAboutClause}
          filename={analysis.filename}
          savedId={analysis.id}
        />
      </PageShell>
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
