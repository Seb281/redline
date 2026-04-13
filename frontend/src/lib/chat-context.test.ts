import { describe, it, expect } from "vitest";
import { buildChatContext } from "./chat-context";
import type { AnalyzeResponse } from "@/types";

const mockAnalysis: AnalyzeResponse = {
  overview: {
    contract_type: "Service Agreement",
    parties: ["Alice Corp", "Bob LLC"],
    effective_date: "2025-01-01",
    duration: "12 months",
    total_value: null,
    governing_jurisdiction: "the Netherlands",
    key_terms: ["Monthly payment of €5,000"],
    clause_inventory: [],
  },
  summary: {
    total_clauses: 4,
    risk_breakdown: { high: 1, medium: 1, low: 1, informational: 1 },
    top_risks: ["Non-compete is overly broad"],
  },
  clauses: [
    {
      clause_text: "Contractor shall not compete for 18 months across the EU.",
      category: "non_compete",
      title: "Non-Compete Restriction",
      plain_english: "You cannot work for competitors for 18 months.",
      risk_level: "high",
      risk_explanation: "Overly broad.",
      negotiation_suggestion: "Reduce to 6 months.",
      is_unusual: true,
      unusual_explanation: "18 months is unusual.",
      jurisdiction_note: "Likely unenforceable under Dutch law.",
      citations: [],
    },
    {
      clause_text: "Payment due within 45 days of invoice.",
      category: "payment_terms",
      title: "Payment Terms",
      plain_english: "Invoices are due in 45 days.",
      risk_level: "medium",
      risk_explanation: "Slightly long.",
      negotiation_suggestion: "Request 30 days.",
      is_unusual: false,
      unusual_explanation: null,
      jurisdiction_note: null,
      citations: [],
    },
    {
      clause_text: "Either party may terminate with 60 days notice.",
      category: "termination",
      title: "Termination Notice",
      plain_english: "60 days notice to end the contract.",
      risk_level: "low",
      risk_explanation: "Standard mutual termination.",
      negotiation_suggestion: null,
      is_unusual: false,
      unusual_explanation: null,
      jurisdiction_note: null,
      citations: [],
    },
    {
      clause_text: "This agreement is governed by the laws of the Netherlands.",
      category: "governing_law",
      title: "Governing Law",
      plain_english: "Dutch law applies.",
      risk_level: "informational",
      risk_explanation: "Standard choice of law.",
      negotiation_suggestion: null,
      is_unusual: false,
      unusual_explanation: null,
      jurisdiction_note: null,
      citations: [],
    },
  ],
};

describe("buildChatContext", () => {
  it("always includes overview and summary", () => {
    const ctx = buildChatContext("random question", mockAnalysis);
    expect(ctx.overview).toEqual(mockAnalysis.overview);
    expect(ctx.summary).toEqual(mockAnalysis.summary);
  });

  it("returns relevant clauses matching keywords in question", () => {
    const ctx = buildChatContext("Is the non-compete enforceable?", mockAnalysis);
    const titles = ctx.relevantClauses.map((c) => c.title);
    expect(titles).toContain("Non-Compete Restriction");
  });

  it("returns at most 5 clauses", () => {
    const ctx = buildChatContext("tell me everything", mockAnalysis);
    expect(ctx.relevantClauses.length).toBeLessThanOrEqual(5);
  });

  it("matches on category keywords", () => {
    const ctx = buildChatContext("What about payment?", mockAnalysis);
    const titles = ctx.relevantClauses.map((c) => c.title);
    expect(titles).toContain("Payment Terms");
  });

  it("returns all clauses when fewer than 5 total", () => {
    const ctx = buildChatContext("summarize", mockAnalysis);
    expect(ctx.relevantClauses.length).toBe(4);
  });
});
