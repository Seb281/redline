/**
 * SP-10 Arc 1 Phase 4b — loader for the frozen golden-query embeddings.
 *
 * Mirrors `fixtures/load.ts` in spirit: sync fs read of a checked-in
 * JSON artifact, typed accessors, and a presence check so the eval
 * harness can degrade cleanly when the cache is missing (fresh
 * checkout, hand-edited golden set awaiting re-freeze, etc.).
 *
 * The cache is produced by `golden-query-embeddings.freeze.test.ts`
 * against a live Mistral key; committing it keeps the hybrid CI gate
 * deterministic without requiring an API call on every run.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MISTRAL_EMBED_DIM } from "@/types";

const DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(DIR, "golden-query-embeddings.json");

/** Shape of the checked-in cache on disk. */
export interface GoldenQueryCache {
  /** ISO date of the freeze run. */
  generated_at: string;
  /** Snapshot model id (should be pinned — `mistral-embed`). */
  model: string;
  /** Embedding dimension at freeze time (must match `MISTRAL_EMBED_DIM`). */
  dim: number;
  /** question id → embedding vector. */
  embeddings: Record<string, number[]>;
}

/** Absolute path to the cache file. Used by the freeze harness too. */
export function goldenQueryCachePath(): string {
  return CACHE_PATH;
}

/** True iff the cache file is on disk. */
export function goldenQueryCacheExists(): boolean {
  return existsSync(CACHE_PATH);
}

/**
 * Parse the cache from disk. Returns `null` when the file is missing
 * so callers can gate tests cleanly (mirrors the `availableFixtureSlugs`
 * pattern).
 */
export function loadGoldenQueryCache(): GoldenQueryCache | null {
  if (!existsSync(CACHE_PATH)) return null;
  const raw = readFileSync(CACHE_PATH, "utf8");
  const parsed = JSON.parse(raw) as GoldenQueryCache;
  if (parsed.dim !== MISTRAL_EMBED_DIM) {
    throw new Error(
      `golden-query-embeddings.json: dim ${parsed.dim} does not match MISTRAL_EMBED_DIM ${MISTRAL_EMBED_DIM} — re-freeze required`,
    );
  }
  return parsed;
}

/**
 * Materialise the cache as a `Map<id, embedding>` — the shape the
 * hybrid retriever factory in `retrievers.ts` consumes directly.
 * Returns an empty map when the cache is missing; downstream
 * `makeHybridRetriever` degrades to BM25 for questions without a hit.
 */
export function goldenQueryEmbeddingMap(): Map<string, number[]> {
  const cache = loadGoldenQueryCache();
  if (!cache) return new Map();
  return new Map(Object.entries(cache.embeddings));
}
