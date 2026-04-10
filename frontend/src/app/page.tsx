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
    <main className="mx-auto max-w-4xl px-4 py-12">
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
            <p className="mt-4 text-center text-sm text-red-600">{error}</p>
          )}
        </>
      )}

      {state.view === "analyzing" && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          <p className="text-gray-500">Analyzing clauses...</p>
        </div>
      )}

      {state.view === "report" && (
        <ReportView data={state.analysis} onReset={handleReset} />
      )}

      <Disclaimer />
    </main>
  );
}
