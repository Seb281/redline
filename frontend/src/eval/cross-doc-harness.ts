/**
 * SP-10 Arc 3 Task 3.5 — cross-contract retrieval harness.
 *
 * Intra-doc eval (``runHarness`` in ``./harness.ts``) measures the
 * chat retriever operating inside a single analysis. This harness
 * measures the cross-contract retriever used by ``/history`` semantic
 * search, the library-comparison panel, and the similar-clauses
 * drawer — one candidate pool unions every fixture's clauses, ranked
 * by cosine similarity against a query embedding.
 *
 * Why pure-cosine (no BM25): the production surface runs on pgvector
 * (``services/semantic_search.py``) and only cosine. BM25 across
 * mixed-language fixtures has poor signal anyway — the EN query would
 * barely retrieve PL/FR/DE clause text. The harness mirrors the
 * production ranking rather than the intra-doc hybrid stack.
 *
 * Determinism: frozen query embeddings live in
 * ``cross-doc-query-embeddings.json`` (``./cross-doc-queries.ts``).
 * Fixture clause embeddings live in ``./fixtures/*.json``. Same
 * reproducibility contract as the intra-doc harness — no live API
 * calls on CI.
 *
 * Scope rules:
 *   - Binary hit on recall@k: ``1`` if any expected
 *     ``{fixture, clause_index}`` tuple is in the top-k, else ``0``.
 *   - Missing query embeddings → skip the entry silently (matches
 *     intra-doc fallback). If ALL entries are missing, the overall
 *     metrics are 0 — caller should check ``report.overall.n`` before
 *     asserting.
 *   - Fixtures without a committed ``.json`` are skipped.
 */

import type { AnalyzeResponse, ClauseEmbedding } from "@/types";
import { cosineSimilarity } from "@/lib/retrieval/vector";
import {
  CROSS_DOC_QUESTIONS,
  type CrossDocQuestion,
  type CrossDocTier,
} from "./cross-doc-questions";
import { availableFixtureSlugs, loadFixture } from "./fixtures/load";

/** A single `(fixture, clause_index)` tuple — same shape as ``CrossDocExpectation``. */
export interface CrossDocHit {
  fixture: string;
  clause_index: number;
}

/** Summary metrics for a slice of the cross-doc set. */
export interface CrossDocMetrics {
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
  n: number;
}

/** Full cross-doc report — overall + per-tier. */
export interface CrossDocReport {
  retriever: string;
  overall: CrossDocMetrics;
  perTier: Record<CrossDocTier, CrossDocMetrics>;
  /** Raw per-question top-k for introspection + debugging. */
  perQuestion: Record<string, { ranked: CrossDocHit[] }>;
  /** Questions skipped because their query embedding was missing from the cache. */
  skipped: string[];
}

const ALL_TIERS: readonly CrossDocTier[] = ["easy", "medium", "hard"];

/** Top-N depth for the harness. Above recall@5 so MRR sees full ranking. */
const HARNESS_TOP_N = 20;

/** One entry in the merged cross-doc candidate pool. */
interface MergedCandidate {
  fixture: string;
  clause_index: number;
  embedding: number[];
}

/**
 * Materialise the merged candidate pool from every on-disk fixture.
 * A fixture is only included if its ``clause_embeddings`` array is
 * present + non-empty — which is the same precondition ``fixtures``
 * freeze guarantees. Returns candidates in manifest order, stable.
 */
export function buildCrossDocPool(): MergedCandidate[] {
  const pool: MergedCandidate[] = [];
  for (const slug of availableFixtureSlugs()) {
    const fixture: AnalyzeResponse = loadFixture(slug);
    const embeddings: ClauseEmbedding[] = fixture.clause_embeddings ?? [];
    for (const e of embeddings) {
      pool.push({
        fixture: slug,
        clause_index: e.clause_index,
        embedding: Array.from(e.embedding),
      });
    }
  }
  return pool;
}

/** Recall@k — binary hit on the expected tuple set. */
function recallAt(
  k: number,
  expected: readonly CrossDocHit[],
  ranked: readonly CrossDocHit[],
): number {
  const keys = new Set(expected.map((e) => `${e.fixture}::${e.clause_index}`));
  const limit = Math.min(k, ranked.length);
  for (let i = 0; i < limit; i++) {
    if (keys.has(`${ranked[i].fixture}::${ranked[i].clause_index}`)) return 1;
  }
  return 0;
}

