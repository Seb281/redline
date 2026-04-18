import { describe, it, expect } from "vitest";
import {
  SUPPORTED_COUNTRIES,
  EU_MEMBERS,
  STATUTES,
  STATUTE_CODES,
  STATUTE_LABELS,
  filterStatutes,
  type StatuteCountry,
} from "./applicable-law";

describe("applicable-law catalog", () => {
  it("SUPPORTED_COUNTRIES is a subset of EU_MEMBERS", () => {
    for (const c of SUPPORTED_COUNTRIES) {
      expect((EU_MEMBERS as readonly string[]).includes(c)).toBe(true);
    }
  });

  it("every statute has a valid country tag", () => {
    const valid: readonly StatuteCountry[] = [
      ...SUPPORTED_COUNTRIES,
      "EU",
    ];
    for (const s of STATUTES) {
      expect(valid).toContain(s.country);
    }
  });

  it("statute codes match ISO_CODE_PART pattern", () => {
    for (const s of STATUTES) {
      expect(s.code).toMatch(/^[A-Z]{2}_[A-Z0-9_]+$/);
    }
  });

  it("no duplicate statute codes", () => {
    const set = new Set(STATUTES.map((s) => s.code));
    expect(set.size).toBe(STATUTES.length);
  });

  it("every statute has a non-empty label and applicability", () => {
    for (const s of STATUTES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.applicability.length).toBeGreaterThan(0);
    }
  });

  it("derived STATUTE_CODES matches STATUTES.map(s => s.code)", () => {
    expect(STATUTE_CODES).toEqual(STATUTES.map((s) => s.code));
  });

  it("derived STATUTE_LABELS has a label for every code", () => {
    for (const code of STATUTE_CODES) {
      expect(STATUTE_LABELS[code]).toBeDefined();
      expect(STATUTE_LABELS[code].length).toBeGreaterThan(0);
    }
  });

  it("retains the 8 SP-1.7 launch codes", () => {
    const expected = [
      "DE_BGB_276",
      "DE_ARBNERFG",
      "DE_KARENZENTSCHAEDIGUNG",
      "NL_BW_7_650",
      "NL_BW_7_653",
      "FR_CODE_TRAVAIL_NONCOMPETE",
      "EU_GDPR",
      "EU_DIR_93_13_EEC",
    ];
    for (const code of expected) {
      expect(STATUTE_CODES as readonly string[]).toContain(code);
    }
  });
});

describe("filterStatutes (SP-2)", () => {
  it("supported country returns country statutes + EU", () => {
    const result = filterStatutes("DE");
    const countries = new Set(result.map((s) => s.country));
    expect(countries).toEqual(new Set(["DE", "EU"]));
    expect(result.some((s) => s.code === "DE_BGB_276")).toBe(true);
    expect(result.some((s) => s.code === "EU_GDPR")).toBe(true);
    expect(result.some((s) => s.code === "NL_BW_7_650")).toBe(false);
  });

  it("other EU-27 country (BE) returns EU only", () => {
    const result = filterStatutes("BE");
    const countries = new Set(result.map((s) => s.country));
    expect(countries).toEqual(new Set(["EU"]));
  });

  it("null country (non-EU / unknown) returns empty", () => {
    expect(filterStatutes(null)).toEqual([]);
  });

  it.each(["DE", "NL", "FR", "ES", "IT", "PL"] as const)(
    "supported country %s never leaks another supported country's statutes",
    (country) => {
      const result = filterStatutes(country);
      const otherSupported = ["DE", "NL", "FR", "ES", "IT", "PL"].filter(
        (c) => c !== country,
      );
      for (const s of result) {
        expect(otherSupported).not.toContain(s.country);
      }
    },
  );
});
