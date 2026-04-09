/** Main page — state machine managing upload/preview/analyzing/report views. */

"use client";

import { useCallback, useState } from "react";

import { Disclaimer } from "@/components/Disclaimer";
import { FileUpload } from "@/components/FileUpload";
import { uploadContract } from "@/lib/api";
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

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Redline</h1>
        <p className="mt-1 text-gray-500">
          Upload a contract. Understand what you&apos;re signing.
        </p>
      </header>

      {state.view === "upload" && (
        <FileUpload
          onFileSelected={handleFileSelected}
          isUploading={isUploading}
          error={error}
        />
      )}

      {/* Preview, analyzing, and report views added in subsequent tasks */}
      {state.view === "preview" && (
        <div className="text-center text-gray-500">
          Preview screen — coming next.
          <button onClick={handleReset} className="ml-4 text-blue-600 underline">
            Back
          </button>
        </div>
      )}

      <Disclaimer />
    </main>
  );
}
