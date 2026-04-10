/** Main page — state machine managing upload/preview/analyzing/report views. */

"use client";

import { useCallback, useState } from "react";

import { Disclaimer } from "@/components/Disclaimer";
import { FileUpload } from "@/components/FileUpload";
import { ReportView } from "@/components/ReportView";
import { TextPreview } from "@/components/TextPreview";
import { analyzeContract, uploadContract } from "@/lib/api";
import type { AnalyzeResponse, UploadResponse } from "@/types";

type AppState =
  | { view: "upload" }
  | { view: "preview"; upload: UploadResponse }
  | { view: "analyzing"; upload: UploadResponse }
  | { view: "report"; upload: UploadResponse; analysis: AnalyzeResponse };

export default function Home() {
  const [state, setState] = useState<AppState>({ view: "upload" });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadContract(file);
      setState({ view: "preview", upload: result });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setState({ view: "upload" });
    setError(null);
  }, []);

  const handleAnalyze = useCallback(
    async (thinkHard: boolean) => {
      if (state.view !== "preview") return;
      setState({ view: "analyzing", upload: state.upload });
      try {
        const analysis = await analyzeContract(state.upload.extracted_text, thinkHard);
        setState({ view: "report", upload: state.upload, analysis });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
        setState({ view: "preview", upload: state.upload });
      }
    },
    [state]
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <p className="mb-10 text-center text-sm text-[var(--text-tertiary)]">
        Upload a contract. Understand what you&apos;re signing.
      </p>

      {state.view === "upload" && (
        <FileUpload
          onFileSelected={handleFileSelected}
          isUploading={isUploading}
          error={error}
        />
      )}

      {state.view === "preview" && (
        <>
          <TextPreview
            data={state.upload}
            onAnalyze={handleAnalyze}
            onReset={handleReset}
            isAnalyzing={false}
          />
          {error && (
            <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </>
      )}

      {state.view === "analyzing" && (
        <div className="flex flex-col items-center justify-center py-20">
          {/* Spinner */}
          <div className="mb-6 h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--border-primary)] border-t-[var(--accent)]" />

          {/* Multi-step progress */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">Extracting clauses...</p>
            </div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="h-2 w-2 rounded-full bg-[var(--border-secondary)]" />
              <p className="text-sm text-[var(--text-tertiary)]">Analyzing risk...</p>
            </div>
          </div>

          {/* Skeleton cards */}
          <div className="mt-10 w-full max-w-2xl space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] p-4"
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

      <Disclaimer />
    </main>
  );
}
