/**
 * Tests for PII regex patterns. Each pattern asserted hit + miss
 * against realistic text snippets.
 */
import { describe, it, expect } from "vitest";
import { PATTERNS, validIban } from "./patterns";

const findAll = (kind: string, text: string): string[] =>
  Array.from(text.matchAll(PATTERNS[kind].regex)).map((m) => m[0]);

describe("PATTERNS.email", () => {
  it("matches common emails", () => {
    expect(findAll("email", "Reach me at sofia@example.nl or bob.smith+legal@acme.de"))
      .toEqual(["sofia@example.nl", "bob.smith+legal@acme.de"]);
  });
  it("does not match plain words", () => {
    expect(findAll("email", "this is at example dot com")).toEqual([]);
  });
});

describe("PATTERNS.phone", () => {
  it("matches E.164 and grouped formats", () => {
    const text = "Call +33 6 12 34 56 78 or +49 30 12345678 or +1-202-555-0143";
    const found = findAll("phone", text);
    expect(found.length).toBeGreaterThanOrEqual(3);
  });
  it("does not match short numbers", () => {
    expect(findAll("phone", "Section 42 of the contract")).toEqual([]);
  });
});

describe("PATTERNS.iban + validIban", () => {
  it("matches a structurally valid Dutch IBAN", () => {
    const text = "Wire to NL91 ABNA 0417 1643 00 by Friday";
    const matches = findAll("iban", text);
    expect(matches.length).toBe(1);
    expect(validIban(matches[0].replace(/\s+/g, ""))).toBe(true);
  });
  it("matches a French IBAN", () => {
    const matches = findAll("iban", "FR14 2004 1010 0505 0001 3M02 606 — primary account");
    expect(matches.length).toBe(1);
  });
  it("validIban rejects bad checksum", () => {
    expect(validIban("NL00ABNA0417164300")).toBe(false);
  });
});

describe("PATTERNS.vat", () => {
  it("matches EU VAT formats", () => {
    expect(findAll("vat", "VAT NL853012345B01 and DE123456789")).toEqual([
      "NL853012345B01",
      "DE123456789",
    ]);
  });
  it("does not match arbitrary 2-letter+digit codes (non-EU prefixes)", () => {
    // Regression: an earlier loose pattern over-matched product SKUs /
    // case references like "XX1234567890ABC". Restrict to EU country
    // codes only.
    expect(findAll("vat", "Order XX1234567890ABC ships Monday")).toEqual([]);
    expect(findAll("vat", "Case ZZ987654321 is closed")).toEqual([]);
  });
});

describe("PATTERNS.frenchSsn", () => {
  it("matches a 15-digit French SSN", () => {
    expect(findAll("frenchSsn", "n° 1 90 03 69 123 456 78 ")).toEqual([
      "1 90 03 69 123 456 78",
    ]);
  });
  it("does not match arbitrary digit runs", () => {
    expect(findAll("frenchSsn", "case number 1234567890123")).toEqual([]);
  });
});

describe("PATTERNS.germanTaxId", () => {
  it("matches an 11-digit German tax ID", () => {
    expect(findAll("germanTaxId", "Steuer-ID 12345678901 zugewiesen")).toEqual([
      "12345678901",
    ]);
  });
});
