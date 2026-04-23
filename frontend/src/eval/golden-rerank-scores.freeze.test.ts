/**
 * SP-10 Arc 2 Task 2.3 — Jina rerank score freeze harness.
 *
 * Mirror of `golden-query-embeddings.freeze.test.ts` but for rerank
 * output: calls Jina's `/v1/rerank` endpoint once per golden question
 * against every clause in its fixture and writes the resulting scores
 * to `src/eval/golden-rerank-scores.json`. That file is committed so
 * the `hybrid_rerank` CI block in `harness.test.ts` runs deterministic
 * on a fresh checkout without `JINA_API_KEY`.
 *
 * Opt-in: runs only when BOTH `FREEZE_GOLDEN_RERANK_SCORES=1` and
 * `JINA_API_KEY` are present. Default `pnpm test` skips this file.
 *
 * Usage:
 *   cd frontend
 *   FREEZE_GOLDEN_RERANK_SCORES=1 \
 *     JINA_API_KEY=$(grep JINA_API_KEY .env.local | cut -d= -f2) \
 *     pnpm vitest run src/eval/golden-rerank-scores.freeze.test.ts
 *
 * Re-freeze whenever the golden set or any fixture's clause ordering
 * changes — indices are positional, so a shifted clause silently
 * invalidates every cached score for that fixture. The `hybrid_rerank`
 * baseline row should be re-captured in the same PR.
 */

import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { GOLDEN_QUESTIONS } from "./golden-questions";
import { FIXTURES } from "./fixtures/manifest";
import { loadFixture } from "./fixtures/load";
import {
  createJinaReranker,
  type RerankCandidate,
} from "@/lib/retrieval/rerank";
import { goldenRerankCachePath } from "./golden-rerank-scores";

const SHOULD_RUN =
  process.env.FREEZE_GOLDEN_RERANK_SCORES === "1" &&
  Boolean(process.env.JINA_API_KEY);

// 48 sequential Jina calls — with retry budget + modest p99, five
// minutes is a safe ceiling. Parallelising would be faster but risks
// tripping Jina rate limits; serial keeps the run reproducible.
const TIMEOUT_MS = 300_000;
const MODEL_PIN = "jina-reranker-v2-base-multilingual";

const describeIfFreeze = SHOULD_RUN ? describe : describe.skip;

describeIfFreeze("golden rerank scores freeze harness", () => {
  it(
    "reranks every golden question against its fixture and writes the cache",
    async () => {
      const apiKey = process.env.JINA_API_KEY;
      if (!apiKey) throw new Error("JINA_API_KEY missing at freeze time");

      const rerank = createJinaReranker({ apiKey });
      const fixtureSlugs = new Set(FIXTURES.map((f) => f.slug));

      const out: Record<string, Record<string, number>> = {};
      for (const q of GOLDEN_QUESTIONS) {
        expect(
          fixtureSlugs.has(q.fixture),
          `golden question ${q.id} refs unknown fixture ${q.fixture}`,
        ).toBe(true);
        const fixture = loadFixture(q.fixture);
        const candidates: RerankCandidate[] = fixture.clauses.map((c, i) => ({
          id: i,
          text: c.text,
        }));
        // topN omitted → Jina returns scores for every clause, which
        // is what we need in the cache: the eval harness may hand the
        // reranker any subset of these ids at query time.
        const ranked = await rerank({ query: q.question, candidates });
        expect(
          ranked.length,
          `question ${q.id}: rerank returned empty — check JINA_API_KEY or model pin`,
        ).toBeGreaterThan(0);

        const scoresById: Record<string, number> = {};
        for (const r of ranked) scoresById[String(r.id)] = r.score;
        out[q.id] = scoresById;
      }

      const cache = {
        generated_at: new Date().toISOString().slice(0, 10),
        model: MODEL_PIN,
        scores: out,
      };
      writeFileSync(
        goldenRerankCachePath(),
        `${JSON.stringify(cache, null, 2)}\n`,
        "utf8",
      );
    },
    TIMEOUT_MS,
  );
});
