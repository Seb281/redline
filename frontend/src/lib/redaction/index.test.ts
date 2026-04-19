/**
 * End-to-end redaction tests. Most importantly: the round-trip property —
 * `rehydrate(redact(text, parties).scrubbed, tokenMap) === text` for any
 * input. If this breaks, the user sees garbled clause text on display.
 *
 * SP-1.9: parties is now `LabeledParty[]` — every call site uses the new shape.
 */
import { describe, it, expect } from "vitest";
import {
  redact,
  redactPatterns,
  redactParties,
  rebuildScrubbed,
  rehydrate,
} from "./index";
import type { LabeledParty } from "./parties";

describe("redact + rehydrate round-trip", () => {
  it("preserves text when nothing matches", () => {
    const text = "A contract with no PII to scrub.";
    const { scrubbed, tokenMap } = redact(text, []);
    expect(scrubbed).toBe(text);
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
  });

  it("round-trips emails", () => {
    const text = "Contact dpo@example.eu for inquiries.";
    const { scrubbed, tokenMap } = redact(text, []);
    expect(scrubbed).not.toContain("dpo@example.eu");
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
  });

  it("round-trips party names + emails together", () => {
    const text = "ACME Corp's DPO is dpo@acme.de. ACME Corp answers within 5 days.";
    const { scrubbed, tokenMap } = redact(text, [{ name: "ACME Corp", label: "PARTY_A" }]);
    expect(scrubbed).not.toContain("ACME Corp");
    expect(scrubbed).not.toContain("dpo@acme.de");
    expect(scrubbed).toContain("\u27E6PARTY_A\u27E7");
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
  });

  it("round-trips IBAN", () => {
    const text = "Pay to NL91 ABNA 0417 1643 00 within 30 days.";
    const { scrubbed, tokenMap } = redact(text, []);
    expect(scrubbed).toContain("\u27E6IBAN_1\u27E7");
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
  });

  it("round-trips curly-apostrophe possessives (PDF/DOCX text)", () => {
    const text = "Acme\u2019s obligations are several.";
    const { scrubbed, tokenMap } = redact(text, [{ name: "Acme", label: "PARTY_A" }]);
    expect(scrubbed).toBe("\u27E6PARTY_A\u27E7\u2019s obligations are several.");
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
  });

  it("round-trips when contract already contains a bracket-shaped placeholder", () => {
    // ASCII `[EMAIL_1]` literal in a template exhibit must NOT be mistaken
    // for a token during rehydrate. The `⟦⟧` delimiter choice defends
    // against this class of collision.
    const text = "Boilerplate: [EMAIL_1] is a placeholder. Contact x@y.com.";
    const { scrubbed, tokenMap } = redact(text, []);
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
  });

  it("deduplicates overlapping party entries without corrupting spans", () => {
    // Pass 0 can emit duplicate or overlapping party names; the redactor
    // must not splice-corrupt the same span twice.
    const text = "ACME and ACME again.";
    const { scrubbed, tokenMap } = redact(text, [
      { name: "ACME", label: "PARTY_A" },
      { name: "ACME", label: "PARTY_A" },
    ]);
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
    expect(scrubbed).not.toMatch(/PART[^\u27E6]*\u27E7[A-Z]/);
  });
});

describe("redactPatterns — pre-Pass-0 phase (SP-1.6)", () => {
  it("masks emails, phones, IBANs — leaves prose untouched", () => {
    const text =
      "Contact dpo@example.eu. Pay to NL91 ABNA 0417 1643 00. Call +31 20 123 4567.";
    const { scrubbed, tokenMap } = redactPatterns(text);
    expect(scrubbed).not.toContain("dpo@example.eu");
    expect(scrubbed).not.toContain("NL91 ABNA 0417 1643 00");
    expect(scrubbed).not.toContain("+31 20 123 4567");
    expect(tokenMap.size).toBeGreaterThanOrEqual(3);
    expect(scrubbed).toContain("\u27E6EMAIL_1\u27E7");
    expect(scrubbed).toContain("\u27E6IBAN_1\u27E7");
    expect(scrubbed).toContain("\u27E6PHONE_1\u27E7");
  });

  it("leaves party-like capitalized names untouched (no party phase here)", () => {
    const text = "ACME Corp entered into agreement with Jane Doe.";
    const { scrubbed } = redactPatterns(text);
    expect(scrubbed).toContain("ACME Corp");
    expect(scrubbed).toContain("Jane Doe");
  });

  it("round-trips via rehydrate", () => {
    const text = "Email dpo@example.eu about invoice NL91 ABNA 0417 1643 00.";
    const { scrubbed, tokenMap } = redactPatterns(text);
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
  });
});

