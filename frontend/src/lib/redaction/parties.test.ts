/**
 * Tests for party-name dictionary replacement. Variant spellings,
 * possessives, and defined-term handling.
 */
import { describe, it, expect } from "vitest";
import { findPartyMatches, replaceParties } from "./parties";

describe("findPartyMatches", () => {
  it("finds exact matches case-insensitively", () => {
    const text = "ACME Corp shall pay; ACME corp invoices monthly.";
    const ms = findPartyMatches(text, ["ACME Corp"]);
    expect(ms).toHaveLength(2);
  });

  it("matches possessives", () => {
    const text = "Acme's obligations under this Agreement.";
    const ms = findPartyMatches(text, ["Acme"]);
    expect(ms).toHaveLength(1);
    expect(ms[0].text).toMatch(/Acme'?s?/);
  });

  it("matches multi-word company names", () => {
    const text = "Heinrichs & Koll Beratung GmbH agrees that Heinrichs & Koll will deliver";
    const ms = findPartyMatches(text, ["Heinrichs & Koll Beratung GmbH"]);
    expect(ms.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores empty / whitespace party entries", () => {
    expect(findPartyMatches("anything", ["", "   "])).toEqual([]);
  });
});

describe("replaceParties", () => {
  it("replaces with role labels in order", () => {
    const text = "ACME Corp engages BetaCo. ACME Corp shall notify BetaCo.";
    const { scrubbed, partyMap } = replaceParties(text, ["ACME Corp", "BetaCo"]);
    expect(scrubbed).toBe("[PARTY_A] engages [PARTY_B]. [PARTY_A] shall notify [PARTY_B].");
    expect(partyMap.get("[PARTY_A]")).toBe("ACME Corp");
    expect(partyMap.get("[PARTY_B]")).toBe("BetaCo");
  });

  it("replaces possessives preserving the apostrophe-s outside the token", () => {
    const text = "ACME Corp's obligations are several.";
    const { scrubbed } = replaceParties(text, ["ACME Corp"]);
    expect(scrubbed).toBe("[PARTY_A]'s obligations are several.");
  });

  it("returns an identity result when parties list is empty", () => {
    const text = "no parties to replace.";
    const { scrubbed, partyMap } = replaceParties(text, []);
    expect(scrubbed).toBe(text);
    expect(partyMap.size).toBe(0);
  });
});
