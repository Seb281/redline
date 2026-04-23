/**
 * SP-10 Arc 2 Task 2.1 — additive metadata boost on fused RRF scores.
 *
 * Boost is additive so the baseline ordering from BM25 ∥ cosine survives
 * when query hints are empty or irrelevant. Magnitudes are calibrated
 * below the RRF@rank-1 contribution (~0.0164) so metadata can promote
 * near-miss clauses but cannot override two retrievers agreeing a doc is
 * irrelevant.
 */

import { describe, it, expect } from "vitest";
import {
  applyMetadataBoost,
  CATEGORY_BOOST,
  STATUTE_BOOST,
  type CandidateMetadata,
} from "./metadata-boost";
import type { QueryHints } from "./query-analysis";

const emptyHints: QueryHints = { categories: new Set(), statuteCodes: new Set() };

describe("applyMetadataBoost", () => {
  it("is a no-op when hints are empty", () => {
    const fused = [
      { id: 0, score: 0.02 },
      { id: 1, score: 0.015 },
    ];
    const metadata = new Map<number, CandidateMetadata>([
      [0, { category: "liability", statuteCodes: ["EU_GDPR"] }],
      [1, { category: "termination", statuteCodes: [] }],
    ]);
    const boosted = applyMetadataBoost(fused, metadata, emptyHints);
    expect(boosted.map((r) => r.id)).toEqual([0, 1]);
    expect(boosted[0].score).toBeCloseTo(0.02, 5);
    expect(boosted[1].score).toBeCloseTo(0.015, 5);
  });

  it("promotes a GDPR-citing clause over a non-citing clause on a GDPR query", () => {
    // Gap: clause 1 leads by 0.005 on fused RRF. Clause 0 gains
    // STATUTE_BOOST + CATEGORY_BOOST; as long as the sum exceeds the
    // gap (true for any shipped non-zero STATUTE_BOOST at current
    // magnitudes), 0 should pass 1.
    const gap = 0.005;
    const fused = [
      { id: 1, score: 0.02 },
      { id: 0, score: 0.02 - gap },
    ];
    const metadata = new Map<number, CandidateMetadata>([
      [0, { category: "data_protection", statuteCodes: ["EU_GDPR"] }],
      [1, { category: "payment_terms", statuteCodes: [] }],
    ]);
    const hints: QueryHints = {
      categories: new Set(["data_protection"]),
      statuteCodes: new Set(["EU_GDPR"]),
    };
    const boosted = applyMetadataBoost(fused, metadata, hints);
    if (STATUTE_BOOST + CATEGORY_BOOST > gap) {
      expect(boosted[0].id).toBe(0);
      expect(boosted[0].score).toBeGreaterThan(boosted[1].score);
    } else {
      expect(boosted[0].id).toBe(1);
    }
  });

  it("applies only the statute boost when the query lacks a category hint", () => {
    const gap = 0.001;
    const fused = [
      { id: 0, score: 0.015 },
      { id: 1, score: 0.015 - gap },
    ];
    const metadata = new Map<number, CandidateMetadata>([
      [0, { category: "liability", statuteCodes: [] }],
      [1, { category: "liability", statuteCodes: ["EU_GDPR"] }],
    ]);
    const hints: QueryHints = {
      categories: new Set(),
      statuteCodes: new Set(["EU_GDPR"]),
    };
    const boosted = applyMetadataBoost(fused, metadata, hints);
    if (STATUTE_BOOST > gap) {
      expect(boosted[0].id).toBe(1);
    } else {
      expect(boosted[0].id).toBe(0);
    }
  });

  it("applies only the category boost when the query lacks a statute hint", () => {
    const gap = 0.001;
    const fused = [
      { id: 0, score: 0.015 },
      { id: 1, score: 0.015 - gap },
    ];
    const metadata = new Map<number, CandidateMetadata>([
      [0, { category: "payment_terms", statuteCodes: [] }],
      [1, { category: "termination", statuteCodes: [] }],
    ]);
    const hints: QueryHints = {
      categories: new Set(["termination"]),
      statuteCodes: new Set(),
    };
    const boosted = applyMetadataBoost(fused, metadata, hints);
    if (CATEGORY_BOOST > gap) {
      expect(boosted[0].id).toBe(1);
    } else {
      // Shipped default: CATEGORY_BOOST = 0 (eval showed category is
      // too coarse on single-contract retrieval). Ordering preserved.
      expect(boosted[0].id).toBe(0);
    }
  });

  it("does not double-count multiple statute hits on the same clause", () => {
    const fused = [{ id: 0, score: 0.02 }];
    const metadata = new Map<number, CandidateMetadata>([
      [0, { category: "liability", statuteCodes: ["DE_BGB_307", "DE_BGB_276"] }],
    ]);
    const hints: QueryHints = {
      categories: new Set(),
      statuteCodes: new Set(["DE_BGB_307", "DE_BGB_276"]),
    };
    const boosted = applyMetadataBoost(fused, metadata, hints);
    // Only one statute-boost increment, regardless of how many matches.
    expect(boosted[0].score).toBeCloseTo(0.02 + 0.01, 5);
  });

  it("never reorders clauses where the boost is smaller than the baseline gap", () => {
    const fused = [
      { id: 0, score: 0.05 }, // strong RRF hit, no metadata
      { id: 1, score: 0.01 }, // weak RRF hit, statute match
    ];
    const metadata = new Map<number, CandidateMetadata>([
      [0, { category: "liability", statuteCodes: [] }],
      [1, { category: "liability", statuteCodes: ["EU_GDPR"] }],
    ]);
    const hints: QueryHints = {
      categories: new Set(),
      statuteCodes: new Set(["EU_GDPR"]),
    };
    const boosted = applyMetadataBoost(fused, metadata, hints);
    expect(boosted[0].id).toBe(0);
    // Clause 1 still gets its +0.010 — the ordering just holds.
    expect(boosted[1].score).toBeCloseTo(0.02, 5);
  });

  it("silently skips clauses missing from the metadata map", () => {
    const fused = [
      { id: 0, score: 0.02 },
      { id: 1, score: 0.015 },
    ];
    const metadata = new Map<number, CandidateMetadata>([
      [0, { category: "data_protection", statuteCodes: ["EU_GDPR"] }],
      // id 1 deliberately absent — simulates legacy row / missing meta.
    ]);
    const hints: QueryHints = {
      categories: new Set(["data_protection"]),
      statuteCodes: new Set(["EU_GDPR"]),
    };
    const boosted = applyMetadataBoost(fused, metadata, hints);
    expect(boosted[0].id).toBe(0);
    expect(boosted[1].score).toBeCloseTo(0.015, 5);
  });

  it("produces a new array, does not mutate the input", () => {
    const fused = [
      { id: 0, score: 0.02 },
      { id: 1, score: 0.015 },
    ];
    const metadata = new Map<number, CandidateMetadata>([
      [0, { category: "data_protection", statuteCodes: [] }],
      [1, { category: "payment_terms", statuteCodes: [] }],
    ]);
    const hints: QueryHints = {
      categories: new Set(["data_protection"]),
      statuteCodes: new Set(),
    };
    const before = JSON.stringify(fused);
    applyMetadataBoost(fused, metadata, hints);
    expect(JSON.stringify(fused)).toBe(before);
  });
});
