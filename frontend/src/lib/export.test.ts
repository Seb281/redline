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
