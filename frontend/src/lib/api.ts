/** Backend API client for Redline. */

import type { AnalyzeResponse, UploadResponse, AnalysisMode, AuthUser, AnalysisListItem, SaveAnalysisPayload, SavedAnalysis } from "@/types";

/**
 * Normalize the configured backend URL so trailing slashes and missing
 * schemes can't turn an absolute URL into a relative path.
 *
 * If `NEXT_PUBLIC_API_URL` is set to e.g. `redline.up.railway.app` (no
 * scheme), `fetch` will resolve it against the current page origin and
 * produce a 404 from the frontend host instead of hitting the backend.
 * Prepending `https://` when no scheme is present keeps deploys robust
 * to that misconfiguration.
 */
function normalizeBase(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const API_BASE = normalizeBase(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001"
);

/**
 * Fetch wrapper for backend API calls.
 *
 * Includes `credentials: "include"` so cross-origin HttpOnly session
 * cookies are sent and received on every backend request.
 */
async function backendFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
  });
}

/**
 * Extract a human-readable error message from a failed `fetch` response.
 *
 * Tries the backend's JSON `{detail}` shape first, falls back to raw text
 * (truncated), and finally to the HTTP status line. This matters because
 * HTML error pages (e.g. a 404 from the wrong origin) would otherwise be
 * swallowed by `res.json()` and collapse into a generic "Upload failed".
 */
async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail.length > 0) {
        return body.detail;
      }
    } else {
      const text = (await res.text()).trim();
      if (text.length > 0) {
        const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text;
        return `${fallback} (${res.status} ${res.statusText}): ${snippet}`;
      }
    }
  } catch {
    // fall through to the status-based fallback
  }
  return `${fallback} (${res.status} ${res.statusText})`;
}

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

  let res: Response;
  try {
    res = await backendFetch("/api/upload", {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    // Network-level failure (DNS, CORS preflight, offline, etc.) never
    // produces a Response, so surface the underlying message directly.
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Upload failed: ${reason}`);
  }

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Upload failed"));
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
  mode: AnalysisMode,
  withCitations: boolean = true,
  userRole?: string | null,
): Promise<AnalyzeResponse> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      mode,
      with_citations: withCitations,
      user_role: userRole ?? null,
    }),
  });

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Analysis failed"));
  }

  return res.json();
}

/** Generate and download a PDF report from analysis data. */
export async function exportPdf(data: AnalyzeResponse): Promise<Blob> {
  const res = await backendFetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "PDF export failed"));
  }

  return res.blob();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Send a magic link login email. */
export async function login(email: string): Promise<{ message: string }> {
  const res = await backendFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Login failed"));
  }

  return res.json();
}

/** Verify a magic link token and establish a session. */
export async function verifyToken(token: string): Promise<AuthUser> {
  const res = await backendFetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Verification failed"));
  }

  return res.json();
}

/** Log out and clear the session cookie. */
export async function logout(): Promise<void> {
  await backendFetch("/api/auth/logout", { method: "POST" });
}

/**
 * Get the current authenticated user.
 *
 * Returns `null` for anonymous visitors instead of throwing — the 401
 * from the backend is an expected "not logged in" signal, not an error.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await backendFetch("/api/auth/me");
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Analyses (persistence)
// ---------------------------------------------------------------------------

/** Save an analysis for the authenticated user. Returns the saved ID. */
export async function saveAnalysis(payload: SaveAnalysisPayload): Promise<{ id: string }> {
  const res = await backendFetch("/api/analyses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Save failed"));
  }

  return res.json();
}

/** List all saved analyses for the authenticated user. */
export async function listAnalyses(): Promise<AnalysisListItem[]> {
  const res = await backendFetch("/api/analyses");

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Failed to load analyses"));
  }

  return res.json();
}

/** Fetch a single saved analysis by ID. */
export async function getAnalysis(id: string): Promise<SavedAnalysis> {
  const res = await backendFetch(`/api/analyses/${encodeURIComponent(id)}`);

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Analysis not found"));
  }

  return res.json();
}

/** Delete a saved analysis by ID. */
export async function deleteAnalysis(id: string): Promise<void> {
  const res = await backendFetch(`/api/analyses/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Delete failed"));
  }
}
