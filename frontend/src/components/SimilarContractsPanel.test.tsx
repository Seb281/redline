/**
 * Tests for the SP-10 Arc 3 Task 3.3 library-comparison panel.
 *
 * Contract:
 *   1. The panel is collapsed on mount — no API call is made until the
 *      user opens it.
 *   2. Opening the panel triggers ``embedSearchQuery`` + ``findSimilarContracts``
 *      in sequence, and the current ``analysis_id`` is forwarded to the
 *      exclude filter (self-match is noise).
 *   3. Each hit renders with filename, best-clause deep-link, and a
 *      similarity percentage pill.
 *   4. Errors surface inline with a retry affordance; retry re-runs the
 *      pipeline without the user having to reopen the panel.
 *   5. An empty result set renders the empty-library hint.
 */

import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test-fixtures/i18n";
import type { AnalyzedClause, ContractOverview } from "@/types";

const embedSearchQueryMock = vi.fn();
const findSimilarContractsMock = vi.fn();

vi.mock("@/lib/api", () => ({
  embedSearchQuery: (...args: unknown[]) => embedSearchQueryMock(...args),
  findSimilarContracts: (...args: unknown[]) =>
    findSimilarContractsMock(...args),
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

import { SimilarContractsPanel } from "./SimilarContractsPanel";

function validEmbedding(): number[] {
  return new Array(1024).fill(0);
}

const overview: ContractOverview = {
  contract_type: "SaaS Agreement",
  parties: [],
  key_terms: ["12 months", "EU hosting"],
  clause_inventory: [],
};

const clauses: AnalyzedClause[] = [
  {
    clause_text: "...",
    category: "termination",
    title: "Termination",
    plain_english: "",
    risk_level: "high",
    risk_explanation: "",
  } as AnalyzedClause,
];

function renderPanel(analysisId = "current-id") {
  return renderWithIntl(
    <SimilarContractsPanel
      currentAnalysisId={analysisId}
      overview={overview}
      clauses={clauses}
    />,
  );
}

describe("SimilarContractsPanel", () => {
  beforeEach(() => {
    embedSearchQueryMock.mockReset();
    findSimilarContractsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not hit the API until the panel is opened", () => {
    renderPanel();
    expect(embedSearchQueryMock).not.toHaveBeenCalled();
    expect(findSimilarContractsMock).not.toHaveBeenCalled();
  });

  it("fires embed + search on open and renders ranked hits with self-filter applied", async () => {
    const embedding = validEmbedding();
    embedSearchQueryMock.mockResolvedValueOnce(embedding);
    findSimilarContractsMock.mockResolvedValueOnce({
      results: [
        {
          analysis_id: "a-1",
          filename: "msa.pdf",
          contract_type: "SaaS",
          similarity: 0.88,
          best_clause_index: 2,
          best_clause_title: "Limitation of Liability",
          created_at: "2026-04-13T00:00:00Z",
        },
      ],
    });

    renderPanel("current-id");

    const panel = screen.getByTestId("similar-contracts-panel");
    (panel as HTMLDetailsElement).open = true;
    fireEvent(panel, new Event("toggle", { bubbles: false }));

    await waitFor(() => {
      expect(embedSearchQueryMock).toHaveBeenCalledTimes(1);
    });

    // Must forward the current analysis id as the exclude filter so the
    // panel cannot show its own report as a match.
    await waitFor(() => {
      expect(findSimilarContractsMock).toHaveBeenCalledWith(
        embedding,
        "current-id",
        5,
      );
    });

    const result = await screen.findByTestId("similar-contracts-result");
    expect(result.textContent).toContain("msa.pdf");
    expect(result.textContent).toContain("Limitation of Liability");

    const score = await screen.findByTestId("similar-contracts-score");
    expect(score.textContent).toContain("88");

    const link = result.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/history/a-1#clause-2");
  });

  it("surfaces an inline error with a retry that re-runs the pipeline", async () => {
    embedSearchQueryMock.mockRejectedValueOnce(new Error("upstream 503"));

    renderPanel();

    const panel = screen.getByTestId("similar-contracts-panel");
    (panel as HTMLDetailsElement).open = true;
    fireEvent(panel, new Event("toggle", { bubbles: false }));

    const errorBox = await screen.findByTestId("similar-contracts-error");
    expect(errorBox.textContent).toContain("upstream 503");

    // Retry path must succeed and replace the error UI with results.
    embedSearchQueryMock.mockResolvedValueOnce(validEmbedding());
    findSimilarContractsMock.mockResolvedValueOnce({ results: [] });

    fireEvent.click(screen.getByTestId("similar-contracts-retry"));

    await waitFor(() => {
      expect(screen.queryByTestId("similar-contracts-error")).toBeNull();
    });
    await screen.findByTestId("similar-contracts-empty");
  });

  it("renders the empty hint when the backend returns zero matches", async () => {
    embedSearchQueryMock.mockResolvedValueOnce(validEmbedding());
    findSimilarContractsMock.mockResolvedValueOnce({ results: [] });

    renderPanel();

    const panel = screen.getByTestId("similar-contracts-panel");
    (panel as HTMLDetailsElement).open = true;
    fireEvent(panel, new Event("toggle", { bubbles: false }));

    await screen.findByTestId("similar-contracts-empty");
    expect(screen.queryByTestId("similar-contracts-results")).toBeNull();
  });
});
