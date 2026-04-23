/**
 * SP-10 Arc 1 Phase 3 — hybrid BM25 ∥ cosine retriever composed via RRF.
 *
 * One call site: the chat endpoint's context builder. Input is a query
 * string + optional query embedding + the per-clause candidates. Output
 * is a ranked list of clause ids with fused scores, truncated to
 * `topN` (default 5, matches the legacy keyword-overlap ceiling).
 *
 * Degradation policy — hybrid must *always* return something useful:
 *   - No query embedding (embed-query failed, or caller deliberately
 *     skipped) → BM25-only. We log the disablement for diagnostics.
 *   - No candidate has an embedding (legacy saved row pre-SP-10) →
 *     BM25-only. Same log.
 *   - Partial embedding coverage → vector branch runs over the subset
 *     that has embeddings; BM25 still sees the full corpus. RRF
 *     tolerates the asymmetry by design (missing from a branch = rank
 *     infinity = zero contribution).
 *   - Empty corpus → empty result.
 *
 * The per-branch top-K cap (`PER_BRANCH_TOP_K = 20`) mirrors the spec's
 * retrieval pipeline. Keeps fusion cheap and prevents noisy tails from
 * one branch dragging down precision in the fused list.
 */

import type { AnalyzedClause, ClauseEmbedding, ClauseCategory } from "@/types";
import type { StatuteCode } from "@/lib/applicable-law";
import { bm25Rank } from "./bm25";
import { vectorRank } from "./vector";
import { reciprocalRankFusion } from "./fusion";
import { extractQueryHints } from "./query-analysis";
import { applyMetadataBoost, type CandidateMetadata } from "./metadata-boost";
import { buildCrossRefGraph, depthOneNeighbours } from "./cross-refs";
import { expandWithDefinitions } from "./definitions";
import { logPass } from "@/lib/llm/debug-log";

const DEFAULT_TOP_N = 5;
const PER_BRANCH_TOP_K = 20;

/**
 * SP-10 Arc 2 Task 2.2b — top-K of the fused+boosted rank that seeds
 * graph widening. Mirrors the chat context's final display cap so the
 * widening round only pulls neighbours of clauses the user is actually
 * going to see. Wider seed-depths drag in tangential context that
 * hasn't earned its place in the answer.
 */
const GRAPH_WIDENING_SEED_DEPTH = 5;

/**
 * One candidate doc for the hybrid retriever.
 *
 * `embedding` is optional so callers can mix indexed and non-indexed
 * docs in one corpus (legacy rows, freshly-added clauses whose embed
 * job is still pending, etc.). `category` and `statuteCodes` are the
 * per-clause metadata consumed by the Arc 2 metadata-boost layer —
 * both optional so a candidate missing its Pass 2 metadata contributes
 * zero boost instead of crashing the retrieval.
 */
export interface HybridCandidate {
  id: number;
  text: string;
  embedding?: number[];
  category?: ClauseCategory;
  statuteCodes?: readonly StatuteCode[];
}

/** Input shape for {@link hybridRetrieve}. */
export interface HybridRetrieveInput {
  query: string;
  /** Embedding of `query`. Pass `null` to force BM25-only mode. */
  queryEmbedding: number[] | null;
  candidates: HybridCandidate[];
  /** Max fused results to return. Defaults to 5. */
  topN?: number;
  /**
   * SP-10 Arc 2 — toggle the metadata-boost layer. Default `true` in
   * production; the eval harness passes `false` when measuring the
   * pre-boost hybrid floor so ablation deltas stay clean.
   */
  metadataBoost?: boolean;
  /**
   * SP-10 Arc 2 Task 2.2b — clauses backing the candidates. Needed for
   * graph widening to build the cross-ref graph + definitions map. Same
   * positional alignment as `candidates` (id = index). Optional because
   * the non-widening path does not need the full clause bodies.
   */
  clauses?: readonly AnalyzedClause[];
  /**
   * SP-10 Arc 2 Task 2.2b — toggle cross-ref + definitions widening.
   * Default `false` to preserve legacy behaviour everywhere the caller
   * has not explicitly opted in; the production chat context builder and
   * the Arc 2 eval retriever flip it `true`.
   */
  graphWidening?: boolean;
}

/** A fused ranked entry — clause id plus the raw RRF score for debugging. */
export interface HybridResult {
  id: number;
  score: number;
}

/**
 * Run the hybrid retriever and return fused top-N clause ids.
 *
 * Safe against every partial-data failure mode listed in the module
 * header. Never throws on the happy path; a throw here indicates a
 * programmer error in a dependency (e.g. cosine dim mismatch on
 * matched embeddings) and should surface loudly rather than be caught.
 */