describe("redactParties — post-Pass-0 phase (SP-1.6)", () => {
  it("masks only supplied party names; leaves patterns untouched", () => {
    const text = "ACME Corp and Jane Doe agreed. Email jane@acme.eu later.";
    const { scrubbed, tokenMap } = redactParties(text, [
      { name: "ACME Corp", label: "PARTY_A" },
      { name: "Jane Doe", label: "PARTY_B" },
    ]);
    expect(scrubbed).not.toContain("ACME Corp");
    expect(scrubbed).not.toContain("Jane Doe");
    expect(scrubbed).toContain("\u27E6PARTY_A\u27E7");
    expect(scrubbed).toContain("\u27E6PARTY_B\u27E7");
    expect(scrubbed).toContain("jane@acme.eu");
    expect(tokenMap.size).toBe(2);
  });

  it("works on already-patterns-masked text without colliding", () => {
    const masked = "ACME Corp pays invoice \u27E6IBAN_1\u27E7 weekly.";
    const { scrubbed } = redactParties(masked, [{ name: "ACME Corp", label: "PARTY_A" }]);
    expect(scrubbed).toContain("\u27E6PARTY_A\u27E7");
    expect(scrubbed).toContain("\u27E6IBAN_1\u27E7");
  });
});

describe("rebuildScrubbed — selective redaction (SP-1.9 three-arg signature)", () => {
  it("redacts every token when activeTokens contains all", () => {
    const raw = "ACME Corp, email dpo@acme.eu, IBAN NL91 ABNA 0417 1643 00.";
    const { tokenMap } = redact(raw, [{ name: "ACME Corp", label: "PARTY_A" }]);
    const out = rebuildScrubbed(raw, tokenMap, tokenMap);
    expect(out).toContain("\u27E6PARTY_A\u27E7");
    expect(out).toContain("\u27E6EMAIL_1\u27E7");
    expect(out).toContain("\u27E6IBAN_1\u27E7");
    expect(out).not.toContain("ACME Corp");
    expect(out).not.toContain("dpo@acme.eu");
  });

  it("restores disabled tokens back to their originals", () => {
    const raw = "ACME Corp, email dpo@acme.eu.";
    const { tokenMap } = redact(raw, [{ name: "ACME Corp", label: "PARTY_A" }]);
    const active = new Map<string, string>();
    for (const [k, v] of tokenMap) {
      if (k.startsWith("\u27E6PARTY_")) active.set(k, v);
    }
    const out = rebuildScrubbed(raw, tokenMap, active);
    expect(out).toContain("\u27E6PARTY_A\u27E7");
    expect(out).toContain("dpo@acme.eu");
    expect(out).not.toContain("ACME Corp");
  });

  it("is idempotent on repeated application", () => {
    const raw = "ACME Corp pays dpo@acme.eu.";
    const { tokenMap } = redact(raw, [{ name: "ACME Corp", label: "PARTY_A" }]);
    const once = rebuildScrubbed(raw, tokenMap, tokenMap);
    const twice = rebuildScrubbed(raw, tokenMap, tokenMap);
    expect(once).toBe(twice);
  });
});

describe("replaceParties phantom-entry regression (SP-1.9)", () => {
  it("does not emit tokens for supplied names with zero occurrences", () => {
    // Prior bug: partyMap was seeded from the parties array regardless of
    // whether the name was found in text. UI would render a disabled-state
    // checkbox for a party that appears nowhere. Fix: only seed matched.
    const text = "ACME Corp signed the agreement.";
    const { scrubbed, tokenMap } = redactParties(text, [
      { name: "ACME Corp", label: "PARTY_A" },
      { name: "Not Present Co", label: "PARTY_B" },
    ]);
    expect(tokenMap.has("\u27E6PARTY_A\u27E7")).toBe(true);
    expect(tokenMap.has("\u27E6PARTY_B\u27E7")).toBe(false);
    expect(tokenMap.size).toBe(1);
    expect(scrubbed).toContain("\u27E6PARTY_A\u27E7");
  });
});

describe("redact tokenMap shape", () => {
  it("numbers tokens by occurrence (forward order)", () => {
    const text = "first@a.com plus second@b.com and back to first@a.com again.";
    const { scrubbed, tokenMap } = redact(text, []);
    expect(scrubbed).toContain("\u27E6EMAIL_1\u27E7");
    expect(scrubbed).toContain("\u27E6EMAIL_2\u27E7");
    expect(tokenMap.get("\u27E6EMAIL_1\u27E7")).toBe("first@a.com");
    expect(tokenMap.get("\u27E6EMAIL_2\u27E7")).toBe("second@b.com");
  });

  it("assigns ascending numbers to distinct values in source order", () => {
    // Regression: prior reverse-iteration assigned ⟦EMAIL_1⟧ to the LAST
    // distinct email, reversing user expectations.
    const text = "e0@x.com e1@x.com e2@x.com e3@x.com";
    const { tokenMap } = redact(text, []);
    expect(tokenMap.get("\u27E6EMAIL_1\u27E7")).toBe("e0@x.com");
    expect(tokenMap.get("\u27E6EMAIL_2\u27E7")).toBe("e1@x.com");
    expect(tokenMap.get("\u27E6EMAIL_3\u27E7")).toBe("e2@x.com");
    expect(tokenMap.get("\u27E6EMAIL_4\u27E7")).toBe("e3@x.com");
  });
});

