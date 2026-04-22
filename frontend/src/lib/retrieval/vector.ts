/**
 * SP-10 Arc 1 Phase 3 — cosine-similarity vector retriever.
 *
 * In-memory mirror of pgvector's `<=>` distance operator (similarity =
 * 1 - distance). Lives frontend-side so anonymous sessions can run the
 * semantic branch over in-browser embeddings without hitting the
 * backend. pgvector remains the authority for persisted analyses; the
 * ranking produced here is mathematically identical within floating
 * point tolerance.
 */

/** One entry in the vector corpus. `embedding` is assumed non-empty. */
export interface VectorDoc {
  id: number;
  embedding: number[];
}

/** Cosine-similarity scoring result for a single document. */
export interface VectorResult {
  id: number;
  score: number;
}

/**
 * Cosine similarity between two equal-length numeric vectors.
 *
 * Returns 0 if either input is the zero vector — the alternative (NaN
 * from 0/0) would poison downstream sorts silently. Throws on
 * dimension mismatch because that is a programmer error: analysis-side
 * embeddings and query embeddings are always produced by the same
 * model and must share a dimensionality.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `cosineSimilarity: dimension mismatch (${a.length} vs ${b.length})`,
    );
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Rank a corpus by cosine similarity to the query vector, most-similar
 * first. Returns one entry per input doc (no filtering) so downstream
 * fusion has total coverage.
 */
export function vectorRank(query: number[], corpus: VectorDoc[]): VectorResult[] {
  if (corpus.length === 0) return [];
  const scored = corpus.map((d) => ({
    id: d.id,
    score: cosineSimilarity(query, d.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
