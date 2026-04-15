/**
 * End-to-end redaction tests. Most importantly: the round-trip property —
 * `rehydrate(redact(text, parties).scrubbed, tokenMap) === text` for any
 * input. If this breaks, the user sees garbled clause text on display.
 */
import { describe, it, expect } from "vitest";
import { redact, rehydrate } from "./index";

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
    const { scrubbed, tokenMap } = redact(text, ["ACME Corp"]);
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
    const { scrubbed, tokenMap } = redact(text, ["Acme"]);
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
    const { scrubbed, tokenMap } = redact(text, ["ACME", "ACME"]);
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
    expect(scrubbed).not.toMatch(/PART[^\u27E6]*\u27E7[A-Z]/);
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
