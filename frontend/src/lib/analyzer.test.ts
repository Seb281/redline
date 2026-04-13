import { describe, it, expect } from "vitest";
import {
  buildRiskBreakdown,
  formatInventoryPrompt,
  buildExtractionPrompt,
  buildAnalysisSystemPrompt,
} from "./analyzer";

describe("buildRiskBreakdown", () => {
  it("counts each risk level correctly", () => {
    const clauses = [
      { risk_level: "high" },
      { risk_level: "high" },
      { risk_level: "medium" },
      { risk_level: "low" },
      { risk_level: "informational" },
      { risk_level: "informational" },
      { risk_level: "informational" },
    ];
    expect(buildRiskBreakdown(clauses)).toEqual({
      high: 2,
      medium: 1,
      low: 1,
      informational: 3,
    });
  });

  it("returns all zeros for empty array", () => {
    expect(buildRiskBreakdown([])).toEqual({
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    });
  });
});

describe("formatInventoryPrompt", () => {
  it("formats items with section refs", () => {
    const items = [
      { title: "Non-Compete", section_ref: "Section 6.1" },
      { title: "Governing Law", section_ref: null },
    ];
    const result = formatInventoryPrompt(items);
    expect(result).toBe("1. Non-Compete (Section 6.1)\n2. Governing Law");
  });

  it("returns empty string for empty inventory", () => {
    expect(formatInventoryPrompt([])).toBe("");
  });
});

describe("buildExtractionPrompt", () => {
  it("includes inventory count and contract text", () => {
    const inventory = [
      { title: "Termination", section_ref: "Section 3" },
      { title: "Payment", section_ref: null },
    ];
    const result = buildExtractionPrompt("Contract body here", inventory);
    expect(result).toContain("2 clauses");
    expect(result).toContain("1. Termination (Section 3)");
    expect(result).toContain("2. Payment");
    expect(result).toContain("Contract body here");
  });
});

describe("buildAnalysisSystemPrompt", () => {
  it("includes citation instructions when enabled", () => {
    const prompt = buildAnalysisSystemPrompt(true);
    expect(prompt).toContain("[^1]");
    expect(prompt).not.toContain("Citations (disabled");
  });

  it("disables citations when flag is false", () => {
    const prompt = buildAnalysisSystemPrompt(false);
    expect(prompt).toContain("Citations (disabled");
    expect(prompt).toContain("citations: []");
  });

  it("includes role perspective when userRole provided", () => {
    const prompt = buildAnalysisSystemPrompt(true, "Tenant");
    expect(prompt).toContain("from the perspective of Tenant");
  });

  it("uses weaker-party framing when no role", () => {
    const prompt = buildAnalysisSystemPrompt(true, null);
    expect(prompt).toContain("weaker");
  });

  it("includes jurisdiction rules when jurisdiction provided", () => {
    const prompt = buildAnalysisSystemPrompt(true, null, "the Netherlands");
    expect(prompt).toContain("the Netherlands");
    expect(prompt).toContain("Karenzentschädigung");
    expect(prompt).toContain("jurisdiction_note");
  });

  it("instructs null jurisdiction_note when no jurisdiction", () => {
    const prompt = buildAnalysisSystemPrompt(true, null, null);
    expect(prompt).toContain("jurisdiction_note");
    expect(prompt).toContain("null for all clauses");
  });
});
