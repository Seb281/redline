/**
 * POST /api/chat — streaming chat endpoint for contract follow-up questions.
 *
 * Receives UI messages plus the analysis object, selects relevant clauses
 * via keyword matching, and streams a grounded response. Enforces a
 * 10-message limit per session.
 */

import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { getProvider, isOverrideAllowed, type ProviderName } from "@/lib/llm/provider";
import { buildChatContext } from "@/lib/chat-context";
import { redact } from "@/lib/redaction";
import { heuristicLabels, normalizeLabel, disambiguateLabels } from "@/lib/redaction/role-heuristics";
import { STATUTE_LABELS } from "@/lib/applicable-law";
import type { AnalyzeResponse, AnalyzedClause } from "@/types";

const MAX_MESSAGES = 10;

/**
 * SP-1.7 — Per-clause context line for RAG prompt.
 *
 * Exported so unit tests can assert the `applicable_law` formatting
 * without standing up the full streaming route. When `applicable_law`
 * is set, appends a one-line "Applicable law: …" footer with the
 * canonical statute labels pulled from {@link STATUTE_LABELS}.
 */
export function formatClauseContext(c: AnalyzedClause): string {
  const applicableLawLine = c.applicable_law
    ? `\nApplicable law: ${c.applicable_law.observation}` +
      (c.applicable_law.citations.length > 0
        ? ` (${c.applicable_law.citations
            .map((cit) => STATUTE_LABELS[cit.code])
            .join("; ")})`
        : "")
    : "";
  return (
    `\n--- ${c.title} [${c.risk_level.toUpperCase()} RISK | ${c.category}] ---\n` +
    `Plain English: ${c.plain_english}\n` +
    `Risk: ${c.risk_explanation}` +
    (c.negotiation_suggestion ? `\nSuggestion: ${c.negotiation_suggestion}` : "") +
    applicableLawLine
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const messages: UIMessage[] = body.messages ?? [];
  const analysis: AnalyzeResponse | null = body.analysis ?? null;

  // Dev-only `?provider=` override: lets local testing swap providers
  // without restarting the server. Gate keeps this off in production.
  const url = new URL(request.url);
  const overrideRaw = url.searchParams.get("provider");
  const override =
    isOverrideAllowed() && (overrideRaw === "openai" || overrideRaw === "mistral")
      ? (overrideRaw as ProviderName)
      : undefined;
  const provider = getProvider(override);

  // Enforce message limit
  if (messages.length > MAX_MESSAGES) {
    return Response.json(
      { detail: "Chat limit reached for this session." },
      { status: 429 },
    );
  }

  if (!analysis) {
    return Response.json(
      { detail: "Analysis data is required." },
      { status: 422 },
    );
  }

  // Get the latest user message for relevance matching
  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const question = latestUserMessage?.parts
    ?.reduce((acc: string, p) => (p.type === "text" ? acc + " " + p.text : acc), "")
    .trim() ?? "";

  const ctx = buildChatContext(question, analysis);

  const contextBlock = [
    `CONTRACT TYPE: ${ctx.overview.contract_type}`,
    `PARTIES: ${ctx.overview.parties.join(", ")}`,
    ctx.overview.governing_jurisdiction
      ? `JURISDICTION: ${ctx.overview.governing_jurisdiction}`
      : null,
    `\nRISK SUMMARY: ${ctx.summary.risk_breakdown.high} high, ${ctx.summary.risk_breakdown.medium} medium, ${ctx.summary.risk_breakdown.low} low, ${ctx.summary.risk_breakdown.informational} informational`,
    ctx.summary.top_risks.length > 0
      ? `TOP RISKS:\n${ctx.summary.top_risks.map((r) => `- ${r}`).join("\n")}`
      : null,
    `\nRELEVANT CLAUSES (${ctx.relevantClauses.length} of ${analysis.clauses.length} total):`,
    ...ctx.relevantClauses.map(formatClauseContext),
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You are a helpful contract assistant analyzing a specific contract. \
You have access to contract metadata and the most relevant clauses for this question.

IMPORTANT: You are NOT providing legal advice. You are providing analysis and information \
to help the user understand their contract better. Always remind users to consult a \
qualified lawyer for legal decisions.

${contextBlock}

INSTRUCTIONS:
- Answer questions about specific clauses, risks, and terms in this contract.
- Reference specific clause titles and sections when relevant.
- Suggest negotiation strategies when asked.
- Be direct and practical. Use plain English, not legal jargon.
- If asked about jurisdiction-specific law, note that legal outcomes vary and recommend \
consulting a local attorney.
- Keep responses concise (2-4 paragraphs max) unless the user asks for detail.`;

  // Scrub BOTH party names and PII (emails, phone numbers, IBANs, VAT
  // IDs, …) out of the system prompt and every user message before the
  // LLM sees them — the privacy boundary is the model provider, not the
  // end user. Party names come from Pass 0 (`analysis.overview.parties`)
  // and are tokenized identically here so repeated chat turns produce
  // consistent tokens.
  //
  // The streamed reply is NOT rehydrated here: `useChat` consumes a
  // UI-message stream and transparent mid-stream rehydration would
  // require wrapping that protocol. The assistant reply therefore
  // reaches the UI with `⟦PARTY_A⟧`-style tokens intact. Rehydrating
  // on the client (ChatPanel) using the publicly-known parties list is
  // tracked as SP-1 follow-up — not a blocker for the privacy gate.
  // SP-1.9: derive LabeledParty[] so redact() gets the correct shape.
  // Chat route uses the same heuristic pipeline as the main analysis hook —
  // LLM role_label first, heuristic fallback, normalize, disambiguate.
  const rawParties = analysis.overview.parties ?? [];
  const heuristic = heuristicLabels(
    analysis.overview.contract_type ?? "",
    rawParties.length,
  );
  const seeded = rawParties.map((p, i) =>
    normalizeLabel(p.role_label ?? "") || heuristic[i],
  );
  const labels = disambiguateLabels(seeded);
  const parties = rawParties.map((p, i) => ({ name: p.name, label: labels[i] }));

  const scrubbedSystemPrompt = redact(systemPrompt, parties).scrubbed;
  const scrubbedMessages: UIMessage[] = messages.map((m) => ({
    ...m,
    parts: m.parts?.map((p) =>
      p.type === "text" ? { ...p, text: redact(p.text, parties).scrubbed } : p,
    ),
  }));
  const modelMessages = await convertToModelMessages(scrubbedMessages);

  const result = streamText({
    model: provider.model("medium"),
    system: scrubbedSystemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
