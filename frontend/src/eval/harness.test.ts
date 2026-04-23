/**
 * SP-10 Arc 1 Phase 4b — retrieval eval regression gate.
 *
 * Two retrievers are gated in CI — both deterministic, both zero-network:
 *   - `bm25`: BM25-only, always runs. The keyword baseline every later
 *     layer is benchmarked against.
 *   - `hybrid`: BM25 + cosine via RRF, uses the frozen
 *     `golden-query-embeddings.json`. Only gates when the cache file is
 *     on disk; a fresh checkout that has not yet run the freeze harness
 *     skips the hybrid block cleanly so the BM25 gate still runs green.
 *
 * Regression policy: recall@k and MRR monotonically ≥ the floor in
 * `baseline.json`. Improvements must re-pin the baseline in the same
 * PR — otherwise future regressions hide under an inflated ceiling.
 * Every retriever ships with overall + per-tier + per-fixture cuts so
 * reviewers can see exactly where the lift (or regression) landed.
 */
import { describe, it, expect } from "vitest";
import baseline from "./baseline.json";
import { runHarness, formatReportMarkdown, baselineShapeFromReport } from "./harness";
import {
  bm25Retriever,
  makeHybridRetriever,
  makeHybridMetadataRetriever,
  makeHybridGraphRetriever,
  makeHybridRerankRetriever,
} from "./retrievers";
import {
  goldenQueryCacheExists,
  goldenQueryEmbeddingMap,
} from "./golden-queries";
import {
  goldenRerankCacheExists,
  loadGoldenRerankCache,
} from "./golden-rerank-scores";
import type { HarnessMetrics, HarnessReport } from "./harness";

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

function assertReportBeatsFloor(
  report: HarnessReport,
  floor: {
    overall: HarnessMetrics;
    perTier: Record<string, HarnessMetrics>;
    perFixture: Record<string, HarnessMetrics>;
  },
) {
  expectMeetsFloor("overall", report.overall, floor.overall);
  for (const tier of Object.keys(floor.perTier)) {
    expectMeetsFloor(`tier:${tier}`, report.perTier[tier as keyof typeof report.perTier], floor.perTier[tier]);
  }
  for (const slug of Object.keys(floor.perFixture)) {
    expectMeetsFloor(`fixture:${slug}`, report.perFixture[slug], floor.perFixture[slug]);
  }
}

describe("eval harness — BM25 baseline regression gate", () => {
  it("meets or beats committed floor overall, per-tier, and per-fixture", async () => {
    const report = await runHarness("bm25", bm25Retriever);
    if (PRINT_REPORT) {
      console.log(formatReportMarkdown(report));
      console.log("BASELINE_JSON_BM25", JSON.stringify(baselineShapeFromReport(report)));
    }
    assertReportBeatsFloor(report, baseline.bm25);
  });
});

const describeIfHybridCache = goldenQueryCacheExists() ? describe : describe.skip;
const hybridFloor = (baseline as unknown as { hybrid?: typeof baseline.bm25 }).hybrid;
const describeIfHybridFloor = hybridFloor ? describeIfHybridCache : describe.skip;

describeIfHybridFloor("eval harness — hybrid regression gate", () => {
  it("meets or beats committed floor overall, per-tier, and per-fixture", async () => {
    const retriever = makeHybridRetriever(goldenQueryEmbeddingMap());
    const report = await runHarness("hybrid", retriever);
    if (PRINT_REPORT) {
      console.log(formatReportMarkdown(report));
      console.log("BASELINE_JSON_HYBRID", JSON.stringify(baselineShapeFromReport(report)));
    }
    if (!hybridFloor) throw new Error("hybrid floor missing from baseline.json");
    assertReportBeatsFloor(report, hybridFloor);
  });
});

const hybridMetadataFloor = (baseline as unknown as {
  hybrid_metadata?: typeof baseline.bm25;
}).hybrid_metadata;
const describeIfHybridMetadataFloor = hybridMetadataFloor
  ? describeIfHybridCache
  : describe.skip;

describeIfHybridMetadataFloor(
  "eval harness — hybrid + metadata boost regression gate",
  () => {
    it("meets or beats committed floor overall, per-tier, and per-fixture", async () => {
      const retriever = makeHybridMetadataRetriever(goldenQueryEmbeddingMap());
      const report = await runHarness("hybrid_metadata", retriever);
      if (PRINT_REPORT) {
        console.log(formatReportMarkdown(report));
        console.log(
          "BASELINE_JSON_HYBRID_METADATA",
          JSON.stringify(baselineShapeFromReport(report)),
        );
      }
      if (!hybridMetadataFloor)
        throw new Error("hybrid_metadata floor missing from baseline.json");
      assertReportBeatsFloor(report, hybridMetadataFloor);
    });
  },
);

const hybridGraphFloor = (baseline as unknown as {
  hybrid_graph?: typeof baseline.bm25;
}).hybrid_graph;
const describeIfHybridGraphFloor = hybridGraphFloor
  ? describeIfHybridCache
  : describe.skip;

describeIfHybridGraphFloor(
  "eval harness — hybrid + metadata + graph widening regression gate",
  () => {
    it("meets or beats committed floor overall, per-tier, and per-fixture", async () => {
      const retriever = makeHybridGraphRetriever(goldenQueryEmbeddingMap());
      const report = await runHarness("hybrid_graph", retriever);
      if (PRINT_REPORT) {
        console.log(formatReportMarkdown(report));
        console.log(
          "BASELINE_JSON_HYBRID_GRAPH",
          JSON.stringify(baselineShapeFromReport(report)),
        );
      }
      if (!hybridGraphFloor)
        throw new Error("hybrid_graph floor missing from baseline.json");
      assertReportBeatsFloor(report, hybridGraphFloor);
    });
  },
);

const hybridRerankFloor = (baseline as unknown as {
  hybrid_rerank?: typeof baseline.bm25;
}).hybrid_rerank;
const describeIfHybridRerankCache =
  goldenQueryCacheExists() && goldenRerankCacheExists() ? describe : describe.skip;
const describeIfHybridRerankFloor = hybridRerankFloor
  ? describeIfHybridRerankCache
  : describe.skip;

describeIfHybridRerankFloor(
  "eval harness — hybrid + metadata + graph + Jina rerank regression gate",
  () => {
    it("meets or beats committed floor overall, per-tier, and per-fixture", async () => {
      const rerankCache = loadGoldenRerankCache();
      if (!rerankCache)
        throw new Error("rerank cache missing despite existence check");
      const retriever = makeHybridRerankRetriever(
        goldenQueryEmbeddingMap(),
        rerankCache,
      );
      const report = await runHarness("hybrid_rerank", retriever);
      if (PRINT_REPORT) {
        console.log(formatReportMarkdown(report));
        console.log(
          "BASELINE_JSON_HYBRID_RERANK",
          JSON.stringify(baselineShapeFromReport(report)),
        );
      }
      if (!hybridRerankFloor)
        throw new Error("hybrid_rerank floor missing from baseline.json");
      assertReportBeatsFloor(report, hybridRerankFloor);
    });
  },
);
