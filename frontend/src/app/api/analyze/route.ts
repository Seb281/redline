/** POST /api/analyze — runs the LLM clause analysis pipeline. */

import { NextResponse } from "next/server";
import { analyzeContract } from "@/lib/analyzer";
import type { AnalysisMode } from "@/types";

export async function POST(request: Request) {
  const body = await request.json();
  const text: string = body.text ?? "";
  const mode: AnalysisMode = body.mode === "deep" ? "deep" : "fast";
  const withCitations: boolean = body.with_citations ?? true;
  const userRole: string | null =
    typeof body.user_role === "string" && body.user_role.trim().length > 0
      ? body.user_role.trim()
      : null;

  if (!text.trim()) {
    return NextResponse.json(
      { detail: "Contract text is empty." },
      { status: 422 }
    );
  }

  try {
    const result = await analyzeContract(text, mode, withCitations, userRole);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