/** Reciprocal rank of the first hit (1-indexed). 0 if no expected tuple is retrieved. */
function reciprocalRank(
  expected: readonly CrossDocHit[],
  ranked: readonly CrossDocHit[],
): number {
  const keys = new Set(expected.map((e) => `${e.fixture}::${e.clause_index}`));
  for (let i = 0; i < ranked.length; i++) {
    if (keys.has(`${ranked[i].fixture}::${ranked[i].clause_index}`)) return 1 / (i + 1);
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
  return Math.round(x * 10000) / 10000;
}

interface ScoredEntry {
  q: CrossDocQuestion;
  ranked: CrossDocHit[];
}

function aggregate(entries: readonly ScoredEntry[]): CrossDocMetrics {
  return {
    recallAt1: roundMetric(mean(entries.map((e) => recallAt(1, e.q.expected, e.ranked)))),
    recallAt3: roundMetric(mean(entries.map((e) => recallAt(3, e.q.expected, e.ranked)))),
    recallAt5: roundMetric(mean(entries.map((e) => recallAt(5, e.q.expected, e.ranked)))),
    mrr: roundMetric(mean(entries.map((e) => reciprocalRank(e.q.expected, e.ranked)))),
    n: entries.length,
  };
}

/**
 * Rank the merged pool by cosine similarity against ``queryEmbedding``.
 * Mirrors the ``ORDER BY embedding <=> :q`` pgvector query used by
 * ``services/semantic_search.py``, just with the matrix in memory.
 */
export function rankCrossDocPool(
  pool: readonly MergedCandidate[],
  queryEmbedding: readonly number[],
  topN: number,
): CrossDocHit[] {
  const scored = pool.map((c) => ({
    fixture: c.fixture,
    clause_index: c.clause_index,
    score: cosineSimilarity(c.embedding, Array.from(queryEmbedding)),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map((s) => ({
    fixture: s.fixture,
    clause_index: s.clause_index,
  }));
}

/**
 * Run the cross-doc harness with a pre-built query-embedding map.
 * Questions without a cached embedding are silently skipped + listed
 * in ``report.skipped`` so callers can distinguish "zero lift" from
 * "cache stale" at assertion time.
 */
export function runCrossDocHarness(
  retrieverName: string,
  queryEmbeddings: ReadonlyMap<string, readonly number[]>,
  questions: readonly CrossDocQuestion[] = CROSS_DOC_QUESTIONS,
): CrossDocReport {
  const pool = buildCrossDocPool();
  const results: ScoredEntry[] = [];
  const perQuestion: Record<string, { ranked: CrossDocHit[] }> = {};
  const skipped: string[] = [];

  for (const q of questions) {
    const emb = queryEmbeddings.get(q.id);
    if (!emb || pool.length === 0) {
      skipped.push(q.id);
      continue;
    }
    const ranked = rankCrossDocPool(pool, emb, HARNESS_TOP_N);
    results.push({ q, ranked });
    perQuestion[q.id] = { ranked };
  }

  const overall = aggregate(results);
  const perTier = Object.fromEntries(
    ALL_TIERS.map((tier) => [tier, aggregate(results.filter((r) => r.q.tier === tier))]),
  ) as Record<CrossDocTier, CrossDocMetrics>;

  return {
    retriever: retrieverName,
    overall,
    perTier,
    perQuestion,
    skipped,
  };
}

/**
 * Human-readable markdown table for EVAL.md — same column order as the
 * intra-doc harness output so diff-readers don't have to recalibrate.
 */
export function formatCrossDocMarkdown(report: CrossDocReport): string {
  const head =
    `### ${report.retriever}\n\n` +
    `| slice | n | recall@1 | recall@3 | recall@5 | MRR |\n` +
    `| --- | --- | --- | --- | --- | --- |\n`;
  const row = (label: string, m: CrossDocMetrics) =>
    `| ${label} | ${m.n} | ${m.recallAt1.toFixed(3)} | ${m.recallAt3.toFixed(3)} | ${m.recallAt5.toFixed(3)} | ${m.mrr.toFixed(3)} |\n`;

  let out = head + row("overall", report.overall);
  for (const tier of ALL_TIERS) out += row(`tier: ${tier}`, report.perTier[tier]);
  return out;
}

/** Dump raw metrics for seeding baseline.json without hand-copying. */
export function crossDocBaselineShape(report: CrossDocReport) {
  return {
    overall: report.overall,
    perTier: report.perTier,
  };
}
