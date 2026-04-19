/**
 * Structural guard-rail for the data-residency config.
 *
 * The `/data-residency` page renders straight from this array, so the
 * assertions here are deliberately shallow — they just make sure every
 * entry has the fields the page needs, so a future commit can't
 * accidentally ship a blank "Region" field or a broken policy link.
 */

import { describe, it, expect } from "vitest";
import { DATA_FLOWS } from "./data-flows";

describe("DATA_FLOWS", () => {
  it("has at least one default and one optional flow", () => {
    expect(DATA_FLOWS.some((f) => f.group === "default")).toBe(true);
    expect(DATA_FLOWS.some((f) => f.group === "optional")).toBe(true);
  });

  it("populates every required field on every flow", () => {
    for (const flow of DATA_FLOWS) {
      expect(flow.provider).toBeTruthy();
      expect(flow.purpose).toBeTruthy();
      expect(flow.region).toBeTruthy();
      expect(flow.legalBasis).toBeTruthy();
      expect(flow.privacyPolicyUrl).toMatch(/^https:\/\//);
      expect(flow.dataCategories.length).toBeGreaterThan(0);
      for (const category of flow.dataCategories) {
        expect(category.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("uses https URLs for every DPA link that is set", () => {
    for (const flow of DATA_FLOWS) {
      if (flow.dpaUrl) {
        expect(flow.dpaUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it("includes Mistral as an EU default flow (SP-1 invariant)", () => {
    const mistral = DATA_FLOWS.find((f) => f.provider === "Mistral AI");
    expect(mistral).toBeDefined();
    expect(mistral?.group).toBe("default");
    expect(mistral?.region).toMatch(/EU/);
  });

  it("flags OpenAI as optional — rollback only (US transfer)", () => {
    const openai = DATA_FLOWS.find((f) => f.provider === "OpenAI");
    expect(openai).toBeDefined();
    expect(openai?.group).toBe("optional");
    expect(openai?.region).toMatch(/United States/i);
  });

  it("has unique provider names (the page keys by provider)", () => {
    const names = DATA_FLOWS.map((f) => f.provider);
    expect(new Set(names).size).toBe(names.length);
  });
});
