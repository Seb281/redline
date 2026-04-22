/**
 * SP-10 Arc 1 Phase 3 — chat-context tests.
 *
 * `buildChatContext` is now async + hybrid-backed (BM25 + cosine via
 * RRF). Three scenarios matter:
 *
 *   1. Lexical — exact-keyword overlap. Must keep working because the
 *      BM25 branch carries it even if the semantic branch is disabled.
 *   2. Semantic — paraphrase / synonym that BM25 alone would miss.
 *      Requires `clause_embeddings` on the analysis and a mocked
 *      `embed` for the query side.
 *   3. Cross-lingual — question in language A, clauses in language B.
 *      Covers the Layer-B' localisation case where a user asks in
 *      English about a French-language clause.
 *
 * We mock the Mistral SDK at the module level so the tests run fully
 * offline and remain deterministic. The `embedMany` / `embed` fakes
 * return hand-crafted 1024-dim vectors aligned with the fixture
 * clauses so the cosine branch ranks them as the test expects.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { STATUTE_LABELS } from "@/lib/applicable-law";
import type {
  AnalyzeResponse,
  AnalyzedClause,
  ClauseEmbedding,
} from "@/types";
import { MISTRAL_EMBED_DIM } from "@/types";

// -- Module mocks ----------------------------------------------------------

// Registry of {trigger token → target embedding}. Query-side `embed`
// reads from this; tests override per-case before calling the system.
const queryEmbeddingByTrigger = new Map<string, number[]>();

vi.mock("@ai-sdk/mistral", () => ({
  mistral: {
    embedding: (_id: string) => ({ __embedModel: _id }),
  },
}));

vi.mock("ai", async (orig) => {
  const actual = await orig<typeof import("ai")>();
  return {
    ...actual,
    embed: async ({ value }: { value: string }) => {
      for (const [trigger, vec] of queryEmbeddingByTrigger) {
        if (value.toLowerCase().includes(trigger)) {
          return { embedding: vec, value, usage: { tokens: 0 } };
        }
      }
      return { embedding: zeroVec(), value, usage: { tokens: 0 } };
    },
  };
});

// -- Helpers ---------------------------------------------------------------

function zeroVec(): number[] {
  return new Array(MISTRAL_EMBED_DIM).fill(0);
}

/** Place a 1 at index `k`; used to tag a clause with a unique direction. */
function basisVec(k: number): number[] {
  const v = zeroVec();
  v[k % MISTRAL_EMBED_DIM] = 1;
  return v;
}

// Import after mocks so the module picks up our stubs.
import { buildChatContext } from "./chat-context";
import { formatClauseContext } from "@/app/api/chat/route";

// -- Fixture -----------------------------------------------------------------

const baseClauses: AnalyzedClause[] = [
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
    applicable_law: {
      observation: "Likely unenforceable under Dutch law.",
      source_type: "statute_cited",
      citations: [{ code: "NL_BW_7_653" }],
    },
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
    applicable_law: null,
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
    applicable_law: null,
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
    applicable_law: null,
    citations: [],
  },
  {
    clause_text: "Le salaire mensuel est de 5 000 EUR brut.",
    category: "payment_terms",
    title: "Rémunération",
    plain_english: "Le salaire est de 5 000 € par mois.",
    risk_level: "informational",
    risk_explanation: "Standard.",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    applicable_law: null,
    citations: [],
  },
  {
    clause_text: "Confidential information must be kept secret for 5 years.",
    category: "confidentiality",
    title: "Confidentiality",
    plain_english: "Keep confidential info secret for 5 years.",
    risk_level: "low",
    risk_explanation: "Standard NDA term.",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    applicable_law: null,
    citations: [],
  },
];

const baseAnalysis: AnalyzeResponse = {
  overview: {
    contract_type: "Service Agreement",
    parties: [
      { name: "Alice Corp", role_label: null },
      { name: "Bob LLC", role_label: null },
    ],
    effective_date: "2025-01-01",
    duration: "12 months",
    total_value: null,
    governing_jurisdiction: "the Netherlands",
    jurisdiction_evidence: null,
    key_terms: ["Monthly payment of €5,000"],
    clause_inventory: [],
  },
  summary: {
    total_clauses: baseClauses.length,
    risk_breakdown: { high: 1, medium: 1, low: 2, informational: 2 },
    top_risks: ["Non-compete is overly broad"],
  },
  clauses: baseClauses,
  provenance: {
    provider: "test",
    model: "test",
    snapshot: "test",
    region: "test",
    reasoning_effort_per_pass: {
      overview: "low",
      extraction: "medium",
      risk: "high",
      think_hard: "high",
    },
    prompt_template_version: "1.1",
    timestamp: "2026-04-22T00:00:00.000Z",
  },
};

// Per-clause embeddings. Each clause gets a unique basis-vector
// direction so the mocked query embed can target it precisely.
const DIR_NON_COMPETE = 0;
const DIR_PAYMENT = 1;
const DIR_TERMINATION = 2;
const DIR_GOVERNING = 3;
const DIR_REMUNERATION = 4;
const DIR_CONFIDENTIALITY = 5;

