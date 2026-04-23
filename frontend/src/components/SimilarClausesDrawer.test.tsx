/**
 * Tests for the SP-10 Arc 3 Task 3.4 similar-clauses drawer.
 *
 * Contract:
 *   1. Closed drawer makes no API calls — confirms the cost guard.
 *   2. Opening the drawer for a clause fires embed + search with the
 *      current analysis id pinned as ``exclude_analysis_id``, so the
 *      caller's own siblings cannot flood the results.
 *   3. Results render as deep links with a similarity pill.
 *   4. Error → inline message + retry button that re-runs the pipeline.
 *   5. Empty results render the localized empty-state hint.
 */

import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderWithIntl } from "@/test-fixtures/i18n";
import type { AnalyzedClause } from "@/types";

const embedSearchQueryMock = vi.fn();
const semanticSearchMock = vi.fn();

vi.mock("@/lib/api", () => ({
  embedSearchQuery: (...args: unknown[]) => embedSearchQueryMock(...args),
  semanticSearch: (...args: unknown[]) => semanticSearchMock(...args),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SimilarClausesDrawer } from "./SimilarClausesDrawer";

function validEmbedding(): number[] {
  return new Array(1024).fill(0);
}

function makeClause(
  overrides: Partial<AnalyzedClause> = {},
): AnalyzedClause {
  return {
    clause_text: "Either party may terminate on 30 days written notice.",
    category: "termination",
    title: "Termination",
    plain_english: "",
    risk_level: "high",
    risk_explanation: "",
    ...overrides,
  } as AnalyzedClause;
}

describe("SimilarClausesDrawer", () => {
  beforeEach(() => {
    embedSearchQueryMock.mockReset();
    semanticSearchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("fires no API calls while the drawer is closed", () => {
    renderWithIntl(
      <SimilarClausesDrawer
        isOpen={false}
        onClose={() => {}}
        currentAnalysisId="current"
        clause={makeClause()}
      />,
    );

    expect(embedSearchQueryMock).not.toHaveBeenCalled();
    expect(semanticSearchMock).not.toHaveBeenCalled();
  });

  it("on open, embeds the clause and calls the backend with the self-filter applied", async () => {
    const embedding = validEmbedding();
    embedSearchQueryMock.mockResolvedValueOnce(embedding);
    semanticSearchMock.mockResolvedValueOnce({
      results: [
        {
          analysis_id: "a-2",
          clause_index: 1,
          similarity: 0.82,
          clause_title: "Early Termination",
          clause_text: "Customer may terminate with 60 days notice.",
          risk_level: "medium",
          filename: "msa.pdf",
          contract_type: "MSA",
          created_at: "2026-04-13T00:00:00Z",
        },
      ],
    });

    renderWithIntl(
      <SimilarClausesDrawer
        isOpen={true}
        onClose={() => {}}
        currentAnalysisId="current-id"
        clause={makeClause()}
      />,
    );

    await waitFor(() => {
      // Query string shape: "{title}. {clause_text}"
      expect(embedSearchQueryMock).toHaveBeenCalledWith(
        "Termination. Either party may terminate on 30 days written notice.",
      );
    });

    await waitFor(() => {
      // Third arg is the exclude analysis id — drawer must self-filter.
      expect(semanticSearchMock).toHaveBeenCalledWith(
        embedding,
        10,
        "current-id",
      );
    });

    const result = await screen.findByTestId("similar-clauses-result");
    expect(result.textContent).toContain("Early Termination");
    expect(result.textContent).toContain("msa.pdf");

    const score = await screen.findByTestId("similar-clauses-score");
    expect(score.textContent).toContain("82");

    const link = result.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/history/a-2#clause-1");
  });

  it("shows the error + retry affordance and recovers on retry", async () => {
    embedSearchQueryMock.mockRejectedValueOnce(new Error("boom"));

    renderWithIntl(
      <SimilarClausesDrawer
        isOpen={true}
        onClose={() => {}}
        currentAnalysisId="current"
        clause={makeClause()}
      />,
    );

    const errorBox = await screen.findByTestId("similar-clauses-error");
    expect(errorBox.textContent).toContain("boom");

    embedSearchQueryMock.mockResolvedValueOnce(validEmbedding());
    semanticSearchMock.mockResolvedValueOnce({ results: [] });

    fireEvent.click(screen.getByTestId("similar-clauses-retry"));

    await waitFor(() => {
      expect(screen.queryByTestId("similar-clauses-error")).toBeNull();
    });
    await screen.findByTestId("similar-clauses-empty");
  });

  it("renders the empty hint when the backend returns zero matches", async () => {
    embedSearchQueryMock.mockResolvedValueOnce(validEmbedding());
    semanticSearchMock.mockResolvedValueOnce({ results: [] });

    renderWithIntl(
      <SimilarClausesDrawer
        isOpen={true}
        onClose={() => {}}
        currentAnalysisId="current"
        clause={makeClause()}
      />,
    );

    await screen.findByTestId("similar-clauses-empty");
    expect(screen.queryByTestId("similar-clauses-results")).toBeNull();
  });
});
