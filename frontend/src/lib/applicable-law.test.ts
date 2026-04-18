import { describe, it, expect } from "vitest";
import { STATUTE_CODES, STATUTE_LABELS, type StatuteCode } from "./applicable-law";

describe("applicable-law", () => {
  it("exposes 8 MVP statute codes", () => {
    expect(STATUTE_CODES).toHaveLength(8);
  });

  it("every code has a canonical label", () => {
    for (const code of STATUTE_CODES) {
      const label = STATUTE_LABELS[code];
      expect(label).toBeDefined();
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("labels map has no extra keys beyond STATUTE_CODES", () => {
    const labelKeys = Object.keys(STATUTE_LABELS) as StatuteCode[];
    expect(labelKeys).toHaveLength(STATUTE_CODES.length);
    for (const k of labelKeys) {
      expect(STATUTE_CODES).toContain(k);
    }
  });

  it("labels contain the statute identifier verbatim", () => {
    expect(STATUTE_LABELS.DE_BGB_276).toContain("BGB");
    expect(STATUTE_LABELS.EU_GDPR).toContain("GDPR");
    expect(STATUTE_LABELS.EU_DIR_93_13_EEC).toContain("93/13/EEC");
  });
});
