/** POST /api/analyze/stream — streaming version of the analysis pipeline. */

import { streamAnalyzeContract } from "@/lib/streaming-analyzer";

export async function POST(request: Request) {
  const body = await request.json();
  const text: string = body.text ?? "";
  const thinkHard: boolean = body.think_hard ?? false;
  // Default to citations ON when the caller omits the flag, so older
  // clients (and direct curl probes) keep the prior behavior.
  const withCitations: boolean = body.with_citations ?? true;

  if (!text.trim()) {
    return Response.json(
      { detail: "Contract text is empty." },
      { status: 422 }
    );
  }

  const stream = streamAnalyzeContract(text, thinkHard, withCitations);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