describe("redactParties — labeled shape (SP-1.9)", () => {
  it("emits ⟦LABEL⟧ tokens directly", () => {
    const parties: LabeledParty[] = [
      { name: "ACME Corp", label: "PROVIDER" },
      { name: "Beta LLC", label: "CLIENT" },
    ];
    const { scrubbed, tokenMap } = redactParties(
      "ACME Corp pays Beta LLC.",
      parties,
    );
    expect(scrubbed).toContain("\u27E6PROVIDER\u27E7");
    expect(scrubbed).toContain("\u27E6CLIENT\u27E7");
    expect(tokenMap.get("\u27E6PROVIDER\u27E7")).toBe("ACME Corp");
  });
});

describe("redact — composed with semantic labels", () => {
  it("patterns + labeled parties compose cleanly", () => {
    const { scrubbed, tokenMap } = redact(
      "ACME Corp (contact dpo@example.eu) pays Beta LLC.",
      [
        { name: "ACME Corp", label: "PROVIDER" },
        { name: "Beta LLC", label: "CLIENT" },
      ],
    );
    expect(scrubbed).toContain("\u27E6PROVIDER\u27E7");
    expect(scrubbed).toContain("\u27E6CLIENT\u27E7");
    expect(scrubbed).toContain("\u27E6EMAIL_1\u27E7");
    expect(scrubbed).not.toContain("dpo@example.eu");
    expect(tokenMap.size).toBe(3);
  });
});

describe("redact — SP-3.5 entity layer", () => {
  it("masks unprefixed phone numbers the pattern regex misses", () => {
    // "+44 ..." style is caught by patterns, but a local number like
    // "644805783" slips through — that is exactly what the LLM entity
    // layer exists to cover.
    const text = "Call 644805783 to reach us.";
    const { scrubbed, tokenMap } = redact(text, [], [
      { kind: "PHONE", text: "644805783" },
    ]);
    expect(scrubbed).not.toContain("644805783");
    expect(scrubbed).toContain("\u27E6PHONE_1\u27E7");
    expect(tokenMap.get("\u27E6PHONE_1\u27E7")).toBe("644805783");
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
  });

  it("leaves pattern hits untouched when entities duplicate them", () => {
    // Regex catches "+49 30 12345678" (international prefix). If the
    // LLM also flags it, we keep the pattern token and skip the entity
    // so the token map has exactly one entry for the phone.
    const text = "International: +49 30 12345678 reaches the office.";
    const { scrubbed, tokenMap } = redact(text, [], [
      { kind: "PHONE", text: "+49 30 12345678" },
    ]);
    const phoneTokens = [...tokenMap.keys()].filter((k) => k.startsWith("\u27E6PHONE_"));
    expect(phoneTokens).toHaveLength(1);
    expect(scrubbed).toContain(phoneTokens[0]);
  });

  it("numbers entity tokens after pattern counters for the same kind", () => {
    // Pattern catches the prefixed phone as ⟦PHONE_1⟧. The entity layer
    // must allocate the next free index (⟦PHONE_2⟧) rather than reuse
    // _1 and collide the two values in the token map.
    const text = "Primary +49 30 12345678. Mobile 644805783.";
    const { tokenMap } = redact(text, [], [
      { kind: "PHONE", text: "644805783" },
    ]);
    expect(tokenMap.get("\u27E6PHONE_1\u27E7")).toBe("+49 30 12345678");
    expect(tokenMap.get("\u27E6PHONE_2\u27E7")).toBe("644805783");
  });

  it("round-trips addresses flagged by the LLM", () => {
    const text = "Registered at Hauptstraße 12, 10115 Berlin.";
    const { scrubbed, tokenMap } = redact(text, [], [
      { kind: "ADDRESS", text: "Hauptstraße 12, 10115 Berlin" },
    ]);
    expect(scrubbed).toContain("\u27E6ADDRESS_1\u27E7");
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
  });
});

describe("rebuildScrubbed — carries entity set across toggles", () => {
  it("re-masks entity tokens when they are kept active", () => {
    const raw = "Call 644805783 daily.";
    const entities = [{ kind: "PHONE", text: "644805783" }];
    const { tokenMap } = redact(raw, [], entities);
    const out = rebuildScrubbed(raw, tokenMap, tokenMap, entities);
    expect(out).toContain("\u27E6PHONE_1\u27E7");
    expect(out).not.toContain("644805783");
  });

  it("reveals entity tokens the user toggled off", () => {
    const raw = "Call 644805783 daily.";
    const entities = [{ kind: "PHONE", text: "644805783" }];
    const { tokenMap } = redact(raw, [], entities);
    const active = new Map<string, string>(); // everything disabled
    const out = rebuildScrubbed(raw, tokenMap, active, entities);
    expect(out).toContain("644805783");
    expect(out).not.toContain("\u27E6PHONE_1\u27E7");
  });
});
