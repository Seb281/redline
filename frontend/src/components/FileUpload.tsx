/**
 * FileUpload — editorial dropzone for contract uploads.
 *
 * Renders a 1px dashed ink-edged drop target that inverts to paper-2
 * on drag or hover. A secondary serif prompt drives the visual, with
 * the Browse action and citations toggle arranged on a mono baseline
 * below. API (`onFileSelected(file, withCitations)`) is unchanged —
 * this rewrite is presentation only.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { Toggle } from "@/components/ui/Toggle";

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

export function FileUpload({
  onFileSelected,
  isUploading,
  error,
}: FileUploadProps) {
  const t = useTranslations("FileUpload");
  const [isDragging, setIsDragging] = useState(false);
  // Default ON: citations are the headline feature. Users can opt out
  // for cheaper/faster runs instead of forcing everyone to opt in.
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

  const openPicker = useCallback(() => {
    if (!isUploading) inputRef.current?.click();
  }, [isUploading]);

  return (
    <div className="flex flex-col">
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        aria-label={t("dropHere")}
        className={`group flex min-h-[260px] flex-col justify-between gap-8 border border-dashed px-8 py-8 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ink ${
          isDragging
            ? "border-ink bg-paper-2"
            : "border-ink/60 bg-paper hover:bg-paper-2 hover:border-ink"
        } ${isUploading ? "cursor-wait" : "cursor-pointer"}`}
      >
        <div>
          <MonoLabel tone="muted">{t("eyebrow")}</MonoLabel>
          <h3 className="mt-3 font-serif text-[32px] leading-[1.1] tracking-[-0.02em] text-ink m-0">
            {t("dropHere")}{" "}
            <span className="italic text-red-accent">{t("dropHereAccent")}</span>
          </h3>
          <p className="t-reading text-ink-2 mt-3 m-0 max-w-[42ch]">{t("hint")}</p>
        </div>

        {isUploading ? (
          <div className="w-full">
            <div className="h-px w-full overflow-hidden bg-paper-edge">
              <div className="h-full w-3/5 bg-red-accent transition-all duration-500" />
            </div>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[1.5px] text-ink-muted">
              {t("uploading")}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={(e) => {
                  e.stopPropagation();
                  openPicker();
                }}
              >
                {t("browseFiles")}
              </Button>
              <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
                {t("formats")}
              </span>
            </div>

            <label
              className="flex cursor-pointer items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <Toggle
                checked={withCitations}
                onChange={setWithCitations}
                label={t("citations")}
              />
              <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-2">
                {t("citations")}
              </span>
            </label>
          </div>
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
        <p className="mt-4 font-mono text-[12px] uppercase tracking-[1px] text-red-accent">
          {error}
        </p>
      )}
    </div>
  );
}
