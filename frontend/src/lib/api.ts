/** Backend API client for Redline. */

import type { AnalyzeResponse, UploadResponse } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Wake the backend ahead of the first real request.
 *
 * Railway runs the backend in serverless mode — it sleeps after idle
 * and cold-starts on the first incoming request, which can leave the
 * edge proxy returning 502 before the container is ready. Firing a
 * cheap `/api/health` GET on page mount warms the container while the
 * user is still reading the hero, so the subsequent upload lands on a
 * warm process. Fire-and-forget: errors are swallowed because nothing
 * depends on this succeeding.
 */
export function warmBackend(): void {
  fetch(`${API_BASE}/api/health`, { method: "GET" }).catch(() => {
    // Intentionally ignored — this is a best-effort pre-warm.
  });
}

/** Upload a contract file and extract text. */
export async function uploadContract(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail ?? "Upload failed");
  }

  return res.json();
}

/** Run clause extraction and risk analysis on contract text.
 *
 * Calls the local Next.js API route which uses Vercel AI SDK.
 * Upload and export still go to the FastAPI backend.
 */
export async function analyzeContract(
  text: string,
  thinkHard: boolean
): Promise<AnalyzeResponse> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, think_hard: thinkHard }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Analysis failed" }));
    throw new Error(error.detail ?? "Analysis failed");
  }

  return res.json();
}

/** Generate and download a PDF report from analysis data. */
export async function exportPdf(data: AnalyzeResponse): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error("PDF export failed");
  }

  return res.blob();
}
