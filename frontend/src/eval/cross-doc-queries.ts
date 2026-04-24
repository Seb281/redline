/**
 * SP-10 Arc 3 Task 3.5 — loader for the cross-doc query-embedding cache.
 *
 * Mirror of ``golden-queries.ts`` but keyed on the 24 cross-contract
 * golden questions. Sync fs read of a checked-in JSON artifact so the
 * harness CI gate runs deterministic + offline on a fresh checkout.
 *
 * The cache is produced by ``cross-doc-query-embeddings.freeze.test.ts``
 * against a live Mistral key; committing it means ``pnpm test`` needs
 * no API credentials to run the cross-doc numbers.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MISTRAL_EMBED_DIM } from "@/types";

const DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(DIR, "cross-doc-query-embeddings.json");

/** Shape of the checked-in cross-doc cache on disk. */
export interface CrossDocQueryCache {
  generated_at: string;
  model: string;
  dim: number;
  /** question id → embedding vector. */
  embeddings: Record<string, number[]>;
}

/** Absolute path to the cross-doc cache file. Used by the freeze harness too. */
export function crossDocQueryCachePath(): string {
  return CACHE_PATH;
}

/** True iff the cross-doc cache file is on disk. */
export function crossDocQueryCacheExists(): boolean {
  return existsSync(CACHE_PATH);
}

/**
 * Parse the cross-doc cache from disk. Returns ``null`` when the file
 * is missing so callers can gate tests cleanly on a fresh clone without
 * the committed artifact.
 */
export function loadCrossDocQueryCache(): CrossDocQueryCache | null {
  if (!existsSync(CACHE_PATH)) return null;
  const raw = readFileSync(CACHE_PATH, "utf8");
  const parsed = JSON.parse(raw) as CrossDocQueryCache;
  if (parsed.dim !== MISTRAL_EMBED_DIM) {
    throw new Error(
      `cross-doc-query-embeddings.json: dim ${parsed.dim} does not match MISTRAL_EMBED_DIM ${MISTRAL_EMBED_DIM} — re-freeze required`,
    );
  }
  return parsed;
}

/**
 * Materialise the cache as a ``Map<id, embedding>`` — the shape the
 * cross-doc harness consumes directly. Returns an empty map when the
 * cache is missing; the harness then skips its CI gate.
 */
export function crossDocQueryEmbeddingMap(): Map<string, number[]> {
  const cache = loadCrossDocQueryCache();
  if (!cache) return new Map();
  return new Map(Object.entries(cache.embeddings));
}
