/**
 * POST /api/analyze/overview — runs only Pass 0 (contract overview).
 *
 * Split from the streaming analysis route so the UI can show the
 * extracted parties and let the user declare which one they are before
 * the slower extraction + analysis passes run with their perspective.
 */

import { NextResponse } from "next/server";
import { generateOverview } from "@/lib/streaming-analyzer";

export async function POST(request: Request) {
  const body = await request.json();
  const text: string = body.text ?? "";

  if (!text.trim()) {
    return NextResponse.json(
      { detail: "Contract text is empty." },
      { status: 422 },
    );
  }

  try {
    const overview = await generateOverview(text);
    return NextResponse.json({ overview });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Overview extraction failed";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
