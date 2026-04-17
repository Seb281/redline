/**
 * POST /api/analyze/stream — runs Pass 1 (extraction) + Pass 2 (analysis),
 * streaming results back as NDJSON. Callers are expected to have already
 * fetched the overview via `/api/analyze/overview` so this endpoint can
 * skip straight to clause extraction.
 */

import { streamExtractAndAnalyze } from "@/lib/streaming-analyzer";
import { getProvider, isOverrideAllowed, type ProviderName } from "@/lib/llm/provider";
import type { AnalysisMode, JurisdictionEvidence } from "@/types";

export async function POST(request: Request) {
  const body = await request.json();
  const text: string = body.text ?? "";
  const mode: AnalysisMode = body.mode === "deep" ? "deep" : "fast";
  // Default to citations ON when the caller omits the flag, so older
  // clients (and direct curl probes) keep the prior behavior.
  const withCitations: boolean = body.with_citations ?? true;
  // Optional declared party; when null/missing, analysis falls back to
  // the default weaker-party framing.
  const userRole: string | null =
    typeof body.user_role === "string" && body.user_role.trim().length > 0
      ? body.user_role.trim()
      : null;
  // Clause inventory from the overview pass — anchors extraction to a
  // specific set of clauses for consistency across runs.
  const clauseInventory: { title: string; section_ref: string | null }[] =
    Array.isArray(body.clause_inventory) ? body.clause_inventory : [];
  // Governing jurisdiction from the overview pass — injected into the
  // analysis system prompt for jurisdiction-aware risk assessment.
  const jurisdiction: string | null =
    typeof body.jurisdiction === "string" && body.jurisdiction.trim().length > 0
      ? body.jurisdiction.trim()
      : null;
  // SP-1.7 — forwarded from Pass 0 so Pass 2 prompt can dispatch on the
  // whitelist vs emit applicable_law=null for every clause.
  const jurisdictionEvidence: JurisdictionEvidence | null =
    body.jurisdiction_evidence && typeof body.jurisdiction_evidence === "object"
      ? (body.jurisdiction_evidence as JurisdictionEvidence)
      : null;
  if (!text.trim()) {
    return Response.json(
      { detail: "Contract text is empty." },
      { status: 422 }
    );
  }

  if (clauseInventory.length === 0) {
    return Response.json(
      { detail: "Clause inventory is required. Run the overview endpoint first." },
      { status: 422 }
    );
  }

  // Dev-only `?provider=` override; ignored in production.
  const url = new URL(request.url);
  const overrideRaw = url.searchParams.get("provider");
  const override =
    isOverrideAllowed() && (overrideRaw === "openai" || overrideRaw === "mistral")
      ? (overrideRaw as ProviderName)
      : undefined;
  const provider = getProvider(override);

  const stream = streamExtractAndAnalyze(
    text,
    mode,
    withCitations,
    clauseInventory,
    userRole,
    jurisdiction,
    jurisdictionEvidence,
    provider,
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
