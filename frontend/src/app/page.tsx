/** Main page — state machine managing upload/analyzing/report views. */

"use client";

import { useCallback, useState } from "react";

import { FileUpload } from "@/components/FileUpload";
import { ReportView } from "@/components/ReportView";
import { analyzeContract, uploadContract } from "@/lib/api";
import type { AnalyzeResponse, UploadResponse } from "@/types";

type AppState =
  | { view: "upload" }
  | { view: "analyzing"; upload: UploadResponse }
  | { view: "report"; upload: UploadResponse; analysis: AnalyzeResponse };

export default function Home() {
  const [state, setState] = useState<AppState>({ view: "upload" });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Upload file, then immediately begin analysis. */
  const handleFileSelected = useCallback(async (file: File, thinkHard: boolean) => {
    setIsUploading(true);
    setError(null);
    try {
      const uploadResult = await uploadContract(file);
      setState({ view: "analyzing", upload: uploadResult });
      setIsUploading(false);

      const analysis = await analyzeContract(uploadResult.extracted_text, thinkHard);
      setState({ view: "report", upload: uploadResult, analysis });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState({ view: "upload" });
      setIsUploading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setState({ view: "upload" });
    setError(null);
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {state.view === "upload" && (
        <>
          {/* Hero */}
          <div className="pb-10 pt-16 text-center">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
              AI-Powered Contract Analysis
            </p>
            <h1 className="mx-auto mb-3 max-w-[480px] text-[36px] font-normal leading-[1.3] text-[var(--text-primary)] font-[var(--font-heading)]">
              Know what you&apos;re signing — before you sign it.
            </h1>
            <p className="mx-auto max-w-[400px] text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)]">
              Upload a contract. Get a clause-by-clause risk breakdown written in plain English.
            </p>
          </div>

          {/* Upload zone */}
          <FileUpload
            onFileSelected={handleFileSelected}
            isUploading={isUploading}
            error={error}
          />

          {/* How it works */}
          <div className="mx-auto mt-12 max-w-[480px]">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
              How it works
            </p>
            <div className="flex gap-3">
              <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 theme-transition">
                <p className="text-[13px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">1. Upload</p>
                <p className="mt-1 text-xs text-[var(--text-muted)] font-[var(--font-body)]">Your contract, PDF or DOCX</p>
              </div>
              <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 theme-transition">
                <p className="text-[13px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">2. Analyze</p>
                <p className="mt-1 text-xs text-[var(--text-muted)] font-[var(--font-body)]">AI reads every clause and assesses risk</p>
              </div>
              <div className="flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 theme-transition">
                <p className="text-[13px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">3. Review</p>
                <p className="mt-1 text-xs text-[var(--text-muted)] font-[var(--font-body)]">Plain-English risk report with export options</p>
              </div>
            </div>
          </div>

          {/* Built-by line */}
          <div className="mx-auto mt-10 max-w-[480px] border-t border-[var(--border-primary)] pt-4 text-center">
            <p className="text-sm italic text-[var(--text-muted)] font-[var(--font-heading)]">
              Built by a corporate lawyer turned developer. Not legal advice.
            </p>
          </div>
        </>
      )}

      {state.view === "analyzing" && (
        <div className="flex flex-col items-center justify-center py-20">
          {/* File info bar */}
          <div className="mb-8 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-secondary)] font-[var(--font-body)] theme-transition">
            {state.upload.filename} · {state.upload.page_count} {state.upload.page_count === 1 ? "page" : "pages"} · {state.upload.char_count.toLocaleString()} chars
          </div>

          {/* Spinner */}
          <div className="mb-6 h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />

          {/* Multi-step progress */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <p className="text-[15px] font-medium text-[var(--text-primary)] font-[var(--font-body)]">Extracting clauses...</p>
            </div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--border-secondary)]" />
              <p className="text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)]">Analyzing risk...</p>
            </div>
          </div>

          {/* Skeleton cards */}
          <div className="mt-10 w-full max-w-2xl space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded border border-[var(--border-primary)] border-l-4 border-l-[var(--border-secondary)] bg-[var(--bg-card)] p-4 theme-transition"
              >
                <div className="mb-3 flex gap-2">
                  <div className="h-5 w-16 rounded bg-[var(--bg-tertiary)]" />
                  <div className="h-5 w-24 rounded bg-[var(--bg-tertiary)]" />
                </div>
                <div className="mb-2 h-4 w-48 rounded bg-[var(--bg-tertiary)]" />
                <div className="h-3 w-full rounded bg-[var(--bg-tertiary)]" />
              </div>
            ))}
          </div>
        </div>
      )}

      {state.view === "report" && (
        <ReportView data={state.analysis} onReset={handleReset} />
      )}
    </main>
  );
}
