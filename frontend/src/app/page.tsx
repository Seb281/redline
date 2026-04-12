/** Main page — state machine managing upload/analyzing/report views. */

"use client";

import { useCallback, useEffect, useState } from "react";

import { ChatPanel } from "@/components/ChatPanel";
import { FileUpload } from "@/components/FileUpload";
import { ReportView } from "@/components/ReportView";
import { StreamingReportView } from "@/components/StreamingReportView";
import { SAMPLE_CONTRACT_TEXT, SAMPLE_UPLOAD_RESPONSE } from "@/data/sample-contract";
import { useStreamingAnalysis } from "@/hooks/useStreamingAnalysis";
import { uploadContract, warmBackend } from "@/lib/api";
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
}

export default function Home() {
  const [state, setState] = useState<AppState>({ view: "upload" });
  const [mode, setMode] = useState<AnalysisMode>("fast");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<PendingAnalysis | null>(null);
  const streaming = useStreamingAnalysis();

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
        setState((prev) =>
          prev.view === "analyzing"
            ? { view: "report", upload: prev.upload, contractText: prev.contractText, analysis: result }
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
      setPendingAnalysis({ contractText, mode: analysisMode, withCitations });
      await streaming.runOverview(contractText);
      // Now in awaiting_role — StreamingReportView renders the picker.
    },
    [streaming],
  );

  /**
   * Same as {@link startAnalysis} but skips the role picker entirely and
   * uses a preset role. Used by demo mode so the sample contract
   * presents a smooth end-to-end walkthrough instead of asking the user
   * to pick a party on a contract they haven't read.
   */
  const startAnalysisWithPresetRole = useCallback(
    async (
      upload: UploadResponse,
      contractText: string,
      analysisMode: AnalysisMode,
      withCitations: boolean,
      presetRole: string,
    ) => {
      setState({ view: "analyzing", upload, contractText });
      const overview = await streaming.runOverview(contractText);
      if (!overview) return;
      await runAnalysisAndFinish(
        upload,
        contractText,
        analysisMode,
        withCitations,
        presetRole,
      );
    },
    [streaming, runAnalysisAndFinish],
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
        setError(err instanceof Error ? err.message : "Something went wrong");
        setState({ view: "upload" });
        setIsUploading(false);
      }
    },
    [startAnalysis, mode],
  );

  /** Run the live LLM pipeline on a sample contract (demo mode). */
  const handleDemo = useCallback(() => {
    setError(null);
    // Demo skips the role picker — "Contractor" is the correct side for
    // the sample freelance agreement.
    startAnalysisWithPresetRole(
      SAMPLE_UPLOAD_RESPONSE,
      SAMPLE_CONTRACT_TEXT,
      "fast",
      true,
      "Contractor",
    );
  }, [startAnalysisWithPresetRole]);

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
      setPendingAnalysis(null);
      runAnalysisAndFinish(upload, contractText, analysisMode, withCitations, role);
    },
    [pendingAnalysis, state, runAnalysisAndFinish],
  );

  const handleReset = useCallback(() => {
    streaming.reset();
    setPendingAnalysis(null);
    setChatOpen(false);
    setChatQuestion(null);
    setState({ view: "upload" });
    setError(null);
  }, [streaming]);

  /** Open chat with a pre-populated question about a specific clause. */
  const handleAskAboutClause = useCallback((clause: AnalyzedClause) => {
    setChatQuestion(
      `What are the risks of the "${clause.title}" clause, and how could I negotiate better terms?`
    );
    setChatOpen(true);
  }, []);

  const handleOpenChat = useCallback(() => {
    setChatOpen(true);
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-7">
      {state.view === "upload" && (
        <>
          {/* Hero */}
          <div className="pb-12 pt-18 text-center">
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
              AI-Powered Contract Analysis
            </p>
            <h1 className="mx-auto mb-4 max-w-[540px] text-[40px] font-normal leading-[1.3] text-[var(--text-primary)] font-[var(--font-heading)]">
              Know what you&apos;re signing — before you sign it.
            </h1>
            <p className="mx-auto max-w-[450px] text-[17px] text-[var(--text-tertiary)] font-[var(--font-body)]">
              Upload a contract. Get a clause-by-clause risk breakdown written in plain English.
            </p>
          </div>

          {/* Upload zone */}
          <FileUpload
            onFileSelected={handleFileSelected}
            isUploading={isUploading}
            error={error}
          />

          {/* Analysis mode toggle */}
          <div className="mx-auto mt-5 flex max-w-[540px] items-center justify-center">
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
                Fast
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
                Deep
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-sm text-[var(--text-muted)] font-[var(--font-body)]">
            {mode === "fast" ? "Quick scan with GPT-4.1 Nano" : "Thorough per-clause analysis with GPT-4.1"}
          </p>

          {/* Demo CTA */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleDemo}
              disabled={isUploading}
              className="text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              or try a demo with a sample contract
            </button>
          </div>

          {/* How it works */}
          <div className="mx-auto mt-14 max-w-[540px]">
            <p className="mb-4 text-center text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
              How it works
            </p>
            <div className="flex gap-4">
              <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 theme-transition">
                <p className="text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">1. Upload</p>
                <p className="mt-1.5 text-sm text-[var(--text-muted)] font-[var(--font-body)]">Your contract, PDF or DOCX</p>
              </div>
              <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 theme-transition">
                <p className="text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">2. Analyze</p>
                <p className="mt-1.5 text-sm text-[var(--text-muted)] font-[var(--font-body)]">AI reads every clause and assesses risk</p>
              </div>
              <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 theme-transition">
                <p className="text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">3. Review</p>
                <p className="mt-1.5 text-sm text-[var(--text-muted)] font-[var(--font-body)]">Plain-English risk report with export options</p>
              </div>
            </div>
          </div>

          {/* Built-by line */}
          <div className="mx-auto mt-12 max-w-[540px] border-t border-[var(--border-primary)] pt-5 text-center">
            <p className="text-[15px] italic text-[var(--text-muted)] font-[var(--font-heading)]">
              Built by a corporate lawyer turned developer. Not legal advice.
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
        />
      )}

      {state.view === "report" && (
        <>
          <ReportView
            data={state.analysis}
            onReset={handleReset}
            onOpenChat={handleOpenChat}
            onAskAboutClause={handleAskAboutClause}
          />
          <ChatPanel
            isOpen={chatOpen}
            onToggle={() => setChatOpen((o) => !o)}
            contractText={state.contractText}
            analysis={state.analysis}
            initialQuestion={chatQuestion}
            onInitialQuestionConsumed={() => setChatQuestion(null)}
          />
        </>
      )}
    </main>
  );
}
