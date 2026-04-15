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
    expect(scrubbed).toContain("[PARTY_A]");
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
  });

  it("round-trips IBAN", () => {
    const text = "Pay to NL91 ABNA 0417 1643 00 within 30 days.";
    const { scrubbed, tokenMap } = redact(text, []);
    expect(scrubbed).toContain("[IBAN_1]");
    expect(rehydrate(scrubbed, tokenMap)).toBe(text);
  });
});

describe("redact tokenMap shape", () => {
  it("numbers tokens by occurrence", () => {
    const text = "first@a.com plus second@b.com and back to first@a.com again.";
    const { scrubbed, tokenMap } = redact(text, []);
    expect(scrubbed).toContain("[EMAIL_1]");
    expect(scrubbed).toContain("[EMAIL_2]");
    expect(tokenMap.get("[EMAIL_1]")).toBe("first@a.com");
    expect(tokenMap.get("[EMAIL_2]")).toBe("second@b.com");
  });
});
