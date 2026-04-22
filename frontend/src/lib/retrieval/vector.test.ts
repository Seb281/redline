/**
 * SP-10 Arc 1 Phase 3 — cosine-similarity vector retriever tests.
 *
 * Cosine similarity is the pgvector `<=>` operator inverted
 * (`similarity = 1 - distance`). For retrieval we only need *ranking*
 * to be consistent; absolute values are incidental.
 */

import { describe, it, expect } from "vitest";
import { cosineSimilarity, vectorRank } from "./vector";

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors", () => {
    const v = [1, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 5);
  });

  it("is invariant to magnitude", () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6]; // same direction, twice the magnitude
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it("is -1 for anti-parallel vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1, 5);
  });

  it("returns 0 when either vector is all-zeros (no NaN)", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
  });

  it("throws when dimensions mismatch (programmer error, not data error)", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/dimension/i);
  });
});

describe("vectorRank", () => {
  it("ranks the closest-direction vector first", () => {
    const query = [1, 0, 0];
    const corpus = [
      { id: 0, embedding: [0, 1, 0] },
      { id: 1, embedding: [0.9, 0.1, 0] },
      { id: 2, embedding: [-1, 0, 0] },
    ];
    const ranked = vectorRank(query, corpus);
    expect(ranked[0].id).toBe(1);
    // Orthogonal and anti-parallel should come last two.
    expect(ranked[ranked.length - 1].id).toBe(2);
  });

  it("preserves the full corpus in the result (no silent truncation)", () => {
    const query = [1, 0, 0];
    const corpus = [
      { id: 0, embedding: [1, 0, 0] },
      { id: 1, embedding: [0, 1, 0] },
    ];
    expect(vectorRank(query, corpus)).toHaveLength(2);
  });

  it("returns an empty ranking for an empty corpus (no crash)", () => {
    expect(vectorRank([1, 0, 0], [])).toEqual([]);
  });
});
