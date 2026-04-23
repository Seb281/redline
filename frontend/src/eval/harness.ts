/**
 * SP-10 Arc 1 Phase 4b — retrieval eval harness.
 *
 * Generic driver that runs a retriever against the frozen golden set,
 * computes recall@1/@3/@5 + MRR overall, per-tier, and per-fixture.
 * Retriever-agnostic: callers hand in a function with the canonical
 * signature and the harness returns a typed `HarnessReport` — the test
 * file formats and gates on it, EVAL.md sources numbers from it.
 *
 * Scope:
 *   - Index-level matching. A "hit" means any expected clause index
 *     appeared in the retrieved top-k. Multi-index expected sets are
 *     binary hit (any overlap) rather than fraction — partial-recall
 *     on hard questions is a retriever limitation we surface in the
 *     baseline, not a measurement axis.
 *   - Topic-scoped. The eval runs within a single fixture at a time,
 *     matching the product's actual chat scope (one analysis per
 *     session). Cross-contract recall is an Arc 3 concern.
 *   - No ground-truth gradation. Every expected index is treated as
 *     equally "correct". If future needs require graded relevance
 *     (perfect vs acceptable answer), add a `relevance` field on
 *     `GoldenQuestion` and extend the metric — do not shoehorn it here.
 *
 * Determinism: BM25 + fixture contents are deterministic, so the
 * harness is reproducible for the baseline retriever. Hybrid depends on
 * a cached query-embedding map; when the cache is complete the harness
 * stays deterministic, when it's missing entries the hybrid retriever
 * itself degrades to BM25-only (per `hybridRetrieve`) so the harness
 * still runs and reports numbers — just weaker ones.
 */

import type { AnalyzeResponse } from "@/types";
import type { GoldenQuestion, GoldenTier } from "./golden-questions";
import { GOLDEN_QUESTIONS } from "./golden-questions";
import { loadFixture, availableFixtureSlugs } from "./fixtures/load";

/** Ordered clause indices (most relevant first). */
export interface RetrievedClauseRanking {
  indices: number[];
}

/** Canonical retriever signature for the harness. Sync or async. */
export type RetrieverFn = (
  question: GoldenQuestion,
  fixture: AnalyzeResponse,
) => Promise<RetrievedClauseRanking> | RetrievedClauseRanking;

/** Summary metrics for a slice of the golden set. */
export interface HarnessMetrics {
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  /** Mean Reciprocal Rank over the slice. */
  mrr: number;
  /** Number of questions scored in this slice. */
  n: number;
}

/** Full harness output — overall + per-tier + per-fixture breakdowns. */
export interface HarnessReport {
  retriever: string;
  overall: HarnessMetrics;
  perTier: Record<GoldenTier, HarnessMetrics>;
  perFixture: Record<string, HarnessMetrics>;
  /**
   * Raw per-question results for downstream introspection
   * (debugging, ablation diffs). Keyed by `GoldenQuestion.id`.
   */
  perQuestion: Record<string, { ranked: number[] }>;
}

const ALL_TIERS: readonly GoldenTier[] = ["easy", "medium", "hard"];

/** Recall@k — binary hit (any expected index in top-k). */
function recallAt(k: number, expected: readonly number[], ranked: readonly number[]): number {
  const exp = new Set(expected);
  const limit = Math.min(k, ranked.length);
  for (let i = 0; i < limit; i++) {
    if (exp.has(ranked[i])) return 1;
  }
  return 0;
}

/** Reciprocal rank of the first hit (1-indexed). 0 if no expected index is retrieved. */
function reciprocalRank(expected: readonly number[], ranked: readonly number[]): number {
  const exp = new Set(expected);
  for (let i = 0; i < ranked.length; i++) {
    if (exp.has(ranked[i])) return 1 / (i + 1);
  }
  return 0;
}

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

function roundMetric(x: number): number {
  // 4 decimal places keeps the baseline JSON diff-readable without
  // triggering cosmetic churn on the last digit across platforms.
  return Math.round(x * 10000) / 10000;
}

