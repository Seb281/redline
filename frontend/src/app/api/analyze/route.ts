/** POST /api/analyze — runs the LLM clause analysis pipeline. */

import { NextResponse } from "next/server";
import { analyzeContract } from "@/lib/analyzer";

export async function POST(request: Request) {
  const body = await request.json();
  const text: string = body.text ?? "";
  const thinkHard: boolean = body.think_hard ?? false;

  if (!text.trim()) {
    return NextResponse.json(
      { detail: "Contract text is empty." },
      { status: 422 }
    );
  }

  try {
    const result = await analyzeContract(text, thinkHard);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
