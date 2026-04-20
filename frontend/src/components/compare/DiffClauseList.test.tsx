/** Smoke tests for DiffClauseList — filter application + empty state. */

import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithIntl as render } from "@/test-fixtures/i18n";
import { DiffClauseList } from "./DiffClauseList";
import type { ComparisonGroup } from "@/lib/compare/types";
import type { AnalyzedClause } from "@/types";

function clause(
  category: AnalyzedClause["category"],
  risk: AnalyzedClause["risk_level"],
  title: string,
): AnalyzedClause {
  return {
    clause_text: title,
    category,
    title,
    plain_english: `Plain-english for ${title}`,
    risk_level: risk,
    risk_explanation: "because",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    applicable_law: null,
  };
}

const groups: ComparisonGroup[] = [
  {
    category: "liability",
    maxRiskA: "high",
    maxRiskB: "medium",
    clausesA: [clause("liability", "high", "Liability A")],
    clausesB: [clause("liability", "medium", "Liability B")],
    verdict: "higher_in_a",
  },
  {
    category: "termination",
    maxRiskA: "low",
    maxRiskB: "low",
    clausesA: [clause("termination", "low", "Termination A")],
    clausesB: [clause("termination", "low", "Termination B")],
    verdict: "same",
  },
  {
    category: "confidentiality",
    maxRiskA: null,
    maxRiskB: "medium",
    clausesA: [],
    clausesB: [clause("confidentiality", "medium", "Confidentiality B")],
    verdict: "unique_to_b",
  },
];

describe("DiffClauseList", () => {
  afterEach(cleanup);

  it("renders every group when filter = all", () => {
    render(<DiffClauseList groups={groups} filter="all" />);
    expect(screen.getAllByTestId("diff-row")).toHaveLength(3);
  });

  it("drops 'same' rows when filter = differences", () => {
    render(<DiffClauseList groups={groups} filter="differences" />);
    const rows = screen.getAllByTestId("diff-row");
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.dataset.verdict !== "same")).toBe(true);
  });

  it("narrows to higher_in_a only", () => {
    render(<DiffClauseList groups={groups} filter="higher_in_a" />);
    const rows = screen.getAllByTestId("diff-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].dataset.verdict).toBe("higher_in_a");
  });

  it("shows the empty state when no rows match", () => {
    render(<DiffClauseList groups={groups} filter="higher_in_b" />);
    expect(screen.getByTestId("diff-empty")).toBeDefined();
  });
});