export async function hybridRetrieve(
  input: HybridRetrieveInput,
): Promise<HybridResult[]> {
  const {
    query,
    queryEmbedding,
    candidates,
    topN = DEFAULT_TOP_N,
    metadataBoost = true,
    clauses,
    graphWidening = false,
  } = input;

  if (candidates.length === 0) return [];

  const bm25 = bm25Rank(
    query,
    candidates.map((c) => ({ id: c.id, text: c.text })),
  );
  const bm25Order = bm25
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_BRANCH_TOP_K)
    .map((r) => r.id);

  const vectorCandidates = queryEmbedding
    ? candidates.filter(
        (c): c is HybridCandidate & { embedding: number[] } =>
          Array.isArray(c.embedding) && c.embedding.length > 0,
      )
    : [];

  let vectorOrder: number[] = [];
  if (queryEmbedding && vectorCandidates.length > 0) {
    const vec = vectorRank(
      queryEmbedding,
      vectorCandidates.map((c) => ({ id: c.id, embedding: c.embedding })),
    );
    vectorOrder = vec.slice(0, PER_BRANCH_TOP_K).map((r) => r.id);
  } else {
    logPass("chat_retrieval", {
      event: "vector_branch_disabled",
      reason:
        queryEmbedding == null
          ? "no_query_embedding"
          : "no_candidate_embeddings",
      candidates: candidates.length,
    });
  }

  const fused = reciprocalRankFusion(
    vectorOrder.length > 0 ? [bm25Order, vectorOrder] : [bm25Order],
  );

  let ranked = fused;
  if (metadataBoost) {
    const hints = extractQueryHints(query);
    if (hints.categories.size > 0 || hints.statuteCodes.size > 0) {
      const metadata = new Map<number, CandidateMetadata>();
      for (const c of candidates) {
        if (c.category !== undefined) {
          metadata.set(c.id, {
            category: c.category,
            statuteCodes: c.statuteCodes ?? [],
          });
        }
      }
      if (metadata.size > 0) {
        ranked = applyMetadataBoost(fused, metadata, hints);
      }
    }
  }

  let widened = 0;
  if (graphWidening && clauses && clauses.length > 0 && ranked.length > 0) {
    const result = applyGraphWidening(ranked, clauses);
    ranked = result.ranked;
    widened = result.widened;
  }

  logPass("chat_retrieval", {
    event: "hybrid_ok",
    bm25_hits: bm25Order.length,
    vector_hits: vectorOrder.length,
    fused: ranked.length,
    metadata_boost: metadataBoost,
    graph_widening: graphWidening,
    widened,
  });

  return ranked.slice(0, topN);
}

/**
 * Widen the ranked list with depth-1 cross-ref neighbours and defined
 * -term clauses of the top {@link GRAPH_WIDENING_SEED_DEPTH} seeds.
 *
 * Strategy: strictly additive. Widenings that are already present in
 * the fused+boosted rank keep their existing position; widenings that
 * were missing (below PER_BRANCH_TOP_K on both branches) get appended
 * at a synthetic floor score. Never reorders existing ranks.
 *
 * The additive-only shape is deliberate. An earlier boosted variant
 * (1.5× score on widening ids) regressed top-1 recall on
 * definition-heavy fixtures — every clause mentioning a common defined
 * term like "Services" promoted the definitions clause past the true
 * answer. Graph widening's job is context completeness, not relevance
 * re-ranking; the boost layer is where relevance judgments live.
 *
 * Returns both the new rank list and the widening-set size for debug
 * logging.
 */
function applyGraphWidening(
  ranked: readonly HybridResult[],
  clauses: readonly AnalyzedClause[],
): { ranked: HybridResult[]; widened: number } {
  const seeds = new Set(
    ranked.slice(0, GRAPH_WIDENING_SEED_DEPTH).map((r) => r.id),
  );
  const graph = buildCrossRefGraph(clauses);
  const neighbours = depthOneNeighbours(seeds, graph);
  const defs = expandWithDefinitions(seeds, clauses);
  const widening = new Set<number>([...neighbours, ...defs]);
  if (widening.size === 0) {
    return { ranked: [...ranked], widened: 0 };
  }

  const rankedIds = new Set(ranked.map((r) => r.id));
  const missing = [...widening].filter((id) => !rankedIds.has(id));
  if (missing.length === 0) {
    return { ranked: [...ranked], widened: 0 };
  }

  const out: HybridResult[] = [...ranked];
  const floor = out.length > 0 ? out[out.length - 1].score : 1;
  const base = floor > 0 ? floor * 0.9 : 1e-6;
  // Space injections by a negligible delta so stable sort order is
  // deterministic across platforms even for ties at the floor.
  for (let i = 0; i < missing.length; i++) {
    out.push({ id: missing[i], score: base - i * 1e-9 });
  }
  return { ranked: out, widened: missing.length };
}

/**
 * Build hybrid candidates from an analysis' clause list and any
 * attached embeddings. Positional alignment is enforced via
 * `clause_index` — embeddings with an out-of-range index are silently
 * dropped (they can only come from a drift between the saved clause
 * list and the saved embedding list, and we'd rather degrade to BM25
 * for those than throw mid-request).
 */
export function buildHybridCandidates(
  clauses: AnalyzedClause[],
  embeddings: ClauseEmbedding[] | null | undefined,
): HybridCandidate[] {
  const byIndex = new Map<number, number[]>();
  if (embeddings) {
    for (const e of embeddings) {
      if (
        typeof e.clause_index === "number" &&
        e.clause_index >= 0 &&
        e.clause_index < clauses.length
      ) {
        byIndex.set(e.clause_index, e.embedding);
      }
    }
  }

  return clauses.map((c, i) => {
    const text = [c.title, c.plain_english, c.clause_text]
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .join("\n\n");
    const emb = byIndex.get(i);
    const statuteCodes =
      c.applicable_law?.citations?.map((cit) => cit.code) ?? [];
    const base: HybridCandidate = {
      id: i,
      text,
      category: c.category,
      statuteCodes,
    };
    return emb ? { ...base, embedding: emb } : base;
  });
}
