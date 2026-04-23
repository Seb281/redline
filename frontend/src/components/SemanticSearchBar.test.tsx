/**
 * Tests for the SP-10 Arc 3 Task 3.2 semantic search bar.
 *
 * The bar's contract:
 *   1. The submit button is disabled until the query hits the
 *      ``MIN_QUERY_CHARS`` floor — prevents a no-op call that would
 *      waste a Mistral embed round-trip.
 *   2. On submit, it embeds the query via the local Next.js route and
 *      then forwards the float array to the backend search helper.
 *   3. Results render as deep links anchored at the matched clause,
 *      with an accessible "similarity" pill.
 *   4. Errors bubble to a single aria-live status region; the user can
 *      retry without losing the query text.
 */

import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test-fixtures/i18n";

const embedSearchQueryMock = vi.fn();
const semanticSearchMock = vi.fn();

vi.mock("@/lib/api", () => ({
  embedSearchQuery: (...args: unknown[]) => embedSearchQueryMock(...args),
  semanticSearch: (...args: unknown[]) => semanticSearchMock(...args),
}));

/**
 * next-intl's ``Link`` from the routing shim reaches into
 * ``next/navigation`` which isn't wired into the unit-test tree. Stub it
 * to a plain anchor so the component's hrefs stay assertable.
 */
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

import { SemanticSearchBar } from "./SemanticSearchBar";

function validEmbedding(): number[] {
  return new Array(1024).fill(0);
}

describe("SemanticSearchBar", () => {
  beforeEach(() => {
    embedSearchQueryMock.mockReset();
    semanticSearchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("disables submit until the query reaches the min-chars floor", () => {
    renderWithIntl(<SemanticSearchBar />);

    const submit = screen.getByTestId(
      "semantic-search-submit",
    ) as HTMLButtonElement;
    const input = screen.getByTestId(
      "semantic-search-input",
    ) as HTMLInputElement;

    expect(submit.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "ab" } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "abc" } });
    expect(submit.disabled).toBe(false);
  });

  it("embeds the query then calls the backend with the float array", async () => {
    const embedding = validEmbedding();
    embedSearchQueryMock.mockResolvedValueOnce(embedding);
    semanticSearchMock.mockResolvedValueOnce({
      results: [
        {
          analysis_id: "a-1",
          clause_index: 3,
          similarity: 0.87,
          clause_title: "Termination",
          clause_text:
            "Either party may terminate the agreement with 30 days notice.",
          risk_level: "high",
          filename: "lease.pdf",
          contract_type: "Lease",
          created_at: "2026-04-13T00:00:00Z",
        },
      ],
    });

    renderWithIntl(<SemanticSearchBar />);

    fireEvent.change(screen.getByTestId("semantic-search-input"), {
      target: { value: "termination clauses" },
    });
    fireEvent.click(screen.getByTestId("semantic-search-submit"));

    await waitFor(() => {
      expect(embedSearchQueryMock).toHaveBeenCalledWith("termination clauses");
    });

    await waitFor(() => {
      expect(semanticSearchMock).toHaveBeenCalledWith(embedding, 20);
    });

    const result = await screen.findByTestId("semantic-search-result");
    expect(result.textContent).toContain("Termination");
    expect(result.textContent).toContain("lease.pdf");

    const score = await screen.findByTestId("semantic-search-score");
    // 0.87 → "87% match" per the EN catalog.
    expect(score.textContent).toContain("87");

    const link = result.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/history/a-1#clause-3");
  });

  it("surfaces a backend error in the status region without wiping the query", async () => {
    embedSearchQueryMock.mockRejectedValueOnce(new Error("upstream 503"));

    renderWithIntl(<SemanticSearchBar />);

    fireEvent.change(screen.getByTestId("semantic-search-input"), {
      target: { value: "liability caps" },
    });
    fireEvent.click(screen.getByTestId("semantic-search-submit"));

    await waitFor(() => {
      const status = screen.getByTestId("semantic-search-status");
      expect(status.textContent ?? "").toContain("upstream 503");
    });

    const input = screen.getByTestId(
      "semantic-search-input",
    ) as HTMLInputElement;
    expect(input.value).toBe("liability caps");
  });

  it("renders the empty-results hint when the backend returns no hits", async () => {
    embedSearchQueryMock.mockResolvedValueOnce(validEmbedding());
    semanticSearchMock.mockResolvedValueOnce({ results: [] });

    renderWithIntl(<SemanticSearchBar />);

    fireEvent.change(screen.getByTestId("semantic-search-input"), {
      target: { value: "an obscure clause" },
    });
    fireEvent.click(screen.getByTestId("semantic-search-submit"));

    await waitFor(() => {
      expect(semanticSearchMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      const status = screen.getByTestId("semantic-search-status");
      expect((status.textContent ?? "").toLowerCase()).toContain("no matches");
    });

    expect(screen.queryByTestId("semantic-search-results")).toBeNull();
  });
});
