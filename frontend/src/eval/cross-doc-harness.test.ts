/**
 * SP-10 Arc 3 Task 3.5 — cross-doc eval CI gate.
 *
 * Two responsibilities:
 *   1. **Smoke test.** Harness runs end-to-end against the frozen
 *      cross-doc cache + fixtures. If ``cross-doc-query-embeddings.json``
 *      is missing (fresh checkout pre-freeze) the gate skips cleanly
 *      instead of failing.
 *   2. **Regression floor.** The ``cross_doc`` row in ``baseline.json``
 *      is the committed pin; recall + MRR must stay ``>=`` every floor.
 *      Any drop triggers an explicit re-pin commit — same contract as
 *      the intra-doc ``hybrid`` row in ``harness.test.ts``.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runCrossDocHarness,
  buildCrossDocPool,
} from "./cross-doc-harness";
import {
  crossDocQueryEmbeddingMap,
  crossDocQueryCacheExists,
} from "./cross-doc-queries";
import { CROSS_DOC_QUESTIONS } from "./cross-doc-questions";

const BASELINE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "baseline.json",
);

interface BaselineMetrics {
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
  n: number;
}

interface CrossDocBaselineRow {
  overall: BaselineMetrics;
  perTier: Record<"easy" | "medium" | "hard", BaselineMetrics>;
}

interface Baseline {
  cross_doc?: CrossDocBaselineRow;
}

function loadBaseline(): Baseline {
  if (!existsSync(BASELINE_PATH)) return {};
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
}

const cacheReady = crossDocQueryCacheExists();

describe("cross-doc harness smoke", () => {
  it("builds a non-empty merged pool from the frozen fixtures", () => {
    const pool = buildCrossDocPool();
    expect(pool.length).toBeGreaterThan(0);
  });

  it.skipIf(!cacheReady)(
    "runs every question with a cached query embedding",
    () => {
      const embMap = crossDocQueryEmbeddingMap();
      const report = runCrossDocHarness("cross_doc", embMap);
      expect(report.overall.n).toBe(CROSS_DOC_QUESTIONS.length);
      expect(report.skipped).toHaveLength(0);
    },
  );
});

describe("cross-doc baseline gate", () => {
  const baseline = loadBaseline();
  const pinned = baseline.cross_doc;
  const shouldRun = cacheReady && pinned !== undefined;

  it.skipIf(!shouldRun)(
    "does not regress overall recall / MRR below the pinned floor",
    () => {
      const embMap = crossDocQueryEmbeddingMap();
      const report = runCrossDocHarness("cross_doc", embMap);
      const floor = pinned!.overall;
      expect(report.overall.n).toBe(floor.n);
      expect(report.overall.recallAt1).toBeGreaterThanOrEqual(floor.recallAt1);
      expect(report.overall.recallAt3).toBeGreaterThanOrEqual(floor.recallAt3);
      expect(report.overall.recallAt5).toBeGreaterThanOrEqual(floor.recallAt5);
      expect(report.overall.mrr).toBeGreaterThanOrEqual(floor.mrr);
    },
  );

  it.skipIf(!shouldRun)(
    "does not regress any per-tier floor",
    () => {
      const embMap = crossDocQueryEmbeddingMap();
      const report = runCrossDocHarness("cross_doc", embMap);
      const tiers = ["easy", "medium", "hard"] as const;
      for (const tier of tiers) {
        const floor = pinned!.perTier[tier];
        const got = report.perTier[tier];
        expect(got.recallAt5, `${tier} recall@5`).toBeGreaterThanOrEqual(floor.recallAt5);
        expect(got.mrr, `${tier} MRR`).toBeGreaterThanOrEqual(floor.mrr);
      }
    },
  );
});
