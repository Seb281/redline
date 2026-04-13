/** Drag-and-drop file upload zone for contract documents. */

"use client";

import { useCallback, useRef, useState } from "react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface FileUploadProps {
  onFileSelected: (file: File, withCitations: boolean) => void;
  isUploading: boolean;
  error: string | null;
}

/** Upload zone with drag-and-drop, file picker, progress bar, and analysis toggles. */
export function FileUpload({
  onFileSelected,
  isUploading,
  error,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  // Default ON: citations are the headline feature of the report, so the
  // toggle lets power users opt out for cheaper/faster runs instead of
  // forcing everyone to opt in.
  const [withCitations, setWithCitations] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) return;
      if (file.size > MAX_SIZE) return;
      onFileSelected(file, withCitations);
    },
    [onFileSelected, withCitations]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  return (
    <div className="flex flex-col items-center">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`w-full max-w-[540px] rounded border-2 border-dashed px-12 py-16 text-center transition-all duration-200 ${
          isDragging
            ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
            : "border-[var(--border-secondary)] bg-[var(--bg-secondary)] hover:border-[var(--text-muted)]"
        }`}
      >
        {/* Document icon */}
        <div className="mb-5 flex justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>

        <p className="mb-1.5 text-lg font-medium text-[var(--text-primary)] font-[var(--font-body)]">
          Drop your contract here
        </p>
        <p className="mb-6 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
          PDF or DOCX — up to 10 MB
        </p>

        {isUploading ? (
          <div className="mx-auto w-56">
            <div className="mb-2.5 h-[2px] overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: "60%" }} />
            </div>
            <p className="text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)]">Uploading...</p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded bg-[var(--text-primary)] px-7 py-3 text-[15px] font-medium text-[var(--bg-primary)] font-[var(--font-body)] transition-opacity hover:opacity-80"
            >
              Browse files
            </button>

            {/* Analysis toggle */}
            <div className="mt-6 flex items-center justify-center">
              {/* Citations toggle */}
              <div className="group relative">
                <label className="flex cursor-pointer items-center justify-center gap-2.5 text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)]">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={withCitations}
                    onClick={() => setWithCitations(!withCitations)}
                    className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                      withCitations ? "bg-[var(--accent)]" : "bg-[var(--border-secondary)]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        withCitations ? "translate-x-[18px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  Citations
                </label>
                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 whitespace-nowrap rounded bg-[var(--text-primary)] px-3.5 py-2 text-[15px] text-[var(--bg-primary)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 font-[var(--font-body)]">
                  Quote verbatim clause text in footnotes (slower, costlier)
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--text-primary)]" />
                </div>
              </div>
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleChange}
          className="hidden"
        />
      </div>
      {error && (
        <p className="mt-5 text-[17px] text-[var(--accent)] font-[var(--font-body)]">{error}</p>
      )}
    </div>
  );
}
