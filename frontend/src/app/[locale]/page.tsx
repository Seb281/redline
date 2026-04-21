/** Main page — state machine managing upload/analyzing/report views. */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { AnalysisLocalePicker } from "@/components/AnalysisLocalePicker";
import { ChatPanel } from "@/components/ChatPanel";
import { FileUpload } from "@/components/FileUpload";
import { PageShell } from "@/components/PageShell";
import { ReportView } from "@/components/ReportView";
import { StreamingReportView } from "@/components/StreamingReportView";
import { FaqSection } from "@/components/landing/FaqSection";
import { HeroAside } from "@/components/landing/HeroAside";
import { HeroRules } from "@/components/landing/HeroRules";
import { HowItReads } from "@/components/landing/HowItReads";
import { Pillars } from "@/components/landing/Pillars";
import { SampleRow } from "@/components/landing/SampleRow";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { useAnalysisLocale } from "@/contexts/AnalysisLocaleContext";
import { DE_SAAS_DPA_TEXT, DE_SAAS_DPA_UPLOAD } from "@/data/sample-contracts/de-saas-dpa";
import { ES_SAAS_SERVICES_TEXT, ES_SAAS_SERVICES_UPLOAD } from "@/data/sample-contracts/es-saas-services";
import { FR_EMPLOYMENT_TEXT, FR_EMPLOYMENT_UPLOAD } from "@/data/sample-contracts/fr-employment";
import { IT_EMPLOYMENT_TEXT, IT_EMPLOYMENT_UPLOAD } from "@/data/sample-contracts/it-employment";
import { SAMPLE_CONTRACT_TEXT, SAMPLE_UPLOAD_RESPONSE } from "@/data/sample-contracts/nl-freelance";
import { PL_DISTRIBUTION_TEXT, PL_DISTRIBUTION_UPLOAD } from "@/data/sample-contracts/pl-distribution";
import { useStreamingAnalysis } from "@/hooks/useStreamingAnalysis";
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
        fr: { upload: FR_EMPLOYMENT_UPLOAD, text: FR_EMPLOYMENT_TEXT },
        de: { upload: DE_SAAS_DPA_UPLOAD, text: DE_SAAS_DPA_TEXT },
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
    });
    return result.id;
  }, [state, mode]);

  return (
    <main>
      {state.view === "upload" && (
        <PageShell width="lg" className="py-10 sm:py-14">
          {/* Hero — editorial headline + upload / aside two-column */}
          <section className="relative">
            <HeroRules variant="default" />
            <div className="relative z-10 grid grid-cols-1 gap-12 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <MonoLabel tone="red" className="block mb-7 md:mb-9">
                  {t("tagline")}
                </MonoLabel>
                <h1 className="m-0 font-serif text-[64px] font-light leading-[0.96] tracking-[-0.02em] text-ink md:text-[88px] lg:text-[104px]">
                  {t.rich("heading", {
                    em: (chunks) => (
                      <em className="not-italic font-light italic text-red-accent">
                        {chunks}
                      </em>
                    ),
                    br: () => <br />,
                  })}
                </h1>
                <p className="t-reading text-ink-2 mt-8 max-w-[48ch] text-[20px] leading-[1.5] m-0">
                  {t.rich("subheading", {
                    em: (chunks) => (
                      <em className="italic text-ink">{chunks}</em>
                    ),
                  })}
                </p>

                <div className="mt-10">
                  <FileUpload
                    onFileSelected={handleFileSelected}
                    isUploading={isUploading}
                    error={error}
                  />
                </div>

                {/* Analysis controls — editorial baseline */}
                <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-paper-edge pt-5">
                  <AnalysisLocalePicker />
                  <div
                    className="flex items-center gap-3"
                    role="radiogroup"
                    aria-label={t("modeLabel")}
                  >
                    <span className="font-mono text-[11px] uppercase tracking-[1.5px] text-ink-muted">
                      {t("modeLabel")}
                    </span>
                    <div className="inline-flex border border-ink">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={mode === "fast"}
                        onClick={() => setMode("fast")}
                        className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[1.2px] transition-colors ${
                          mode === "fast"
                            ? "bg-ink text-paper"
                            : "bg-paper text-ink hover:bg-paper-2"
                        }`}
                      >
                        {t("fast")}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={mode === "deep"}
                        onClick={() => setMode("deep")}
                        className={`border-l border-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-[1.2px] transition-colors ${
                          mode === "deep"
                            ? "bg-ink text-paper"
                            : "bg-paper text-ink hover:bg-paper-2"
                        }`}
                      >
                        {t("deep")}
                      </button>
                    </div>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {mode === "fast" ? t("fastDesc") : t("deepDesc")}
                    </span>
                  </div>
                </div>
              </div>

              <HeroAside />
            </div>
          </section>

          <HowItReads />
          <Pillars />
          <SampleRow onPick={handleDemo} disabled={isUploading} />
          <FaqSection namespace="Landing.Faq" count={4} />
        </PageShell>
      )}

      {state.view === "analyzing" && (
        <PageShell width="lg" className="py-9">
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
        </PageShell>
      )}

      {state.view === "report" && (
        <>
          <PageShell width="lg" className="py-9">
            <ReportView
              data={state.analysis}
              onReset={handleReset}
              onOpenChat={handleOpenChat}
              onAskAboutClause={handleAskAboutClause}
              onSave={handleSave}
              filename={state.upload.filename}
            />
          </PageShell>
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
