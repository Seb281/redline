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
import type { AnalyzeResponse } from "@/types";

const MAX_MESSAGES = 10;

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
    ...ctx.relevantClauses.map(
      (c) =>
        `\n--- ${c.title} [${c.risk_level.toUpperCase()} RISK | ${c.category}] ---\n` +
        `Plain English: ${c.plain_english}\n` +
        `Risk: ${c.risk_explanation}` +
        (c.negotiation_suggestion ? `\nSuggestion: ${c.negotiation_suggestion}` : "") +
        (c.jurisdiction_note ? `\nJurisdiction: ${c.jurisdiction_note}` : ""),
    ),
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

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: provider.model("medium"),
    system: systemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
