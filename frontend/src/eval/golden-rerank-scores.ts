/**
 * SP-10 Arc 2 Task 2.3 — loader for frozen Jina rerank scores.
 *
 * The eval harness needs to run Jina reranking deterministically in
 * CI, without hitting the live API on every run. Mirrors
 * `golden-queries.ts`: a checked-in JSON cache keyed by the stable
 * question id, produced by `golden-rerank-scores.freeze.test.ts`
 * against a live `JINA_API_KEY`.
 *
 * Cache shape: `{ [questionId]: { [clauseIndex]: relevance_score } }`.
 * Clause indices are positional within the matching fixture's frozen
 * `clauses` array — the same index space the golden-question
 * `expected_clause_indices` + `buildHybridCandidates` ids use.
 *
 * Design tenets:
 *   - **Freeze everything the reranker would see.** The harness may
 *     route any subset of a fixture's clauses through the reranker at
 *     runtime; freezing scores for the full clause list means no
 *     second live call is ever needed.
 *   - **Degrade to a no-op RerankFn when the cache is missing.** A
 *     fresh checkout without `JINA_API_KEY` should still run the full
 *     eval harness green; the `hybrid_rerank` describe block skips.
 *   - **No partial cache reads.** A present-but-incomplete cache is
 *     treated as a hard error — the freeze harness is expected to
 *     produce a score for every golden question, and silently missing
 *     entries would mask regressions.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RerankFn } from "@/lib/retrieval/rerank";

const DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(DIR, "golden-rerank-scores.json");

/** Shape of the checked-in cache on disk. */
export interface GoldenRerankCache {
  /** ISO date of the freeze run. */
  generated_at: string;
  /** Snapshot model id — pinned in sync with `JINA_MODEL`. */
  model: string;
  /** question id → (clauseId → relevance_score). */
  scores: Record<string, Record<string, number>>;
}

/** Absolute path to the cache file. Used by the freeze harness too. */
export function goldenRerankCachePath(): string {
  return CACHE_PATH;
}

/** True iff the cache file is on disk. */
export function goldenRerankCacheExists(): boolean {
  return existsSync(CACHE_PATH);
}

/**
 * Parse the cache from disk. Returns `null` when the file is missing
 * so callers can gate tests cleanly (mirrors `loadGoldenQueryCache`).
 */
export function loadGoldenRerankCache(): GoldenRerankCache | null {
  if (!existsSync(CACHE_PATH)) return null;
  const raw = readFileSync(CACHE_PATH, "utf8");
  return JSON.parse(raw) as GoldenRerankCache;
}

/**
 * Build a deterministic `RerankFn` backed by the frozen score cache
 * for a given question id. The returned fn ignores the `query` field
 * (the cache was captured with the golden question text already) and
 * returns the cached score for each candidate id, sorting descending.
 *
 * Candidates without a cached score fall back to `0` — this keeps the
 * call fail-soft on minor cache/fixture drift without throwing, at the
 * cost of masking some signal. The freeze harness writes scores for
 * every clause in the fixture, so a zero here is genuinely a bug, not
 * an expected state.
 */
export function buildCachedReranker(
  cache: GoldenRerankCache,
  questionId: string,
): RerankFn {
  const scores = cache.scores[questionId] ?? {};
  return async ({ candidates, topN }) => {
    const ranked = candidates
      .map((c) => ({ id: c.id, score: scores[String(c.id)] ?? 0 }))
      .sort((a, b) => b.score - a.score);
    return typeof topN === "number" ? ranked.slice(0, topN) : ranked;
  };
}
