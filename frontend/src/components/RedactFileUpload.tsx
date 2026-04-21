/**
 * PDF-only dropzone for the /redact flow.
 *
 * Kept separate from the analyzer's FileUpload because scope is tighter:
 * PDF-only (DOCX is rejected with an explicit message), no citations
 * toggle, no analysis mode. Editorial restyle — 1px paper-edge border,
 * no rounded corners, ink primary button.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, MonoLabel } from "@/components/ui";

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
  const t = useTranslations("RedactFileUpload");
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
        setLocalError(t("errorDocx"));
        return;
      }
      if (file.type !== PDF_MIME && ext !== ".pdf") {
        setLocalError(t("errorInvalidFormat"));
        return;
      }
      if (file.size > MAX_SIZE) {
        setLocalError(t("errorTooLarge"));
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected, t],
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
        className={`w-full max-w-[640px] border px-10 py-14 text-center transition-colors duration-150 ${
          isDragging
            ? "border-ink bg-paper-2"
            : "border-paper-edge bg-paper hover:border-ink"
        }`}
      >
        {/* Shredder icon */}
        <div className="mb-5 flex justify-center text-ink-muted">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="square"
            strokeLinejoin="miter"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="16" y2="17" />
          </svg>
        </div>

        <p className="m-0 font-serif text-[22px] font-light leading-tight text-ink">
          {t("dropHere")}
        </p>
        <p className="mt-2 mb-6 t-reading text-[14.5px] italic text-ink-muted">
          {t("accepted")}
        </p>

        {isProcessing ? (
          <div className="mx-auto flex w-60 flex-col items-center gap-3">
            <div className="h-[2px] w-full overflow-hidden bg-paper-edge">
              <div
                className="h-full animate-pulse bg-ink"
                style={{ width: "60%" }}
              />
            </div>
            <MonoLabel tone="muted">{t("processing")}</MonoLabel>
          </div>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={() => inputRef.current?.click()}
          >
            {t("browseFiles")}
          </Button>
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
        <p className="mt-5 font-mono text-[12px] uppercase tracking-[1.2px] text-red-accent">
          {displayedError}
        </p>
      )}
    </div>
  );
}
