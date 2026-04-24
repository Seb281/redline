/**
 * SP-10 Arc 3 Task 3.2 — `POST /api/search/embed-query`.
 *
 * Server-side helper that embeds a user query with `mistral-embed` and
 * returns the raw 1024-float vector. Keeps `MISTRAL_API_KEY` off the
 * browser (mirroring the analysis pipeline) while still letting the
 * backend semantic-search endpoint receive a plain float array and
 * avoid holding the key itself.
 *
 * Pipeline: browser → this route (embeds) → backend
 * `POST /api/search/semantic` (runs pgvector query with session cookie).
 */

import { NextResponse } from "next/server";
import { embedQuery } from "@/lib/llm/embeddings";

export async function POST(request: Request) {
  let body: { query?: unknown };
  try {
    body = (await request.json()) as { query?: unknown };
  } catch {
    return NextResponse.json(
      { detail: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const query = typeof body.query === "string" ? body.query : "";
  if (!query.trim()) {
    return NextResponse.json(
      { detail: "Query is empty." },
      { status: 422 },
    );
  }

  const embedding = await embedQuery(query);
  if (embedding === null) {
    return NextResponse.json(
      { detail: "Query embedding failed." },
      { status: 502 },
    );
  }

  return NextResponse.json({ embedding });
}
