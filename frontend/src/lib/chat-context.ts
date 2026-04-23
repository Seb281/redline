/**
 * SP-10 Arc 1 Phase 3 — build focused chat context via hybrid retrieval.
 *
 * Replaces the SP-1 keyword-overlap selector with the BM25 + cosine
 * hybrid ranker. Signature stays compatible with the old call site
 * (question + analysis → ChatContext), but the function is now async
 * because the query must be embedded before the semantic branch can
 * run. The chat route awaits the result.
 *
 * Degradation policy (mirrors `hybridRetrieve`):
 *   - Saved analyses with no embeddings (pre-SP-10 rows) → BM25 alone,
 *     no query embed attempted, no extra latency spent.
 *   - Query embed fails → BM25 alone. Logged as `embed_query_failed`.
 *   - ≤ MAX_CLAUSES clauses total → return all, skip retrieval
 *     entirely. Matches legacy behaviour; avoids a needless embed call
 *     on small contracts.
 */

import { embed } from "ai";
import { mistral } from "@ai-sdk/mistral";
import type {
  AnalyzedClause,
  AnalyzeResponse,
  AnalysisSummary,
  ContractOverview,
  ClauseEmbedding,
} from "@/types";
import { MISTRAL_EMBED_DIM } from "@/types";
import { buildHybridCandidates, hybridRetrieve } from "@/lib/retrieval/hybrid";
import { logPass } from "@/lib/llm/debug-log";

const MAX_CLAUSES = 5;
const EMBEDDING_MODEL_ID = "mistral-embed";

export interface ChatContext {
  overview: ContractOverview;
  summary: AnalysisSummary;
  relevantClauses: AnalyzedClause[];
}

/**
 * Embed the user's question. Returns `null` on any failure (network,
 * rate-limit, dimension regression) — callers fall back to BM25-only.
 */
async function embedQuery(question: string): Promise<number[] | null> {
  if (!question.trim()) return null;
  try {
    const result = await embed({
      model: mistral.embedding(EMBEDDING_MODEL_ID),
      value: question,
    });
    const vec = result.embedding;
    if (!Array.isArray(vec) || vec.length !== MISTRAL_EMBED_DIM) {
      logPass("chat_retrieval", {
        event: "embed_query_bad_dimension",
        got: Array.isArray(vec) ? vec.length : -1,
      });
      return null;
    }
    return vec;
  } catch (err) {
    logPass("chat_retrieval", {
      event: "embed_query_failed",
      reason: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

/**
 * Select the most relevant clauses for a chat question using the
 * hybrid retriever. Always returns overview + summary, plus up to
 * {@link MAX_CLAUSES} clauses ordered by fused RRF score. Falls back
 * to the full clause list when the analysis holds fewer clauses than
 * the cap.
 */
export async function buildChatContext(
  question: string,
  analysis: AnalyzeResponse,
): Promise<ChatContext> {
  if (analysis.clauses.length <= MAX_CLAUSES) {
    return {
      overview: analysis.overview,
      summary: analysis.summary,
      relevantClauses: analysis.clauses,
    };
  }

  const embeddings: ClauseEmbedding[] | undefined = analysis.clause_embeddings;
  const hasIndexedEmbeddings =
    Array.isArray(embeddings) && embeddings.length > 0;

  // Only embed the query if the analysis actually has clause embeddings
  // to score against — otherwise the round-trip is wasted.
  const queryEmbedding = hasIndexedEmbeddings
    ? await embedQuery(question)
    : null;

  const candidates = buildHybridCandidates(analysis.clauses, embeddings);
  const fused = await hybridRetrieve({
    query: question,
    queryEmbedding,
    candidates,
    topN: MAX_CLAUSES,
    clauses: analysis.clauses,
    graphWidening: true,
  });

  // Map fused ids back to clauses. Ids are positional indices into the
  // original clauses array (set by buildHybridCandidates), so this is a
  // direct lookup.
  const relevantClauses = fused
    .map((r) => analysis.clauses[r.id])
    .filter((c): c is AnalyzedClause => c !== undefined);

  // Fallback: if hybrid returned nothing (extremely unlikely — BM25
  // with an empty query would still return zero-score rows, and we'd
  // have bailed at the MAX_CLAUSES check), emit the first N clauses so
  // the chat reply has at least structural context.
  if (relevantClauses.length === 0) {
    return {
      overview: analysis.overview,
      summary: analysis.summary,
      relevantClauses: analysis.clauses.slice(0, MAX_CLAUSES),
    };
  }

  return {
    overview: analysis.overview,
    summary: analysis.summary,
    relevantClauses,
  };
}
