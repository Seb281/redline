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
  onFileSelected: (file: File) => void;
  isUploading: boolean;
  error: string | null;
}

export function FileUpload({
  onFileSelected,
  isUploading,
  error,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return;
      }
      if (file.size > MAX_SIZE) {
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
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
        className={`w-full max-w-lg rounded-xl border-2 border-dashed px-10 py-16 text-center transition-colors ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        <div className="mb-3 text-4xl">📄</div>
        <p className="mb-1 text-lg font-semibold text-gray-800">
          Drop your contract here
        </p>
        <p className="mb-4 text-sm text-gray-500">PDF or DOCX — up to 10 MB</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Browse files"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleChange}
          className="hidden"
        />
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
