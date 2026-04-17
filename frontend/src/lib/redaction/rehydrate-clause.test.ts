/**
 * Client-side rehydration of a streamed clause object. Lifted out of
 * `streaming-analyzer.ts` in SP-1.6 so the server no longer touches
 * tokenMap — rehydration is now a pure client concern.
 */
import { describe, it, expect } from "vitest";
import { rehydrateClause } from "./rehydrate-clause";
import type { AnalyzedClause } from "@/types";

describe("rehydrateClause", () => {
  it("substitutes tokens across all user-facing string fields", () => {
    const tokenMap = new Map<string, string>([
      ["\u27E6PARTY_A\u27E7", "ACME Corp"],
      ["\u27E6EMAIL_1\u27E7", "dpo@acme.eu"],
    ]);
    const clause: AnalyzedClause = {
      clause_text: "\u27E6PARTY_A\u27E7 notifies at \u27E6EMAIL_1\u27E7.",
      category: "other",
      title: "Notice to \u27E6PARTY_A\u27E7",
      plain_english: "\u27E6PARTY_A\u27E7 must be told.",
      risk_level: "low",
      risk_explanation: "Routine notice.",
      negotiation_suggestion: null,
      is_unusual: false,
      unusual_explanation: null,
      jurisdiction_note: null,
    };
    const out = rehydrateClause(clause, tokenMap);
    expect(out.clause_text).toBe("ACME Corp notifies at dpo@acme.eu.");
    expect(out.title).toBe("Notice to ACME Corp");
    expect(out.plain_english).toBe("ACME Corp must be told.");
  });

  it("leaves unknown tokens verbatim (defensive)", () => {
    const tokenMap = new Map<string, string>();
    const clause = {
      clause_text: "\u27E6PARTY_Z\u27E7 is rogue.",
      category: "other",
      title: "",
      plain_english: "",
      risk_level: "low",
      risk_explanation: "",
      negotiation_suggestion: null,
      is_unusual: false,
      unusual_explanation: null,
      jurisdiction_note: null,
    } as AnalyzedClause;
    const out = rehydrateClause(clause, tokenMap);
    expect(out.clause_text).toBe("\u27E6PARTY_Z\u27E7 is rogue.");
  });

  it("rehydrates citation quoted_text when present", () => {
    const tokenMap = new Map<string, string>([
      ["\u27E6PARTY_A\u27E7", "ACME Corp"],
    ]);
    const clause = {
      clause_text: "\u27E6PARTY_A\u27E7 terminates.",
      category: "termination",
      title: "T",
      plain_english: "p",
      risk_level: "low",
      risk_explanation: "r",
      negotiation_suggestion: null,
      is_unusual: false,
      unusual_explanation: null,
      jurisdiction_note: null,
      citations: [
        { quoted_text: "\u27E6PARTY_A\u27E7 may end contract.", section_ref: "§3" },
      ],
    } as AnalyzedClause;
    const out = rehydrateClause(clause, tokenMap);
    expect(out.citations?.[0].quoted_text).toBe("ACME Corp may end contract.");
  });

  it("preserves null optional fields as null (no rehydrate call)", () => {
    const tokenMap = new Map<string, string>([
      ["\u27E6PARTY_A\u27E7", "ACME Corp"],
    ]);
    const clause: AnalyzedClause = {
      clause_text: "\u27E6PARTY_A\u27E7 text.",
      category: "other",
      title: "t",
      plain_english: "p",
      risk_level: "low",
      risk_explanation: "r",
      negotiation_suggestion: null,
      is_unusual: false,
      unusual_explanation: null,
      jurisdiction_note: null,
    };
    const out = rehydrateClause(clause, tokenMap);
    expect(out.negotiation_suggestion).toBeNull();
    expect(out.unusual_explanation).toBeNull();
    expect(out.jurisdiction_note).toBeNull();
  });
});
