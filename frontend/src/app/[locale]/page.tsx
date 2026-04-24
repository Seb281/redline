/** Main page — state machine managing upload/analyzing/report views. */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { AnalysisLocalePicker } from "@/components/AnalysisLocalePicker";
import { ChatPanel } from "@/components/ChatPanel";
import { FileUpload } from "@/components/FileUpload";
import { ReportView } from "@/components/ReportView";
import { StreamingReportView } from "@/components/StreamingReportView";
import { useAnalysisLocale } from "@/contexts/AnalysisLocaleContext";
import { DE_EMPLOYMENT_TEXT, DE_EMPLOYMENT_UPLOAD } from "@/data/sample-contracts/de-employment";
import { ES_SAAS_SERVICES_TEXT, ES_SAAS_SERVICES_UPLOAD } from "@/data/sample-contracts/es-saas-services";
import { FR_COMMERCIAL_LEASE_TEXT, FR_COMMERCIAL_LEASE_UPLOAD } from "@/data/sample-contracts/fr-commercial-lease";
import { IT_EMPLOYMENT_TEXT, IT_EMPLOYMENT_UPLOAD } from "@/data/sample-contracts/it-employment";
import { SAMPLE_CONTRACT_TEXT, SAMPLE_UPLOAD_RESPONSE } from "@/data/sample-contracts/nl-freelance";
import { PL_DISTRIBUTION_TEXT, PL_DISTRIBUTION_UPLOAD } from "@/data/sample-contracts/pl-distribution";
import { useStreamingAnalysis } from "@/hooks/useStreamingAnalysis";
import { Link } from "@/i18n/navigation";
import { saveAnalysis, uploadContract, warmBackend } from "@/lib/api";
import type { AnalysisMode, AnalyzedClause, AnalyzeResponse, UploadResponse } from "@/types";

type AppState =
  | { view: "upload" }
  | { view: "analyzing"; upload: UploadResponse; contractText: string }
  | { view: "report"; upload: UploadResponse; contractText: string; analysis: AnalyzeResponse };

/**
 * Params from the upload screen that we need to remember across the
 * overview → role-picker → extraction gap. Kept in state rather than a
 * ref so we can clear it on reset and conditionally wire callbacks.
 */
interface PendingAnalysis {
  contractText: string;
  mode: AnalysisMode;
  withCitations: boolean;
  pickedRole: string | null;
}

