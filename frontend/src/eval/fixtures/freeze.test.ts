/**
 * SP-10 Arc 1 Phase 4 — fixture freeze harness.
 *
 * Opt-in: runs only when BOTH `FREEZE_FIXTURES=1` and `MISTRAL_API_KEY`
 * are present in the environment. The default test path (`pnpm test`)
 * skips this file entirely so CI without a key stays green.
 *
 * Purpose: run the full Pass 0 → Pass 1 → Pass 2 pipeline against each
 * sample contract with a live Mistral key and serialise the resulting
 * `AnalyzeResponse` to `src/eval/fixtures/{slug}.json`. The JSON files
 * are checked-in as the ground truth for all subsequent retrieval
 * evals, so the evals are isolated from pipeline non-determinism.
 *
 * Usage:
 *   cd frontend
 *   FREEZE_FIXTURES=1 \
 *     MISTRAL_API_KEY=$(grep MISTRAL_API_KEY .env.local | cut -d= -f2) \
 *     pnpm test src/eval/fixtures/freeze.test.ts
 *
 * Notes:
 *   - Each contract is ~15–30s end-to-end; the test timeout matches
 *     the snapshot-harness budget of 180s per fixture.
 *   - Embeddings from SP-10 Phase 2 ride along on the AnalyzeResponse
 *     by default — the retrieval harness needs them, so we keep them
 *     in the fixture. If `embedClauses` fails the pipeline still
 *     returns a response with no `clause_embeddings` field and the
 *     harness logs that via `logPass("pass2", ...)`.
 */

import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { analyzeContract } from "@/lib/analyzer";
import { getProvider } from "@/lib/llm/provider";
import { FIXTURES } from "./manifest";
import { fixturePath } from "./load";

const SHOULD_RUN =
  process.env.FREEZE_FIXTURES === "1" && Boolean(process.env.MISTRAL_API_KEY);

const describeIfFreeze = SHOULD_RUN ? describe : describe.skip;
const TIMEOUT_MS = 180_000;

describeIfFreeze("eval fixture freeze harness", () => {
  for (const fixture of FIXTURES) {
    it(
      `captures ${fixture.label} → ${fixture.slug}.json`,
      async () => {
        const provider = getProvider();
        const response = await analyzeContract(
          fixture.text,
          fixture.mode,
          fixture.withCitations,
          fixture.userRole,
          provider,
        );

        // Structural sanity before we commit the fixture — catches obvious
        // pipeline regressions mid-capture rather than shipping a broken
        // fixture that the downstream eval then trips on.
        expect(response.overview.contract_type).toBeTruthy();
        expect(response.clauses.length).toBeGreaterThanOrEqual(3);
        expect(response.summary.total_clauses).toBe(response.clauses.length);

        const path = fixturePath(fixture.slug);
        // Stable 2-space JSON, trailing newline — keeps git diffs readable
        // and matches the house style for other checked-in JSON data.
        writeFileSync(path, `${JSON.stringify(response, null, 2)}\n`, "utf8");
      },
      TIMEOUT_MS,
    );
  }
});
