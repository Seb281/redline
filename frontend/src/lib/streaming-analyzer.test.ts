/**
 * Unit tests for the client-side `rehydrateClause` helper.
 *
 * Historically lived in streaming-analyzer.ts; moved to the redaction
 * module in SP-1.6 when the server became a pass-through. Kept here
 * because the fixture coverage (partial tokens, null fields, empty
 * map) is complementary to the basic tests in rehydrate-clause.test.ts.
 */

import { describe, it, expect, vi } from "vitest";
import { rehydrateClause } from "./redaction/rehydrate-clause";
import type { AnalyzedClause } from "@/types";

describe("rehydrateClause", () => {
  /** Build a tokenMap that maps `⟦PARTY_A⟧` and `⟦PARTY_B⟧` to real names. */
  function buildMap() {
    const map = new Map<string, string>();
    map.set("\u27E6PARTY_A\u27E7", "Sofia van Dijk");
    map.set("\u27E6PARTY_B\u27E7", "Luminar B.V.");
    return map;
  }

  /** Minimal scrubbed clause with tokens in every rehydratable field. */
  function scrubbedClause(): AnalyzedClause {
    return {
      clause_text: "\u27E6PARTY_A\u27E7 shall serve \u27E6PARTY_B\u27E7.",
      category: "termination",
      title: "Obligations of \u27E6PARTY_A\u27E7",
      plain_english: "\u27E6PARTY_A\u27E7 must perform.",
      risk_level: "low",
      risk_explanation: "Standard for \u27E6PARTY_B\u27E7.",
      negotiation_suggestion: "Ask \u27E6PARTY_B\u27E7 to soften scope.",
      is_unusual: false,
      unusual_explanation: null,
      applicable_law: {
        observation: "\u27E6PARTY_A\u27E7 has standing under Dutch law.",
        source_type: "general_principle",
        citations: [],
      },
      citations: [
        { id: 1, quoted_text: "\u27E6PARTY_A\u27E7 shall serve" },
      ],
    };
  }

  it("rehydrates every user-facing string field", () => {
    const out = rehydrateClause(scrubbedClause(), buildMap());
    expect(out.clause_text).toBe("Sofia van Dijk shall serve Luminar B.V..");
    expect(out.title).toBe("Obligations of Sofia van Dijk");
    expect(out.plain_english).toBe("Sofia van Dijk must perform.");
    expect(out.risk_explanation).toBe("Standard for Luminar B.V..");
    expect(out.negotiation_suggestion).toBe(
      "Ask Luminar B.V. to soften scope.",
    );
    // applicable_law.observation rehydration is covered in Task 7's
    // rehydrate-clause.test.ts; this suite focuses on legacy rehydrated
    // fields (clause_text, title, plain_english, explanations, citations).
    expect(out.citations?.[0].quoted_text).toBe("Sofia van Dijk shall serve");
  });

  it("leaves nullable fields null when they were null", () => {
    const clause = scrubbedClause();
    clause.negotiation_suggestion = null;
    clause.unusual_explanation = null;
    clause.applicable_law = null;
    const out = rehydrateClause(clause, buildMap());
    expect(out.negotiation_suggestion).toBeNull();
    expect(out.unusual_explanation).toBeNull();
    expect(out.applicable_law).toBeNull();
  });

  it("is a no-op when tokenMap is empty", () => {
    const clause = scrubbedClause();
    const out = rehydrateClause(clause, new Map());
    // Every field should stay exactly as scrubbed — tokens preserved
    // because there's no mapping to rehydrate from.
    expect(out.clause_text).toBe(clause.clause_text);
    expect(out.title).toBe(clause.title);
  });

  it("does not choke on partial/unknown tokens in a field", () => {
    // A streamed chunk boundary that splits a token leaves `⟦PARTY_` in
    // place without a closing bracket — rehydrate must leave it as-is
    // rather than crashing.
    const clause = scrubbedClause();
    clause.plain_english = "Prefix \u27E6PARTY_";
    const out = rehydrateClause(clause, buildMap());
    expect(out.plain_english).toBe("Prefix \u27E6PARTY_");
  });
});

describe("generateOverview calls reconcileJurisdiction (SP-1.7)", () => {
  it("downgrades a mismatched Pass 0 result to unknown", async () => {
    // Mock generateObject to return a mismatched pair (stated source_type
    // but null governing_jurisdiction). reconcileJurisdiction must
    // downgrade source_type to "unknown" before the overview flows to
    // Pass 2 so the prompt dispatch never sees an inconsistent pair.
    vi.resetModules();
    vi.doMock("ai", async (orig) => {
      const actual = (await orig()) as typeof import("ai");
      return {
        ...actual,
        generateObject: vi.fn().mockResolvedValue({
          object: {
            contract_type: "NDA",
            parties: [],
            effective_date: null,
            duration: null,
            total_value: null,
            governing_jurisdiction: null,
            jurisdiction_evidence: {
              source_type: "stated",
              source_text: "§14 but we forgot the country",
            },
            key_terms: [],
            clause_inventory: [],
          },
        }),
      };
    });
    const { generateOverview } = await import("./streaming-analyzer");
    const out = await generateOverview("contract text", {
      name: "mistral",
      model: () => ({}) as never,
      snapshot: () => "test",
      region: "test",
    });
    expect(out.jurisdiction_evidence?.source_type).toBe("unknown");
    expect(out.governing_jurisdiction).toBeNull();
    vi.doUnmock("ai");
  });
});