interface ScoredEntry {
  q: GoldenQuestion;
  ranked: number[];
}

function aggregate(entries: readonly ScoredEntry[]): HarnessMetrics {
  return {
    recallAt1: roundMetric(mean(entries.map((e) => recallAt(1, e.q.expected_clause_indices, e.ranked)))),
    recallAt3: roundMetric(mean(entries.map((e) => recallAt(3, e.q.expected_clause_indices, e.ranked)))),
    recallAt5: roundMetric(mean(entries.map((e) => recallAt(5, e.q.expected_clause_indices, e.ranked)))),
    mrr: roundMetric(mean(entries.map((e) => reciprocalRank(e.q.expected_clause_indices, e.ranked)))),
    n: entries.length,
  };
}

/**
 * Run the harness across `questions` (defaults to the frozen
 * `GOLDEN_QUESTIONS`). Questions whose fixture has no committed JSON
 * on disk are silently skipped — this keeps the test suite passing on
 * a fresh clone where only some fixtures have been captured.
 */
export async function runHarness(
  retrieverName: string,
  retrieve: RetrieverFn,
  questions: readonly GoldenQuestion[] = GOLDEN_QUESTIONS,
): Promise<HarnessReport> {
  const available = new Set(availableFixtureSlugs());
  const scoped = questions.filter((q) => available.has(q.fixture));

  const fixtureCache = new Map<string, AnalyzeResponse>();
  const results: ScoredEntry[] = [];
  const perQuestion: Record<string, { ranked: number[] }> = {};

  for (const q of scoped) {
    if (!fixtureCache.has(q.fixture)) {
      fixtureCache.set(q.fixture, loadFixture(q.fixture));
    }
    const fixture = fixtureCache.get(q.fixture) as AnalyzeResponse;
    const ranking = await retrieve(q, fixture);
    results.push({ q, ranked: ranking.indices });
    perQuestion[q.id] = { ranked: ranking.indices };
  }

  const overall = aggregate(results);
  const perTier = Object.fromEntries(
    ALL_TIERS.map((tier) => [tier, aggregate(results.filter((r) => r.q.tier === tier))]),
  ) as Record<GoldenTier, HarnessMetrics>;
  const fixtureSlugs = Array.from(new Set(scoped.map((q) => q.fixture)));
  const perFixture = Object.fromEntries(
    fixtureSlugs.map((slug) => [slug, aggregate(results.filter((r) => r.q.fixture === slug))]),
  );

  return {
    retriever: retrieverName,
    overall,
    perTier,
    perFixture,
    perQuestion,
  };
}

/**
 * Render a human-friendly markdown summary for `EVAL.md`. Keep column
 * order stable so diffs stay minimal when only numbers change.
 */
export function formatReportMarkdown(report: HarnessReport): string {
  const head =
    `### ${report.retriever}\n\n` +
    `| slice | n | recall@1 | recall@3 | recall@5 | MRR |\n` +
    `| --- | --- | --- | --- | --- | --- |\n`;
  const row = (label: string, m: HarnessMetrics) =>
    `| ${label} | ${m.n} | ${m.recallAt1.toFixed(3)} | ${m.recallAt3.toFixed(3)} | ${m.recallAt5.toFixed(3)} | ${m.mrr.toFixed(3)} |\n`;

  let out = head + row("overall", report.overall);
  for (const tier of ALL_TIERS) out += row(`tier: ${tier}`, report.perTier[tier]);
  const fixtures = Object.keys(report.perFixture).sort();
  for (const f of fixtures) out += row(`fixture: ${f}`, report.perFixture[f]);
  return out;
}

/**
 * Dump the raw metrics at 4-decimal precision — used to seed or
 * refresh `baseline.json` without having to hand-copy numbers from the
 * human-readable markdown table.
 */
export function baselineShapeFromReport(report: HarnessReport) {
  return {
    overall: report.overall,
    perTier: report.perTier,
    perFixture: report.perFixture,
  };
}
