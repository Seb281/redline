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

  it("matches possessives (straight apostrophe)", () => {
    const text = "Acme's obligations under this Agreement.";
    const ms = findPartyMatches(text, ["Acme"]);
    expect(ms).toHaveLength(1);
    expect(ms[0].text).toMatch(/Acme'?s?/);
    expect(ms[0].suffix).toBe("'s");
  });

  it("matches possessives (curly U+2019 apostrophe from PDF/DOCX)", () => {
    const text = "Acme\u2019s obligations under this Agreement.";
    const ms = findPartyMatches(text, ["Acme"]);
    expect(ms).toHaveLength(1);
    expect(ms[0].suffix).toBe("\u2019s");
  });

  it("matches multi-word company names", () => {
    const text = "Heinrichs & Koll Beratung GmbH agrees that Heinrichs & Koll will deliver";
    const ms = findPartyMatches(text, ["Heinrichs & Koll Beratung GmbH"]);
    expect(ms.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores empty / whitespace party entries", () => {
    expect(findPartyMatches("anything", ["", "   "])).toEqual([]);
  });

  it("deduplicates duplicate party entries at the same span", () => {
    // Pass 0 may emit the same party twice; each span should only
    // produce one match to avoid splice corruption downstream.
    const ms = findPartyMatches("ACME is here", ["ACME", "ACME"]);
    expect(ms).toHaveLength(1);
  });

  it("keeps the longer party match when a shorter name is a prefix", () => {
    // "ACME" appears inside "ACME Corp" — the longer name wins at the
    // shared span; no match is issued for the shorter name alone.
    const ms = findPartyMatches("ACME Corp pays", ["ACME", "ACME Corp"]);
    expect(ms).toHaveLength(1);
    expect(ms[0].text).toBe("ACME Corp");
  });
});

describe("replaceParties", () => {
  it("replaces with role labels in order", () => {
    const text = "ACME Corp engages BetaCo. ACME Corp shall notify BetaCo.";
    const { scrubbed, partyMap } = replaceParties(text, ["ACME Corp", "BetaCo"]);
    expect(scrubbed).toBe(
      "\u27E6PARTY_A\u27E7 engages \u27E6PARTY_B\u27E7. \u27E6PARTY_A\u27E7 shall notify \u27E6PARTY_B\u27E7.",
    );
    expect(partyMap.get("\u27E6PARTY_A\u27E7")).toBe("ACME Corp");
    expect(partyMap.get("\u27E6PARTY_B\u27E7")).toBe("BetaCo");
  });

  it("replaces possessives preserving the apostrophe-s outside the token", () => {
    const text = "ACME Corp's obligations are several.";
    const { scrubbed } = replaceParties(text, ["ACME Corp"]);
    expect(scrubbed).toBe("\u27E6PARTY_A\u27E7's obligations are several.");
  });

  it("preserves curly apostrophe variant on round-trip", () => {
    const text = "Acme\u2019s obligations.";
    const { scrubbed } = replaceParties(text, ["Acme"]);
    expect(scrubbed).toBe("\u27E6PARTY_A\u27E7\u2019s obligations.");
  });

  it("returns an identity result when parties list is empty", () => {
    const text = "no parties to replace.";
    const { scrubbed, partyMap } = replaceParties(text, []);
    expect(scrubbed).toBe(text);
    expect(partyMap.size).toBe(0);
  });

  it("handles 9+ parties by leaving the overflow unredacted (documented leak)", () => {
    // PARTY_LABELS caps at A–H (8). This is an acknowledged-scope leak
    // — assert the overflow party stays visible rather than silently
    // mangling anything, so callers can surface it if needed.
    const parties = [
      "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "NINTH",
    ];
    const text = "P1 meets NINTH at noon.";
    const { scrubbed } = replaceParties(text, parties);
    expect(scrubbed).toContain("\u27E6PARTY_A\u27E7");
    expect(scrubbed).toContain("NINTH");
  });
});
