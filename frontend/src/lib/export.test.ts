import { describe, it, expect } from "vitest";
import { generateMarkdown } from "./export";
import type { AnalyzeResponse } from "@/types";

const base: AnalyzeResponse = {
  overview: {
    contract_type: "Test Agreement",
    parties: ["Alice", "Bob"],
    effective_date: null,
    duration: null,
    total_value: null,
    governing_jurisdiction: null,
    jurisdiction_evidence: null,
    key_terms: ["A term"],
    clause_inventory: [{ title: "Mutual termination", section_ref: null }],
  },
  summary: {
    total_clauses: 1,
    risk_breakdown: { high: 0, medium: 1, low: 0, informational: 0 },
    top_risks: [],
  },
  clauses: [
    {
      clause_text:
        "Either party may terminate this agreement with thirty (30) days written notice.",
      category: "termination",
      title: "Mutual termination",
      plain_english:
        "Either party can end the agreement [^1] on reasonable notice.",
      risk_level: "medium",
      risk_explanation: "Balanced but watch for short windows.",
      negotiation_suggestion: null,
      is_unusual: false,
      unusual_explanation: null,
      applicable_law: null,
      citations: [
        { id: 1, quoted_text: "thirty (30) days written notice" },
      ],
    },
  ],
};

describe("generateMarkdown — citations", () => {
  it("renders verified footnotes beneath the narrative", () => {
    const md = generateMarkdown(base);
    expect(md).toContain(
      "Either party can end the agreement [^1] on reasonable notice.",
    );
    expect(md).toContain('[^1]: "thirty (30) days written notice"');
  });

  it("omits unverified citations silently", () => {
    const data = structuredClone(base);
    data.clauses[0].citations = [
      { id: 1, quoted_text: "fabricated phrase not present" },
    ];
    const md = generateMarkdown(data);
    expect(md).not.toContain("[^1]:");
  });

  it("omits the footnote block when there are no verified citations", () => {
    const data = structuredClone(base);
    data.clauses[0].citations = undefined;
    data.clauses[0].plain_english = "Narrative without markers.";
    const md = generateMarkdown(data);
    expect(md).not.toContain("[^");
  });
});

describe("generateMarkdown — optional fields", () => {
  it("renders all overview fields when present", () => {
    const data = structuredClone(base);
    data.overview.effective_date = "2025-01-15";
    data.overview.duration = "12 months";
    data.overview.total_value = "€50,000";
    data.overview.governing_jurisdiction = "the Netherlands";
    const md = generateMarkdown(data);
    expect(md).toContain("**Effective Date:** 2025-01-15");
    expect(md).toContain("**Duration:** 12 months");
    expect(md).toContain("**Value:** €50,000");
    expect(md).toContain("**Jurisdiction:** the Netherlands");
  });

  it("omits optional fields when null", () => {
    const md = generateMarkdown(base);
    expect(md).not.toContain("**Effective Date:**");
    expect(md).not.toContain("**Duration:**");
    expect(md).not.toContain("**Value:**");
    expect(md).not.toContain("**Jurisdiction:** the Netherlands");
  });

  it("renders unusual clause section when present", () => {
    const data = structuredClone(base);
    data.clauses[0].is_unusual = true;
    data.clauses[0].unusual_explanation = "Unusually broad scope.";
    const md = generateMarkdown(data);
    expect(md).toContain("### Unusual Clauses");
    expect(md).toContain("**Mutual termination**: Unusually broad scope.");
    expect(md).toContain("**ATYPICAL**");
  });

  it("renders applicable_law with statute_cited + canonical label (SP-1.7)", () => {
    const data = structuredClone(base);
    data.clauses[0].applicable_law = {
      observation: "Void under German law",
      source_type: "statute_cited",
      citations: [{ code: "DE_BGB_276" }],
    };
    const md = generateMarkdown(data);
    expect(md).toContain("**Jurisdiction:** Void under German law");
    expect(md).toContain("BGB §276");
  });

  it("renders applicable_law with general_principle (no citation line)", () => {
    const data = structuredClone(base);
    data.clauses[0].applicable_law = {
      observation: "General EU principle",
      source_type: "general_principle",
      citations: [],
    };
    const md = generateMarkdown(data);
    expect(md).toContain("**Jurisdiction:** General EU principle");
    const clauseSection = md.split("## Clauses")[1];
    expect(clauseSection).not.toMatch(/Cited: /);
  });

  it("omits the jurisdiction line when applicable_law is null", () => {
    const md = generateMarkdown(base);
    const clauseSection = md.split("## Clauses")[1];
    expect(clauseSection).not.toContain("**Jurisdiction:**");
  });
});

describe("generateMarkdown — all risk levels", () => {
  it("correctly labels each risk level", () => {
    const data = structuredClone(base);
    data.clauses = [
      { ...base.clauses[0], risk_level: "high", title: "High clause" },
      { ...base.clauses[0], risk_level: "medium", title: "Medium clause" },
      { ...base.clauses[0], risk_level: "low", title: "Low clause" },
      { ...base.clauses[0], risk_level: "informational", title: "Info clause" },
    ];
    const md = generateMarkdown(data);
    expect(md).toContain("**HIGH RISK**");
    expect(md).toContain("**MEDIUM RISK**");
    expect(md).toContain("**LOW RISK**");
    expect(md).toContain("**INFORMATIONAL RISK**");
  });
});
