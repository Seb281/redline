/**
 * SP-10 Arc 3 Task 3.5 — cross-doc query embedding freeze harness.
 *
 * Mirror of ``golden-query-embeddings.freeze.test.ts`` but for the
 * 24-question cross-contract set. Embeds every entry via
 * ``mistral-embed`` and writes the vectors to
 * ``src/eval/cross-doc-query-embeddings.json``. That file is committed
 * so the cross-doc CI gate in ``cross-doc-harness.test.ts`` runs
 * deterministically on a fresh checkout without an API key.
 *
 * Opt-in: runs only when BOTH ``FREEZE_CROSS_DOC_QUERY_EMBEDDINGS=1``
 * and ``MISTRAL_API_KEY`` are present. Default ``pnpm test`` skips.
 *
 * Usage:
 *   cd frontend
 *   FREEZE_CROSS_DOC_QUERY_EMBEDDINGS=1 \
 *     MISTRAL_API_KEY=$(grep MISTRAL_API_KEY .env.local | cut -d= -f2) \
 *     pnpm vitest run src/eval/cross-doc-query-embeddings.freeze.test.ts
 *
 * Re-freeze every time the cross-doc set changes — the harness fails
 * fast when any question id is missing from the cache.
 */

import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { embedMany } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { CROSS_DOC_QUESTIONS } from "./cross-doc-questions";
import { MISTRAL_EMBED_DIM } from "@/types";
import { crossDocQueryCachePath } from "./cross-doc-queries";

const SHOULD_RUN =
  process.env.FREEZE_CROSS_DOC_QUERY_EMBEDDINGS === "1" &&
  Boolean(process.env.MISTRAL_API_KEY);
const MODEL_ID = "mistral-embed";
// 24 entries in one batch — 30s is a comfortable ceiling.
const TIMEOUT_MS = 60_000;

const describeIfFreeze = SHOULD_RUN ? describe : describe.skip;

describeIfFreeze("cross-doc query embeddings freeze harness", () => {
  it(
    "embeds every cross-doc question and writes the cache",
    async () => {
      const values = CROSS_DOC_QUESTIONS.map((q) => q.question);
      const { embeddings } = await embedMany({
        model: mistral.embedding(MODEL_ID),
        values,
      });
      expect(embeddings).toHaveLength(CROSS_DOC_QUESTIONS.length);

      const out: Record<string, number[]> = {};
      embeddings.forEach((vec, i) => {
        expect(Array.isArray(vec), `question ${i} non-array embedding`).toBe(true);
        expect(vec.length, `question ${i} wrong dim`).toBe(MISTRAL_EMBED_DIM);
        out[CROSS_DOC_QUESTIONS[i].id] = vec;
      });

      const cache = {
        generated_at: new Date().toISOString().slice(0, 10),
        model: MODEL_ID,
        dim: MISTRAL_EMBED_DIM,
        embeddings: out,
      };
      writeFileSync(
        crossDocQueryCachePath(),
        `${JSON.stringify(cache, null, 2)}\n`,
        "utf8",
      );
    },
    TIMEOUT_MS,
  );
});