export default function Home() {
  const t = useTranslations("Home");
  const tChat = useTranslations("ChatPanel");
  const [state, setState] = useState<AppState>({ view: "upload" });
  const [mode, setMode] = useState<AnalysisMode>("fast");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<PendingAnalysis | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { analysisLocale } = useAnalysisLocale();
  const streaming = useStreamingAnalysis(analysisLocale);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState<string | null>(null);

  // Pre-warm the backend on mount so its cold-start latency overlaps
  // with the user reading the hero instead of blocking the first upload.
  useEffect(() => {
    warmBackend();
  }, []);

  /**
   * Run the analysis stream with the chosen role and transition to the
   * full report view when the stream completes.
   */
  const runAnalysisAndFinish = useCallback(
    async (
      upload: UploadResponse,
      contractText: string,
      analysisMode: AnalysisMode,
      withCitations: boolean,
      userRole: string | null,
    ) => {
      const result = await streaming.runAnalysis(
        contractText,
        analysisMode,
        withCitations,
        userRole,
      );
      if (result) {
        // SP-1.5: text_source is a parse-time fact only the upload
        // response knows. Fold it into provenance so the footer and any
        // saved analyses record whether OCR ran.
        const resultWithTextSource = {
          ...result,
          provenance: {
            ...result.provenance,
            text_source: upload.text_source,
          },
        };
        setState((prev) =>
          prev.view === "analyzing"
            ? {
                view: "report",
                upload: prev.upload,
                contractText: prev.contractText,
                analysis: resultWithTextSource,
              }
            : prev,
        );
      }
    },
    [streaming],
  );

  /**
   * Kick off Pass 0. The hook parks in `awaiting_role` once the
   * overview arrives; the user's selection in the RolePicker triggers
   * {@link handleRolePicked} which calls runAnalysisAndFinish with the
   * pending params stored here.
   */
  const startAnalysis = useCallback(
    async (
      upload: UploadResponse,
      contractText: string,
      analysisMode: AnalysisMode,
      withCitations: boolean,
    ) => {
      setState({ view: "analyzing", upload, contractText });
      setPendingAnalysis({ contractText, mode: analysisMode, withCitations, pickedRole: null });
      await streaming.runOverview(contractText);
      // Now in awaiting_role — StreamingReportView renders the picker.
    },
    [streaming],
  );

  /** Upload file, then kick off streaming analysis. */
  const handleFileSelected = useCallback(
    async (file: File, withCitations: boolean) => {
      setIsUploading(true);
      setError(null);
      try {
        const uploadResult = await uploadContract(file);
        setIsUploading(false);
        startAnalysis(uploadResult, uploadResult.extracted_text, mode, withCitations);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("genericError"));
        setState({ view: "upload" });
        setIsUploading(false);
      }
    },
    [startAnalysis, mode, t],
  );

  /**
   * Run the live LLM pipeline on one of the three EU sample contracts.
   * Uses the same flow as a real upload — redaction preview and role
   * picker both fire — so the demo exercises the full UX.
   */
  const handleDemo = useCallback(
    (sample: "nl" | "fr" | "de" | "es" | "it" | "pl") => {
      setError(null);
      const presets = {
        nl: { upload: SAMPLE_UPLOAD_RESPONSE, text: SAMPLE_CONTRACT_TEXT },
        fr: { upload: FR_COMMERCIAL_LEASE_UPLOAD, text: FR_COMMERCIAL_LEASE_TEXT },
        de: { upload: DE_EMPLOYMENT_UPLOAD, text: DE_EMPLOYMENT_TEXT },
        es: { upload: ES_SAAS_SERVICES_UPLOAD, text: ES_SAAS_SERVICES_TEXT },
        it: { upload: IT_EMPLOYMENT_UPLOAD, text: IT_EMPLOYMENT_TEXT },
        pl: { upload: PL_DISTRIBUTION_UPLOAD, text: PL_DISTRIBUTION_TEXT },
      }[sample];
      startAnalysis(presets.upload, presets.text, mode, true);
    },
    [startAnalysis, mode],
  );

  /**
   * Called when the user confirms the RedactionPreview. Forwards the
   * disabled-token set to the hook (SP-1.9: tokens to leave visible),
   * which transitions to `awaiting_role` so the RolePicker can render.
   */
  const handleRedactionConfirmed = useCallback(
    (disabledTokens: Set<string>) => {
      streaming.confirmRedaction(disabledTokens);
    },
    [streaming],
  );

  /**
   * Called when the user picks (or skips) a party in the RolePicker.
   * Resumes the pipeline with the chosen role.
   */
  const handleRolePicked = useCallback(
    (role: string | null) => {
      if (!pendingAnalysis) return;
      if (state.view !== "analyzing") return;
      const upload = state.upload;
      const { contractText, mode: analysisMode, withCitations } = pendingAnalysis;
      setPendingAnalysis({ ...pendingAnalysis, pickedRole: role });
      runAnalysisAndFinish(upload, contractText, analysisMode, withCitations, role);
    },
    [pendingAnalysis, state, runAnalysisAndFinish],
  );

  /** Retry the last failed step (overview or analysis). */
  const handleRetry = useCallback(() => {
    if (state.view !== "analyzing") return;
    setRetryCount((c) => c + 1);

    if (!streaming.overview) {
      // Overview failed — retry overview
      streaming.runOverview(state.contractText);
    } else if (pendingAnalysis) {
      // Analysis failed — retry analysis with same params
      const { contractText, mode: analysisMode, withCitations, pickedRole } = pendingAnalysis;
      runAnalysisAndFinish(state.upload, contractText, analysisMode, withCitations, pickedRole);
    }
  }, [state, streaming, pendingAnalysis, runAnalysisAndFinish]);

  const handleReset = useCallback(() => {
    streaming.reset();
    setPendingAnalysis(null);
    setRetryCount(0);
    setChatOpen(false);
    setChatQuestion(null);
    setState({ view: "upload" });
    setError(null);
  }, [streaming]);

  /** Open chat with a pre-populated question about a specific clause. */
  const handleAskAboutClause = useCallback(
    (clause: AnalyzedClause) => {
      setChatQuestion(tChat("askClausePrompt", { title: clause.title }));
      setChatOpen(true);
    },
    [tChat],
  );

  const handleOpenChat = useCallback(() => {
    setChatOpen(true);
  }, []);

  /** Persist the current analysis to the backend. */
  const handleSave = useCallback(async (): Promise<string> => {
    if (state.view !== "report") throw new Error("No report to save");
    const result = await saveAnalysis({
      filename: state.upload.filename,
      file_type: state.upload.file_type,
      page_count: state.upload.page_count,
      char_count: state.upload.char_count,
      contract_text: state.contractText,
      overview: state.analysis.overview,
      summary: state.analysis.summary,
      clauses: state.analysis.clauses,
      analysis_mode: mode,
      provenance: state.analysis.provenance,
      // SP-10 Arc 1 Phase 2 — forward Mistral-embed vectors on the
      // authenticated save path. Privacy invariant holds: backend
      // persists them only in the same transaction as the parent
      // analysis, gated by the same session check.
      ...(state.analysis.clause_embeddings !== undefined
        ? { clause_embeddings: state.analysis.clause_embeddings }
        : {}),
    });
    return result.id;
  }, [state, mode]);

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-7">
      {state.view === "upload" && (
        <>
          {/* Hero */}
          <div className="pb-10 pt-18 text-center">
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
              {t("tagline")}
            </p>
            <h1 className="mx-auto mb-4 max-w-[560px] text-[40px] font-normal leading-[1.3] text-[var(--text-primary)] font-[var(--font-heading)]">
              {t("heading")}
            </h1>
            <p className="mx-auto max-w-[450px] text-[17px] text-[var(--text-tertiary)] font-[var(--font-body)]">
              {t("subheading")}
            </p>
          </div>

          {/* Two equal entry-point tiles */}
          <div className="mx-auto mb-10 grid max-w-[620px] grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Analyze tile — primary, active on this page */}
            <div className="rounded border-2 border-[var(--accent)] bg-[var(--accent-subtle)] p-6 theme-transition">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
                {t("primary")}
              </p>
              <h2 className="mb-2 text-[18px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
                {t("analyzeContract")}
              </h2>
              <p className="mb-4 text-[14px] text-[var(--text-secondary)] font-[var(--font-body)]">
                {t("analyzeDesc")}
              </p>
              <p className="text-[13px] font-medium text-[var(--accent)] font-[var(--font-body)]">
                {t("uploadCta")}
              </p>
            </div>

            {/* Redact tile — links to /redact */}
            <Link
              href="/redact"
              className="block rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 no-underline transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] theme-transition"
            >
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--text-muted)] font-[var(--font-body)]">
                {t("privacy")}
              </p>
              <h2 className="mb-2 text-[18px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
                {t("redactExport")}
              </h2>
              <p className="mb-4 text-[14px] text-[var(--text-secondary)] font-[var(--font-body)]">
                {t("redactDesc")}
              </p>
              <p className="text-[13px] font-medium text-[var(--text-tertiary)] font-[var(--font-body)] transition-colors group-hover:text-[var(--accent)]">
                {t("goRedact")}
              </p>
            </Link>
          </div>

          {/* Upload zone — Analyze entry point */}
          <FileUpload
            onFileSelected={handleFileSelected}
            isUploading={isUploading}
            error={error}
          />

          {/* SP-7 Phase 5 — analysis-output language (independent of UI locale) */}
          <div className="mx-auto mt-5 flex max-w-[540px] items-center justify-center">
            <AnalysisLocalePicker />
          </div>

          {/* Analysis mode toggle */}
          <div className="mx-auto mt-3 flex max-w-[540px] items-center justify-center">
            <div className="inline-flex rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-1">
              <button
                type="button"
                onClick={() => setMode("fast")}
                className={`rounded px-5 py-2 text-[15px] font-medium font-[var(--font-body)] transition-colors ${
                  mode === "fast"
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {t("fast")}
              </button>
              <button
                type="button"
                onClick={() => setMode("deep")}
                className={`rounded px-5 py-2 text-[15px] font-medium font-[var(--font-body)] transition-colors ${
                  mode === "deep"
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {t("deep")}
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-sm text-[var(--text-muted)] font-[var(--font-body)]">
            {mode === "fast" ? t("fastDesc") : t("deepDesc")}
          </p>

          {/* Demo CTA — 3 EU sample contracts */}
          <div className="mt-6 text-center">
            <p className="mb-2 text-sm text-[var(--text-muted)] font-[var(--font-body)]">
              {t("demoIntro")}
            </p>
            <div className="inline-flex flex-wrap justify-center gap-2">
              {(
                [
                  { id: "nl", labelKey: "demoNl" },
                  { id: "fr", labelKey: "demoFr" },
                  { id: "de", labelKey: "demoDe" },
                  { id: "es", labelKey: "demoEs" },
                  { id: "it", labelKey: "demoIt" },
                  { id: "pl", labelKey: "demoPl" },
                ] as const
              ).map(({ id, labelKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleDemo(id)}
                  disabled={isUploading}
                  className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[14px] text-[var(--text-secondary)] font-[var(--font-body)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="mx-auto mt-14 max-w-[540px]">
            <p className="mb-4 text-center text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
              {t("howItWorks")}
            </p>
            <div className="flex gap-4">
              <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 theme-transition">
                <p className="text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">{t("step1Title")}</p>
                <p className="mt-1.5 text-sm text-[var(--text-muted)] font-[var(--font-body)]">{t("step1Body")}</p>
              </div>
              <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 theme-transition">
                <p className="text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">{t("step2Title")}</p>
                <p className="mt-1.5 text-sm text-[var(--text-muted)] font-[var(--font-body)]">{t("step2Body")}</p>
              </div>
              <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 theme-transition">
                <p className="text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">{t("step3Title")}</p>
                <p className="mt-1.5 text-sm text-[var(--text-muted)] font-[var(--font-body)]">{t("step3Body")}</p>
              </div>
            </div>
          </div>

          {/* Built-by line */}
          <div className="mx-auto mt-12 max-w-[540px] border-t border-[var(--border-primary)] pt-5 text-center">
            <p className="text-[15px] italic text-[var(--text-muted)] font-[var(--font-heading)]">
              {t("footer")}
            </p>
          </div>
        </>
      )}

      {state.view === "analyzing" && (
        <StreamingReportView
          state={streaming}
          upload={state.upload}
          onReset={handleReset}
          onRolePicked={handleRolePicked}
          onRedactionConfirmed={handleRedactionConfirmed}
          onEditPartyLabel={streaming.updatePartyLabel}
          onRetry={handleRetry}
          retryCount={retryCount}
        />
      )}

      {state.view === "report" && (
        <>
          <ReportView
            data={state.analysis}
            onReset={handleReset}
            onOpenChat={handleOpenChat}
            onAskAboutClause={handleAskAboutClause}
            onSave={handleSave}
            filename={state.upload.filename}
          />
          <ChatPanel
            isOpen={chatOpen}
            onToggle={() => setChatOpen((o) => !o)}
            analysis={state.analysis}
            initialQuestion={chatQuestion}
            onInitialQuestionConsumed={() => setChatQuestion(null)}
          />
        </>
      )}
    </main>
  );
}
