/**
 * SP-10 Arc 1 Phase 4b — frozen query-embedding tripwire.
 *
 * Runs only when the cache file is on disk; stays silent on a fresh
 * checkout so the regular `pnpm test` path is still green before
 * anyone has run the freeze harness. Once the file is committed this
 * test is the brake that prevents the hybrid CI gate from silently
 * degrading to BM25 due to a stray stale id or a wrong-dim vector.
 */
import { describe, it, expect } from "vitest";
import { GOLDEN_QUESTIONS } from "./golden-questions";
import {
  goldenQueryCacheExists,
  loadGoldenQueryCache,
} from "./golden-queries";
import { MISTRAL_EMBED_DIM } from "@/types";

const describeIfCached = goldenQueryCacheExists() ? describe : describe.skip;

describeIfCached("golden query embeddings cache", () => {
  it("covers every golden question with a correctly-sized vector", () => {
    const cache = loadGoldenQueryCache();
    expect(cache, "cache exists but failed to parse").not.toBeNull();
    if (!cache) return;
    expect(cache.model).toBe("mistral-embed");
    expect(cache.dim).toBe(MISTRAL_EMBED_DIM);
    for (const q of GOLDEN_QUESTIONS) {
      const vec = cache.embeddings[q.id];
      expect(vec, `${q.id} missing embedding — re-run freeze harness`).toBeDefined();
      expect(vec.length, `${q.id} wrong dim ${vec?.length}`).toBe(MISTRAL_EMBED_DIM);
    }
  });

  it("has no stray entries beyond the golden set", () => {
    const cache = loadGoldenQueryCache();
    if (!cache) return;
    const goldenIds = new Set(GOLDEN_QUESTIONS.map((q) => q.id));
    for (const id of Object.keys(cache.embeddings)) {
      expect(goldenIds.has(id), `stray entry in cache: ${id}`).toBe(true);
    }
  });

  it("records generated_at as an ISO date", () => {
    const cache = loadGoldenQueryCache();
    if (!cache) return;
    expect(cache.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
