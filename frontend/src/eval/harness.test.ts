/**
 * SP-10 Arc 1 Phase 4b — retrieval eval regression gate.
 *
 * Runs the BM25 baseline retriever over the frozen golden set and
 * asserts its metrics still match (≥) the committed floor in
 * `baseline.json`. Hybrid + future layers each get their own slot in
 * the baseline artifact — deliberately updated by explicit commit, not
 * re-pinned on every run.
 *
 * Why BM25 is the CI-safe gate: it depends only on deterministic
 * ripgrep-style tokenisation and the frozen fixtures. No network, no
 * API key. Hybrid gets a separate live-only suite (`harness.live.test.ts`)
 * that's gated on `MISTRAL_API_KEY` — we cannot pin hybrid in CI until
 * golden-query embeddings are committed alongside the fixtures.
 *
 * Regression policy: recall@k and MRR monotonically ≥ baseline. If a
 * refactor improves numbers, the PR must re-pin the baseline in the
 * same commit — otherwise future regressions hide under an inflated
 * ceiling. The harness emits per-tier + per-fixture cuts so reviewers
 * can see where the lift came from.
 */
import { describe, it, expect } from "vitest";
import baseline from "./baseline.json";
import { runHarness, formatReportMarkdown, baselineShapeFromReport } from "./harness";
import { bm25Retriever } from "./retrievers";
import type { HarnessMetrics } from "./harness";

const PRINT_REPORT = process.env.EVAL_PRINT === "1";

function expectMeetsFloor(label: string, got: HarnessMetrics, floor: HarnessMetrics) {
  expect(got.n, `${label}: n changed — did the golden set shrink?`).toBe(floor.n);
  for (const key of ["recallAt1", "recallAt3", "recallAt5", "mrr"] as const) {
    expect(
      got[key],
      `${label}.${key} regressed: ${got[key].toFixed(4)} < floor ${floor[key].toFixed(4)}`,
    ).toBeGreaterThanOrEqual(floor[key]);
  }
}

describe("eval harness — BM25 baseline regression gate", () => {
  it("meets or beats committed floor overall, per-tier, and per-fixture", async () => {
    const report = await runHarness("bm25", bm25Retriever);
    if (PRINT_REPORT) {
      console.log(formatReportMarkdown(report));
      console.log("BASELINE_JSON", JSON.stringify(baselineShapeFromReport(report)));
    }

    const floor = baseline.bm25;
    expectMeetsFloor("overall", report.overall, floor.overall);

    for (const tier of Object.keys(floor.perTier) as Array<keyof typeof floor.perTier>) {
      expectMeetsFloor(`tier:${tier}`, report.perTier[tier], floor.perTier[tier]);
    }
    for (const slug of Object.keys(floor.perFixture)) {
      expectMeetsFloor(`fixture:${slug}`, report.perFixture[slug], floor.perFixture[slug]);
    }
  });
});
