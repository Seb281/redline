/**
 * SP-10 Arc 1 Phase 3 — Reciprocal Rank Fusion tests.
 *
 * RRF per Cormack et al. 2009:
 *   rrf(d) = sum over retrievers i of: 1 / (k + r_i)
 * with r_i the 1-indexed rank of d in retriever i, or ∞ if absent.
 * We use k=60 by default (paper's choice, strong across corpora).
 */

import { describe, it, expect } from "vitest";
import { reciprocalRankFusion } from "./fusion";

describe("reciprocalRankFusion", () => {
  it("fuses two rankings into a single rank list", () => {
    const a = [1, 2, 3];
    const b = [3, 1, 2];
    const fused = reciprocalRankFusion([a, b]);
    // Doc 1: (1/61) + (1/62) ≈ 0.03245
    // Doc 3: (1/63) + (1/61) ≈ 0.03228
    // Doc 2: (1/62) + (1/63) ≈ 0.03200
    expect(fused[0].id).toBe(1);
    expect(fused[1].id).toBe(3);
    expect(fused[2].id).toBe(2);
  });

  it("gives a higher fused score to a doc that appears in both lists than to one appearing in only one", () => {
    const a = [1, 2];
    const b = [2];
    const fused = reciprocalRankFusion([a, b]);
    const doc2 = fused.find((r) => r.id === 2)!;
    const doc1 = fused.find((r) => r.id === 1)!;
    expect(doc2.score).toBeGreaterThan(doc1.score);
  });

  it("treats absent rankings as rank infinity (contribute zero)", () => {
    // Doc 99 is only in the first list; its fused score should match a
    // single-retriever RRF score with k=60, rank=1 → 1/61.
    const fused = reciprocalRankFusion([[99], [1]]);
    const doc99 = fused.find((r) => r.id === 99)!;
    expect(doc99.score).toBeCloseTo(1 / 61, 6);
  });

  it("accepts a custom k and respects it", () => {
    const fused = reciprocalRankFusion([[1]], { k: 10 });
    expect(fused[0].score).toBeCloseTo(1 / 11, 6);
  });

  it("returns an empty list when all rankings are empty", () => {
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });

  it("deduplicates docs: a single entry appears once even across multiple retrievers", () => {
    const fused = reciprocalRankFusion([[1, 2], [1, 2]]);
    const ids = fused.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
