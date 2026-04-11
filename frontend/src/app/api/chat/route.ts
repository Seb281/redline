/**
 * POST /api/chat — streaming chat endpoint for contract follow-up questions.
 *
 * Receives UI messages plus the contract text and analysis JSON as context,
 * then streams back an assistant response grounded in the contract data.
 */

import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { model } from "@/lib/analyzer";

export async function POST(request: Request) {
  const body = await request.json();
  const messages: UIMessage[] = body.messages ?? [];
  const contractText: string = body.contractText ?? "";
  const analysisJson: string = body.analysisJson ?? "";

  const systemPrompt = `You are a helpful contract assistant analyzing a specific contract. \
You have access to the full contract text and a clause-by-clause risk analysis.

IMPORTANT: You are NOT providing legal advice. You are providing analysis and information \
to help the user understand their contract better. Always remind users to consult a \
qualified lawyer for legal decisions.

CONTRACT TEXT:
${contractText}

ANALYSIS RESULTS:
${analysisJson}

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
    model,
    system: systemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
