/**
 * SP-10 Arc 1 Phase 3 — BM25 lexical retriever tests.
 *
 * BM25 is Okapi BM25 (Robertson & Zaragoza 2009) with Lucene defaults
 * k1=1.5, b=0.75. We test *ranking* behaviour (rare terms beat common
 * terms; high-TF clauses beat low-TF clauses; documents without any
 * query term get zero), not absolute scores — score magnitudes depend
 * on corpus statistics and are not stable across refactors.
 */

import { describe, it, expect } from "vitest";
import { bm25Rank, tokenizeBm25, type BM25Doc } from "./bm25";

function doc(id: number, text: string): BM25Doc {
  return { id, text };
}

describe("tokenizeBm25", () => {
  it("lowercases and strips punctuation while preserving §/art-style legal markers", () => {
    const tokens = tokenizeBm25("BGB §307 — Late-fee (5%)");
    // Splits on whitespace / non-alphanumeric; keeps legal-reference text.
    expect(tokens).toContain("bgb");
    expect(tokens).toContain("307");
    expect(tokens).toContain("late");
    expect(tokens).toContain("fee");
  });

  it("filters out stopwords-tier very-short tokens (len < 2)", () => {
    const tokens = tokenizeBm25("a an of if the is in");
    // Keep "an", "of", "if"… in legal text short words matter; we only
    // drop single-char noise from punctuation splits.
    expect(tokens).not.toContain("");
    expect(tokens.every((t) => t.length >= 2)).toBe(true);
  });

  it("returns an empty list for empty input", () => {
    expect(tokenizeBm25("")).toEqual([]);
  });
});

describe("bm25Rank", () => {
  it("returns zero-score for docs that share no query term", () => {
    const corpus = [doc(0, "payment terms"), doc(1, "confidentiality")];
    const ranked = bm25Rank("non-compete restriction", corpus);
    expect(ranked.every((r) => r.score === 0)).toBe(true);
  });

  it("ranks the doc containing the query term above one that doesn't", () => {
    const corpus = [
      doc(0, "The tenant shall pay rent on the first of each month."),
      doc(1, "Non-compete restriction for 18 months across the EU."),
      doc(2, "Either party may terminate with 60 days notice."),
    ];
    const ranked = bm25Rank("non-compete", corpus);
    // Only doc 1 mentions "non-compete"; it must rank first.
    expect(ranked[0].id).toBe(1);
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("prefers documents with higher term frequency when IDF ties", () => {
    const corpus = [
      doc(0, "rent rent rent payment"),
      doc(1, "rent once"),
      doc(2, "rent payment"),
    ];
    const ranked = bm25Rank("rent", corpus);
    expect(ranked[0].id).toBe(0);
  });

  it("weights rare terms higher via IDF", () => {
    // "agreement" is in every doc → low IDF; "pgvector" is unique → high IDF.
    const corpus = [
      doc(0, "agreement pgvector"),
      doc(1, "agreement common term"),
      doc(2, "agreement another"),
    ];
    const ranked = bm25Rank("pgvector agreement", corpus);
    expect(ranked[0].id).toBe(0);
  });

  it("preserves rank order in the output (most relevant first)", () => {
    const corpus = [
      doc(0, "alpha beta"),
      doc(1, "alpha alpha beta"),
      doc(2, "beta"),
    ];
    const ranked = bm25Rank("alpha", corpus);
    // More 'alpha' occurrences ranks higher.
    expect(ranked[0].id).toBe(1);
    expect(ranked[1].id).toBe(0);
  });

  it("handles a one-doc corpus without dividing by zero", () => {
    const corpus = [doc(0, "only one document here")];
    const ranked = bm25Rank("document", corpus);
    expect(ranked).toHaveLength(1);
    expect(Number.isFinite(ranked[0].score)).toBe(true);
  });

  it("returns an empty ranking for an empty query", () => {
    const corpus = [doc(0, "something")];
    expect(bm25Rank("", corpus)).toEqual([{ id: 0, score: 0 }]);
  });
});
