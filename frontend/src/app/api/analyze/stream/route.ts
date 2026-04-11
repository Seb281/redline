/**
 * POST /api/analyze/stream — runs Pass 1 (extraction) + Pass 2 (analysis),
 * streaming results back as NDJSON. Callers are expected to have already
 * fetched the overview via `/api/analyze/overview` so this endpoint can
 * skip straight to clause extraction.
 */

import { streamExtractAndAnalyze } from "@/lib/streaming-analyzer";

export async function POST(request: Request) {
  const body = await request.json();
  const text: string = body.text ?? "";
  const thinkHard: boolean = body.think_hard ?? false;
  // Default to citations ON when the caller omits the flag, so older
  // clients (and direct curl probes) keep the prior behavior.
  const withCitations: boolean = body.with_citations ?? true;
  // Optional declared party; when null/missing, analysis falls back to
  // the default weaker-party framing.
  const userRole: string | null =
    typeof body.user_role === "string" && body.user_role.trim().length > 0
      ? body.user_role.trim()
      : null;

  if (!text.trim()) {
    return Response.json(
      { detail: "Contract text is empty." },
      { status: 422 }
    );
  }

  const stream = streamExtractAndAnalyze(text, thinkHard, withCitations, userRole);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
