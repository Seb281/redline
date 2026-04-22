/**
 * SP-10 Arc 1 Phase 3 — Okapi BM25 lexical retriever.
 *
 * References:
 *   - Robertson & Zaragoza (2009), "The Probabilistic Relevance Framework:
 *     BM25 and Beyond."
 *   - Lucene defaults: k1 = 1.5, b = 0.75 (chosen because that is what
 *     every consumer of this module is implicitly benchmarked against).
 *
 * Scope:
 *   - Ranking only. Absolute scores depend on corpus statistics and are
 *     not stable across refactors; tests must assert order, not value.
 *   - No stemming, no stopword list. Legal corpora mix short words with
 *     real semantic weight ("of", "in", section/article tokens) — a
 *     stopword list tuned for web-search prose would strip those. The
 *     hybrid retriever compensates for the resulting noise via the
 *     semantic branch.
 *   - Token length floor of 2 drops single-character punctuation splits
 *     (e.g. a stray "§" left over after a `§ 307` split becomes "307"
 *     which we keep, while the separator character itself is discarded).
 */

/** One document in the BM25 corpus. `id` is any stable handle. */
export interface BM25Doc {
  id: number;
  text: string;
}

/** BM25 scoring result for a single document. */
export interface BM25Result {
  id: number;
  score: number;
}

const K1 = 1.5;
const B = 0.75;

/**
 * Split a string into lowercase tokens for BM25. Alphanumerics survive
 * (including legal-reference digits like "307" from "§307"); everything
 * else is treated as a separator. Tokens shorter than 2 characters are
 * dropped as punctuation noise.
 */
export function tokenizeBm25(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
}

/**
 * Rank a corpus by Okapi BM25 against a free-text query.
 *
 * Always returns one entry per input doc (zero-score for docs that
 * share no query term with the query) so downstream fusion can rely on
 * complete coverage without a separate "absent" signal.
 */
export function bm25Rank(query: string, corpus: BM25Doc[]): BM25Result[] {
  const queryTokens = tokenizeBm25(query);
  if (queryTokens.length === 0 || corpus.length === 0) {
    return corpus.map((d) => ({ id: d.id, score: 0 }));
  }

  const docTokens = corpus.map((d) => tokenizeBm25(d.text));
  const docLengths = docTokens.map((t) => t.length);
  const totalLen = docLengths.reduce((a, b) => a + b, 0);
  // Guard against a corpus of empty-text docs — bm25 has no defined
  // behaviour there; return zeroes rather than divide by zero.
  const avgdl = totalLen === 0 ? 1 : totalLen / corpus.length;
  const N = corpus.length;

  const df = new Map<string, number>();
  for (const tokens of docTokens) {
    const seen = new Set(tokens);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }

  // Robertson-Spärck-Jones IDF with the +1 additive smoothing Lucene uses.
  // log((N - df + 0.5) / (df + 0.5) + 1) — strictly positive for any df.
  const idf = (term: string): number => {
    const n = df.get(term) ?? 0;
    return Math.log((N - n + 0.5) / (n + 0.5) + 1);
  };

  const uniqueQueryTerms = Array.from(new Set(queryTokens));

  const scored = corpus.map((doc, i) => {
    const tokens = docTokens[i];
    if (tokens.length === 0) return { id: doc.id, score: 0 };
    const dl = docLengths[i];
    const tfMap = new Map<string, number>();
    for (const t of tokens) tfMap.set(t, (tfMap.get(t) ?? 0) + 1);

    let score = 0;
    for (const term of uniqueQueryTerms) {
      const tf = tfMap.get(term) ?? 0;
      if (tf === 0) continue;
      const num = tf * (K1 + 1);
      const denom = tf + K1 * (1 - B + (B * dl) / avgdl);
      score += idf(term) * (num / denom);
    }
    return { id: doc.id, score };
  });

  // Stable sort by descending score; equal scores preserve corpus order
  // so the "all-zero" edge case stays deterministic for tests.
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
