/**
 * PDF-only dropzone for the /redact flow.
 *
 * WHY not reuse FileUpload.tsx: FileUpload accepts PDF + DOCX and carries
 * a citations toggle and analysis mode — none of which belong here.
 * The redact flow is PDF-only (DOCX is rejected with an explicit message)
 * and has no analysis options. Keeping scope tight avoids conditionally
 * disabling features in a shared component.
 */

"use client";

import { useCallback, useRef, useState } from "react";

const PDF_MIME = "application/pdf";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface RedactFileUploadProps {
  /** Fires with the validated PDF File. Hook takes it from here. */
  onFileSelected: (file: File) => void;
  /** True while the hook is in extracting / running_overview state. */
  isProcessing: boolean;
  /** Error from the pipeline to surface beneath the dropzone. */
  error: string | null;
}

/** Drag-and-drop PDF-only upload zone. */
export function RedactFileUpload({
  onFileSelected,
  isProcessing,
  error,
}: RedactFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Validate + forward the file. DOCX is rejected at this layer with a
   * clear message — the hook also validates, but surfacing it here gives
   * faster feedback before ArrayBuffer allocation.
   */
  const validateAndSelect = useCallback(
    (file: File) => {
      setLocalError(null);
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (ext === ".docx") {
        setLocalError(
          "Only native PDFs are supported. Convert DOCX first.",
        );
        return;
      }
      if (file.type !== PDF_MIME && ext !== ".pdf") {
        setLocalError("Only PDF files are accepted here.");
        return;
      }
      if (file.size > MAX_SIZE) {
        setLocalError("File too large (max 10 MB).");
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect],
  );

  const displayedError = localError ?? error;

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
        {/* Shredder icon */}
        <div className="mb-5 flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--text-muted)]"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="16" y2="17" />
          </svg>
        </div>

        <p className="mb-1.5 text-lg font-medium text-[var(--text-primary)] font-[var(--font-body)]">
          Drop your PDF here
        </p>
        <p className="mb-6 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
          Native PDF only — up to 10 MB
        </p>

        {isProcessing ? (
          <div className="mx-auto w-56">
            <div className="mb-2.5 h-[2px] overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: "60%" }}
              />
            </div>
            <p className="text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)]">
              Processing…
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded bg-[var(--text-primary)] px-7 py-3 text-[15px] font-medium text-[var(--bg-primary)] font-[var(--font-body)] transition-opacity hover:opacity-80"
          >
            Browse files
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={PDF_MIME}
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {displayedError && (
        <p className="mt-5 text-[17px] text-[var(--accent)] font-[var(--font-body)]">
          {displayedError}
        </p>
      )}
    </div>
  );
}
