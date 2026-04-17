/**
 * Tests for party-name dictionary replacement. Variant spellings,
 * possessives, and defined-term handling (SP-1.9 labeled shape).
 */
import { describe, it, expect } from "vitest";
import { findPartyMatches, replaceParties } from "./parties";

describe("findPartyMatches", () => {
  it("finds exact matches case-insensitively", () => {
    const text = "ACME Corp shall pay; ACME corp invoices monthly.";
    const ms = findPartyMatches(text, [{ name: "ACME Corp", label: "PARTY_A" }]);
    expect(ms).toHaveLength(2);
  });

  it("matches possessives (straight apostrophe)", () => {
    const text = "Acme's obligations under this Agreement.";
    const ms = findPartyMatches(text, [{ name: "Acme", label: "PARTY_A" }]);
    expect(ms).toHaveLength(1);
    expect(ms[0].text).toMatch(/Acme'?s?/);
    expect(ms[0].suffix).toBe("'s");
  });

  it("matches possessives (curly U+2019 apostrophe from PDF/DOCX)", () => {
    const text = "Acme\u2019s obligations under this Agreement.";
    const ms = findPartyMatches(text, [{ name: "Acme", label: "PARTY_A" }]);
    expect(ms).toHaveLength(1);
    expect(ms[0].suffix).toBe("\u2019s");
  });

  it("matches multi-word company names", () => {
    const text = "Heinrichs & Koll Beratung GmbH agrees that Heinrichs & Koll will deliver";
    const ms = findPartyMatches(text, [{ name: "Heinrichs & Koll Beratung GmbH", label: "PARTY_A" }]);
    expect(ms.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores empty / whitespace party entries", () => {
    expect(findPartyMatches("anything", [{ name: "", label: "PARTY_A" }, { name: "   ", label: "PARTY_B" }])).toEqual([]);
  });

  it("deduplicates duplicate party entries at the same span", () => {
    // Pass 0 may emit the same party twice; each span should only
    // produce one match to avoid splice corruption downstream.
    const ms = findPartyMatches("ACME is here", [
      { name: "ACME", label: "PARTY_A" },
      { name: "ACME", label: "PARTY_B" },
    ]);
    expect(ms).toHaveLength(1);
  });

  it("keeps the longer party match when a shorter name is a prefix", () => {
    // "ACME" appears inside "ACME Corp" — the longer name wins at the
    // shared span; no match is issued for the shorter name alone.
    const ms = findPartyMatches("ACME Corp pays", [
      { name: "ACME", label: "PARTY_A" },
      { name: "ACME Corp", label: "PARTY_B" },
    ]);
    expect(ms).toHaveLength(1);
    expect(ms[0].text).toBe("ACME Corp");
  });
});

describe("replaceParties", () => {
  it("replaces with role labels in order", () => {
    const text = "ACME Corp engages BetaCo. ACME Corp shall notify BetaCo.";
    const { scrubbed, partyMap } = replaceParties(text, [
      { name: "ACME Corp", label: "PARTY_A" },
      { name: "BetaCo", label: "PARTY_B" },
    ]);
    expect(scrubbed).toBe(
      "\u27E6PARTY_A\u27E7 engages \u27E6PARTY_B\u27E7. \u27E6PARTY_A\u27E7 shall notify \u27E6PARTY_B\u27E7.",
    );
    expect(partyMap.get("\u27E6PARTY_A\u27E7")).toBe("ACME Corp");
    expect(partyMap.get("\u27E6PARTY_B\u27E7")).toBe("BetaCo");
  });

  it("replaces possessives preserving the apostrophe-s outside the token", () => {
    const text = "ACME Corp's obligations are several.";
    const { scrubbed } = replaceParties(text, [{ name: "ACME Corp", label: "PARTY_A" }]);
    expect(scrubbed).toBe("\u27E6PARTY_A\u27E7's obligations are several.");
  });

  it("preserves curly apostrophe variant on round-trip", () => {
    const text = "Acme\u2019s obligations.";
    const { scrubbed } = replaceParties(text, [{ name: "Acme", label: "PARTY_A" }]);
    expect(scrubbed).toBe("\u27E6PARTY_A\u27E7\u2019s obligations.");
  });

  it("returns an identity result when parties list is empty", () => {
    const text = "no parties to replace.";
    const { scrubbed, partyMap } = replaceParties(text, []);
    expect(scrubbed).toBe(text);
    expect(partyMap.size).toBe(0);
  });
});

describe("replaceParties — semantic labels", () => {
  it("emits the supplied label token", () => {
    const { scrubbed, partyMap } = replaceParties(
      "ACME Corp agrees to pay Beta LLC.",
      [
        { name: "ACME Corp", label: "PROVIDER" },
        { name: "Beta LLC", label: "CLIENT" },
      ],
    );
    expect(scrubbed).toContain("\u27E6PROVIDER\u27E7");
    expect(scrubbed).toContain("\u27E6CLIENT\u27E7");
    expect(scrubbed).not.toContain("ACME Corp");
    expect(scrubbed).not.toContain("Beta LLC");
    expect(partyMap.get("\u27E6PROVIDER\u27E7")).toBe("ACME Corp");
    expect(partyMap.get("\u27E6CLIENT\u27E7")).toBe("Beta LLC");
  });

  it("supports more than 8 parties (no positional cap)", () => {
    const parties = Array.from({ length: 10 }, (_, i) => ({
      name: `Party${i}`,
      label: `ROLE_${i}`,
    }));
    const text = parties.map((p) => p.name).join(" and ");
    const { scrubbed, partyMap } = replaceParties(text, parties);
    for (let i = 0; i < 10; i++) {
      expect(scrubbed).toContain(`\u27E6ROLE_${i}\u27E7`);
    }
    expect(partyMap.size).toBe(10);
  });

  it("skips entries with empty label", () => {
    const { scrubbed, partyMap } = replaceParties(
      "ACME Corp signed.",
      [{ name: "ACME Corp", label: "" }],
    );
    expect(scrubbed).toBe("ACME Corp signed.");
    expect(partyMap.size).toBe(0);
  });

  it("skips entries with zero textual occurrences", () => {
    const { partyMap } = replaceParties("ACME Corp signed.", [
      { name: "ACME Corp", label: "PROVIDER" },
      { name: "Never Mentioned Inc", label: "CLIENT" },
    ]);
    expect(partyMap.has("\u27E6PROVIDER\u27E7")).toBe(true);
    expect(partyMap.has("\u27E6CLIENT\u27E7")).toBe(false);
  });
});
