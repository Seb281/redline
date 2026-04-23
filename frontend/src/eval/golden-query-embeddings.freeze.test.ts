/**
 * SP-10 Arc 1 Phase 4b — golden-query embedding freeze harness.
 *
 * Mirror of `fixtures/freeze.test.ts` but for the question side:
 * embeds every entry in the golden set via `mistral-embed` and writes
 * the vectors to `src/eval/golden-query-embeddings.json`. That file
 * is committed so the hybrid CI gate in `harness.test.ts` runs
 * deterministically on a fresh checkout without an API key.
 *
 * Opt-in: runs only when BOTH `FREEZE_GOLDEN_QUERY_EMBEDDINGS=1` and
 * `MISTRAL_API_KEY` are present. Default `pnpm test` skips this file.
 *
 * Usage:
 *   cd frontend
 *   FREEZE_GOLDEN_QUERY_EMBEDDINGS=1 \
 *     MISTRAL_API_KEY=$(grep MISTRAL_API_KEY .env.local | cut -d= -f2) \
 *     pnpm vitest run src/eval/golden-query-embeddings.freeze.test.ts
 *
 * Re-freeze every time the golden set changes. The structural
 * tripwire (`golden-queries.test.ts`) fails fast when any question id
 * is missing from the cache.
 */

import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { embedMany } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { GOLDEN_QUESTIONS } from "./golden-questions";
import { MISTRAL_EMBED_DIM } from "@/types";
import { goldenQueryCachePath } from "./golden-queries";

const SHOULD_RUN =
  process.env.FREEZE_GOLDEN_QUERY_EMBEDDINGS === "1" &&
  Boolean(process.env.MISTRAL_API_KEY);
const MODEL_ID = "mistral-embed";
// One batch call for 48 entries is quick — 30s is a comfortable
// ceiling that still catches a stuck connection.
const TIMEOUT_MS = 60_000;

const describeIfFreeze = SHOULD_RUN ? describe : describe.skip;

describeIfFreeze("golden query embeddings freeze harness", () => {
  it(
    "embeds every golden question and writes the cache",
    async () => {
      const values = GOLDEN_QUESTIONS.map((q) => q.question);
      const { embeddings } = await embedMany({
        model: mistral.embedding(MODEL_ID),
        values,
      });
      expect(embeddings).toHaveLength(GOLDEN_QUESTIONS.length);

      const out: Record<string, number[]> = {};
      embeddings.forEach((vec, i) => {
        expect(Array.isArray(vec), `question ${i} non-array embedding`).toBe(true);
        expect(vec.length, `question ${i} wrong dim`).toBe(MISTRAL_EMBED_DIM);
        out[GOLDEN_QUESTIONS[i].id] = vec;
      });

      const cache = {
        generated_at: new Date().toISOString().slice(0, 10),
        model: MODEL_ID,
        dim: MISTRAL_EMBED_DIM,
        embeddings: out,
      };
      writeFileSync(
        goldenQueryCachePath(),
        `${JSON.stringify(cache, null, 2)}\n`,
        "utf8",
      );
    },
    TIMEOUT_MS,
  );
});
