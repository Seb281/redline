/**
 * Unit tests for the client-side `rehydrateClause` helper.
 *
 * Historically lived in streaming-analyzer.ts; moved to the redaction
 * module in SP-1.6 when the server became a pass-through. Kept here
 * because the fixture coverage (partial tokens, null fields, empty
 * map) is complementary to the basic tests in rehydrate-clause.test.ts.
 */

import { describe, it, expect } from "vitest";
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
      jurisdiction_note: "\u27E6PARTY_A\u27E7 has standing under Dutch law.",
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
    expect(out.jurisdiction_note).toBe(
      "Sofia van Dijk has standing under Dutch law.",
    );
    expect(out.citations?.[0].quoted_text).toBe("Sofia van Dijk shall serve");
  });

  it("leaves nullable fields null when they were null", () => {
    const clause = scrubbedClause();
    clause.negotiation_suggestion = null;
    clause.unusual_explanation = null;
    clause.jurisdiction_note = null;
    const out = rehydrateClause(clause, buildMap());
    expect(out.negotiation_suggestion).toBeNull();
    expect(out.unusual_explanation).toBeNull();
    expect(out.jurisdiction_note).toBeNull();
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
