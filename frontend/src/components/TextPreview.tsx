/** Extracted text preview with Analyze button and Think Hard toggle. */

"use client";

import { useState } from "react";
import type { UploadResponse } from "@/types";

interface TextPreviewProps {
  data: UploadResponse;
  onAnalyze: (thinkHard: boolean) => void;
  onReset: () => void;
  isAnalyzing: boolean;
}

/** Preview of extracted contract text with analysis controls. */
export function TextPreview({
  data,
  onAnalyze,
  onReset,
  isAnalyzing,
}: TextPreviewProps) {
  const [thinkHard, setThinkHard] = useState(false);

  return (
    <div className="mx-auto max-w-2xl">
      {/* File info bar */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3 theme-transition">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-muted)]">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{data.filename}</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {data.page_count} {data.page_count === 1 ? "page" : "pages"} · {data.char_count.toLocaleString()} chars
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          Change file
        </button>
      </div>

      {/* Text preview with line numbers */}
      <div className="mb-6 max-h-72 overflow-y-auto rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] theme-transition">
        <pre className="p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
          {data.extracted_text.split("\n").map((line, i) => (
            <div key={i} className="flex">
              <span className="mr-4 inline-block w-8 shrink-0 text-right text-xs text-[var(--text-muted)] select-none">
                {i + 1}
              </span>
              <span>{line || "\u00A0"}</span>
            </div>
          ))}
        </pre>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onAnalyze(thinkHard)}
          disabled={isAnalyzing}
          className="rounded-lg bg-[var(--accent)] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Contract"}
        </button>

        <div className="group relative">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <button
              type="button"
              role="switch"
              aria-checked={thinkHard}
              onClick={() => setThinkHard(!thinkHard)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                thinkHard ? "bg-[var(--accent)]" : "bg-[var(--border-secondary)]"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  thinkHard ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            Think Hard
          </label>
          {/* Tooltip */}
          <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-xs text-[var(--bg-primary)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            Analyzes each clause individually for deeper insight
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--text-primary)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