const baseEmbeddings: ClauseEmbedding[] = [
  { clause_index: 0, embedding: basisVec(DIR_NON_COMPETE) },
  { clause_index: 1, embedding: basisVec(DIR_PAYMENT) },
  { clause_index: 2, embedding: basisVec(DIR_TERMINATION) },
  { clause_index: 3, embedding: basisVec(DIR_GOVERNING) },
  { clause_index: 4, embedding: basisVec(DIR_REMUNERATION) },
  { clause_index: 5, embedding: basisVec(DIR_CONFIDENTIALITY) },
];

// -- Tests -----------------------------------------------------------------

describe("buildChatContext (hybrid)", () => {
  beforeEach(() => {
    queryEmbeddingByTrigger.clear();
  });

  it("always includes overview and summary", async () => {
    const ctx = await buildChatContext("random question", baseAnalysis);
    expect(ctx.overview).toEqual(baseAnalysis.overview);
    expect(ctx.summary).toEqual(baseAnalysis.summary);
  });

  it("returns at most 5 clauses when there are more than 5", async () => {
    const ctx = await buildChatContext("tell me everything", baseAnalysis);
    expect(ctx.relevantClauses.length).toBeLessThanOrEqual(5);
  });

  it("returns all clauses when fewer than 5 total (short-circuit)", async () => {
    const short = {
      ...baseAnalysis,
      clauses: baseClauses.slice(0, 4),
      clause_embeddings: baseEmbeddings.slice(0, 4),
    };
    const ctx = await buildChatContext("summarize", short);
    expect(ctx.relevantClauses).toHaveLength(4);
  });

  it("lexical scenario: keyword in question ranks the matching clause first", async () => {
    // No embeddings → hybrid degrades to BM25-only.
    const ctx = await buildChatContext(
      "Is the non-compete enforceable?",
      baseAnalysis,
    );
    expect(ctx.relevantClauses[0].title).toBe("Non-Compete Restriction");
  });

  it("lexical scenario: category keyword matches the corresponding clause", async () => {
    const ctx = await buildChatContext("What about termination?", baseAnalysis);
    const titles = ctx.relevantClauses.map((c) => c.title);
    expect(titles).toContain("Termination Notice");
  });

  it("semantic scenario: paraphrase pulls a clause BM25 cannot match", async () => {
    // Question says "salary" — the English clauses don't use that word.
    // Clause 4 ("Rémunération") is French; its embedding direction is
    // DIR_REMUNERATION. Map the query to the same direction so the
    // vector branch surfaces it even though BM25 scores are all zero.
    queryEmbeddingByTrigger.set("salary", basisVec(DIR_REMUNERATION));

    const analysis: AnalyzeResponse = {
      ...baseAnalysis,
      clause_embeddings: baseEmbeddings,
    };
    const ctx = await buildChatContext("How is salary calculated?", analysis);
    const titles = ctx.relevantClauses.map((c) => c.title);
    expect(titles).toContain("Rémunération");
  });

  it("cross-lingual scenario: English question surfaces French clause via vector branch", async () => {
    // User asks in English about confidentiality. Clause 5 is in English,
    // but add a twist: make the clause embedding align with the query
    // vector while BM25 lexical match is weak (query uses a synonym).
    queryEmbeddingByTrigger.set(
      "non-disclosure",
      basisVec(DIR_CONFIDENTIALITY),
    );

    const analysis: AnalyzeResponse = {
      ...baseAnalysis,
      clause_embeddings: baseEmbeddings,
    };
    const ctx = await buildChatContext(
      "What does the non-disclosure covenant require?",
      analysis,
    );
    const titles = ctx.relevantClauses.map((c) => c.title);
    expect(titles).toContain("Confidentiality");
  });

  it("falls back to BM25-only on saved analyses with no embeddings", async () => {
    // No clause_embeddings on the analysis → no query embed attempted.
    // Lexical result must still surface.
    const ctx = await buildChatContext("non-compete", baseAnalysis);
    expect(ctx.relevantClauses[0].title).toBe("Non-Compete Restriction");
  });
});

describe("formatClauseContext (SP-1.7)", () => {
  const baseClause: AnalyzedClause = {
    clause_text: "t",
    category: "other",
    title: "Sample",
    plain_english: "p",
    risk_level: "low",
    risk_explanation: "r",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    applicable_law: null,
  };

  it("formats applicable_law with label from STATUTE_LABELS", () => {
    const out = formatClauseContext({
      ...baseClause,
      applicable_law: {
        observation: "Void under German law",
        source_type: "statute_cited",
        citations: [{ code: "DE_BGB_276" }],
      },
    });
    expect(out).toContain("Applicable law: Void under German law");
    expect(out).toContain(STATUTE_LABELS.DE_BGB_276);
  });

  it("formats applicable_law general_principle with no citation parenthetical", () => {
    const out = formatClauseContext({
      ...baseClause,
      applicable_law: {
        observation: "General EU principle",
        source_type: "general_principle",
        citations: [],
      },
    });
    expect(out).toContain("Applicable law: General EU principle");
    expect(out).not.toMatch(/Applicable law: [^\n]*\(/);
  });

  it("omits Applicable law line when applicable_law is null", () => {
    const out = formatClauseContext(baseClause);
    expect(out).not.toContain("Applicable law:");
  });
});
