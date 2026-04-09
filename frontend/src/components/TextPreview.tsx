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

export function TextPreview({
  data,
  onAnalyze,
  onReset,
  isAnalyzing,
}: TextPreviewProps) {
  const [thinkHard, setThinkHard] = useState(false);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">{data.filename}</p>
          <p className="text-sm text-gray-500">
            {data.page_count} {data.page_count === 1 ? "page" : "pages"} ·{" "}
            {data.char_count.toLocaleString()} characters
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
        >
          ← Upload different file
        </button>
      </div>

      <div className="mb-6 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 font-mono text-sm leading-relaxed text-gray-600">
        {data.extracted_text}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onAnalyze(thinkHard)}
          disabled={isAnalyzing}
          className="rounded-md bg-blue-600 px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Contract"}
        </button>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500">
          <button
            type="button"
            role="switch"
            aria-checked={thinkHard}
            onClick={() => setThinkHard(!thinkHard)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              thinkHard ? "bg-blue-600" : "bg-gray-300"
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
      </div>
    </div>
  );
}
