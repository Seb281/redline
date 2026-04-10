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
        <div className="flex flex-col items-center justify-center py-24">
          {/* File info bar */}
          <div className="mb-9 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5 py-3 text-[15px] text-[var(--text-secondary)] font-[var(--font-body)] theme-transition">
            {state.upload.filename} · {state.upload.page_count} {state.upload.page_count === 1 ? "page" : "pages"} · {state.upload.char_count.toLocaleString()} chars
          </div>

          {/* Spinner */}
          <div className="mb-7 h-9 w-9 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />

          {/* Multi-step progress */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              <p className="text-[17px] font-medium text-[var(--text-primary)] font-[var(--font-body)]">Extracting clauses...</p>
            </div>
            <div className="flex items-center gap-2.5 opacity-40">
              <div className="h-2 w-2 rounded-full bg-[var(--border-secondary)]" />
              <p className="text-[17px] text-[var(--text-tertiary)] font-[var(--font-body)]">Analyzing risk...</p>
            </div>
          </div>

          {/* Skeleton cards */}
          <div className="mt-12 w-full max-w-2xl space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded border border-[var(--border-primary)] border-l-4 border-l-[var(--border-secondary)] bg-[var(--bg-card)] p-5 theme-transition"
              >
                <div className="mb-3.5 flex gap-2.5">
                  <div className="h-6 w-18 rounded bg-[var(--bg-tertiary)]" />
                  <div className="h-6 w-28 rounded bg-[var(--bg-tertiary)]" />
                </div>
                <div className="mb-2.5 h-5 w-56 rounded bg-[var(--bg-tertiary)]" />
                <div className="h-3.5 w-full rounded bg-[var(--bg-tertiary)]" />
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
