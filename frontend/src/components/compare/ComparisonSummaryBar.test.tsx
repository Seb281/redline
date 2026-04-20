/** Smoke tests for ComparisonSummaryBar — stats cards, lean badge, jurisdiction. */

import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithIntl as render } from "@/test-fixtures/i18n";
import { ComparisonSummaryBar } from "./ComparisonSummaryBar";
import type { ComparisonStats } from "@/lib/compare/types";
import type { ContractOverview } from "@/types";

const stats: ComparisonStats = {
  riskierInA: 2,
  riskierInB: 3,
  uniqueToOne: 1,
  sameRiskLevel: 4,
  overallLean: "b",
};

const overview = (jurisdiction: string | null): ContractOverview => ({
  contract_type: "Services",
  parties: [],
  effective_date: null,
  duration: null,
  governing_jurisdiction: jurisdiction,
  jurisdiction_evidence: null,
  key_terms: [],
  clause_inventory: [],
});

describe("ComparisonSummaryBar", () => {
  afterEach(cleanup);

  it("renders 4 stat cards with the stats values", () => {
    render(
      <ComparisonSummaryBar
        stats={stats}
        labelA="Alpha"
        labelB="Beta"
        overviewA={overview("Netherlands")}
        overviewB={overview("France")}
      />,
    );
    const cards = screen.getAllByTestId("compare-stat-card");
    expect(cards).toHaveLength(4);
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
  });

  it("names the riskier side in the lean badge", () => {
    render(
      <ComparisonSummaryBar
        stats={stats}
        labelA="Alpha"
        labelB="Beta"
        overviewA={overview("Netherlands")}
        overviewB={overview("France")}
      />,
    );
    expect(screen.getByTestId("compare-lean-badge").textContent).toContain(
      "Beta",
    );
  });

  it("falls back to a dash when governing_jurisdiction is null/empty", () => {
    render(
      <ComparisonSummaryBar
        stats={stats}
        labelA="Alpha"
        labelB="Beta"
        overviewA={overview(null)}
        overviewB={overview("France")}
      />,
    );
    // `jurisdictionPair` = "{a} vs {b}" with dash fallback "—" on side A.
    expect(screen.getByText(/— vs France/)).toBeDefined();
  });
});
