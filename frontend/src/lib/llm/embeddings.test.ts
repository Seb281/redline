/**
 * SP-10 Arc 1 Phase 2 — embedMany wrapper tests.
 *
 * The wrapper has three contracts to guard:
 *   1. Build one composite string per clause (title + plain_english + clause_text)
 *      — retrieval quality depends on this blend; title-only or body-only
 *      collapses recall in practice.
 *   2. Return a typed `ClauseEmbedding[]` aligned with `clauses` by
 *      `clause_index`. Order must be preserved so the caller can drop
 *      the result onto `AnalyzeResponse.clause_embeddings` without
 *      matching up by content.
 *   3. Fail soft. If embedMany throws, `embedClauses` returns `null`
 *      so the caller can log and continue — chat still works via the
 *      keyword fallback. Partial results are never returned (either all
 *      or nothing), because a partial index would silently demote any
 *      clause that failed to embed and that is harder to debug than
 *      "no index at all."
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnalyzedClause } from "@/types";

const embedManyMock = vi.fn();

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    embedMany: (...args: unknown[]) => embedManyMock(...args),
  };
});

vi.mock("@ai-sdk/mistral", () => ({
  mistral: {
    embedding: (id: string) => ({ __embeddingModelId: id }),
  },
}));

import { buildClauseEmbeddingText, embedClauses } from "./embeddings";

function clause(overrides: Partial<AnalyzedClause> = {}): AnalyzedClause {
  return {
    clause_text: "The tenant shall pay rent on the first of each month.",
    category: "payment_terms",
    title: "Rent",
    plain_english: "Rent is due on the 1st of the month.",
    risk_level: "low",
    risk_explanation: "Standard payment term.",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    applicable_law: null,
    ...overrides,
  };
}

describe("buildClauseEmbeddingText", () => {
  beforeEach(() => {
    embedManyMock.mockReset();
  });

  it("composes title + plain-English + body for retrieval blend", () => {
    const text = buildClauseEmbeddingText(
      clause({
        title: "Late Fee",
        plain_english: "Fee applies if payment lands after the due date.",
        clause_text: "A late fee of 5% accrues on any overdue balance.",
      }),
    );
    expect(text).toContain("Late Fee");
    expect(text).toContain("Fee applies if payment lands after");
    expect(text).toContain("late fee of 5%");
  });

  it("elides empty fields without leaving dangling separators", () => {
    const text = buildClauseEmbeddingText(
      clause({ title: "", plain_english: "", clause_text: "Body only." }),
    );
    expect(text.trim()).toBe("Body only.");
  });
});

describe("embedClauses", () => {
  beforeEach(() => {
    embedManyMock.mockReset();
  });

  it("returns embeddings aligned with clauses by clause_index", async () => {
    embedManyMock.mockResolvedValueOnce({
      embeddings: [
        new Array(1024).fill(0.1),
        new Array(1024).fill(0.2),
      ],
      values: ["a", "b"],
      usage: { tokens: 0 },
      warnings: [],
    });
    const result = await embedClauses([clause({ title: "A" }), clause({ title: "B" })]);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].clause_index).toBe(0);
    expect(result![1].clause_index).toBe(1);
    expect(result![0].embedding).toHaveLength(1024);
  });

  it("returns null when embedMany throws (fail-soft)", async () => {
    embedManyMock.mockRejectedValueOnce(new Error("upstream 503"));
    const result = await embedClauses([clause()]);
    expect(result).toBeNull();
  });

  it("returns null when any embedding has the wrong dimension", async () => {
    embedManyMock.mockResolvedValueOnce({
      embeddings: [new Array(768).fill(0.1)],
      values: ["a"],
      usage: { tokens: 0 },
      warnings: [],
    });
    const result = await embedClauses([clause()]);
    expect(result).toBeNull();
  });

  it("returns an empty array for an empty clause list (skips the call)", async () => {
    const result = await embedClauses([]);
    expect(result).toEqual([]);
    expect(embedManyMock).not.toHaveBeenCalled();
  });

  it("passes the Mistral embedding model and every clause text", async () => {
    embedManyMock.mockResolvedValueOnce({
      embeddings: [new Array(1024).fill(0), new Array(1024).fill(0)],
      values: ["a", "b"],
      usage: { tokens: 0 },
      warnings: [],
    });
    await embedClauses([clause({ title: "First" }), clause({ title: "Second" })]);
    expect(embedManyMock).toHaveBeenCalledTimes(1);
    const args = embedManyMock.mock.calls[0][0];
    expect(args.values).toHaveLength(2);
    expect(args.values[0]).toContain("First");
    expect(args.values[1]).toContain("Second");
    expect(args.model).toEqual({ __embeddingModelId: "mistral-embed" });
  });
});
