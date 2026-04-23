/**
 * SP-10 Arc 1 Phase 2 — Mistral `mistral-embed` wrapper for per-clause
 * vectors that feed the hybrid retriever (vector half).
 *
 * Design notes:
 *   - Composite text per clause (title + plain_english + clause_text).
 *     Titles anchor keyword-like questions, plain_english captures the
 *     concept in user-language, and clause_text preserves the original
 *     legal phrasing (including defined terms). Empirically, blending
 *     all three beats any single field on domain retrieval.
 *   - `embedMany` is used so the SDK can batch + auto-retry (default
 *     `maxRetries=2`, exponential backoff) without a hand-rolled loop
 *     here. Single round-trip per analysis keeps latency + cost
 *     predictable.
 *   - Fail-soft: any thrown error collapses to a `null` return so the
 *     caller can log the failure, surface an unobtrusive note in the
 *     footer, and let chat fall back to keyword overlap. Partial
 *     results are refused — see the test file for the rationale.
 *   - Dimension check enforces 1024 on the wire (Mistral's fixed embed
 *     dim). Mismatches are treated as upstream regressions and fail
 *     soft so we never write a corrupted vector into the pgvector
 *     index.
 */

import { embed, embedMany } from "ai";
import { mistral } from "@ai-sdk/mistral";
import type { AnalyzedClause, ClauseEmbedding } from "@/types";
import { MISTRAL_EMBED_DIM } from "@/types";
import { logPass } from "./debug-log";

const EMBEDDING_MODEL_ID = "mistral-embed";

/**
 * Build the composite retrieval text for a single clause.
 *
 * Keeps each field on its own line so downstream BM25 tokenisation sees
 * the same shape as the source material (paragraph breaks matter for
 * lexical scoring). Missing fields are dropped cleanly rather than
 * left as empty separators.
 */
export function buildClauseEmbeddingText(clause: AnalyzedClause): string {
  const parts = [clause.title, clause.plain_english, clause.clause_text]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0);
  return parts.join("\n\n");
}

/**
 * Embed every clause in order. Returns `ClauseEmbedding[]` on success
 * (1:1 positional match with the input), `null` on any failure.
 */
export async function embedClauses(
  clauses: AnalyzedClause[],
): Promise<ClauseEmbedding[] | null> {
  if (clauses.length === 0) return [];

  const values = clauses.map(buildClauseEmbeddingText);

  const started = performance.now();
  try {
    const result = await embedMany({
      model: mistral.embedding(EMBEDDING_MODEL_ID),
      values,
    });

    if (result.embeddings.length !== clauses.length) {
      logPass("pass2", {
        event: "embeddings_count_mismatch",
        expected: clauses.length,
        got: result.embeddings.length,
      });
      return null;
    }

    const out: ClauseEmbedding[] = [];
    for (let i = 0; i < result.embeddings.length; i += 1) {
      const vec = result.embeddings[i];
      if (!Array.isArray(vec) || vec.length !== MISTRAL_EMBED_DIM) {
        logPass("pass2", {
          event: "embeddings_bad_dimension",
          clause: i,
          got: Array.isArray(vec) ? vec.length : -1,
        });
        return null;
      }
      out.push({ clause_index: i, embedding: vec });
    }

    logPass("pass2", {
      event: "embeddings_ok",
      clauses: out.length,
      ms: Math.round(performance.now() - started),
    });
    return out;
  } catch (err) {
    logPass("pass2", {
      event: "embeddings_failed",
      reason: err instanceof Error ? err.message : "unknown",
      ms: Math.round(performance.now() - started),
    });
    return null;
  }
}

/**
 * SP-10 Arc 3 — embed a single user query for cross-analysis semantic
 * search.
 *
 * Separate from :func:`embedClauses` because the caller is a tiny
 * Next.js API route that only needs one round-trip per search —
 * ``embedMany`` would still work but ``embed`` keeps the intent
 * obvious and avoids allocating a single-element array in a hot path.
 *
 * Dimension check mirrors :func:`embedClauses`: any drift from
 * :data:`MISTRAL_EMBED_DIM` collapses to ``null`` so the route can
 * return 502 without shipping a corrupted vector at the backend index.
 */
export async function embedQuery(query: string): Promise<number[] | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const started = performance.now();
  try {
    const result = await embed({
      model: mistral.embedding(EMBEDDING_MODEL_ID),
      value: trimmed,
    });

    const vec = result.embedding;
    if (!Array.isArray(vec) || vec.length !== MISTRAL_EMBED_DIM) {
      logPass("search", {
        event: "query_embedding_bad_dimension",
        got: Array.isArray(vec) ? vec.length : -1,
      });
      return null;
    }

    logPass("search", {
      event: "query_embedding_ok",
      chars: trimmed.length,
      ms: Math.round(performance.now() - started),
    });
    return vec;
  } catch (err) {
    logPass("search", {
      event: "query_embedding_failed",
      reason: err instanceof Error ? err.message : "unknown",
      ms: Math.round(performance.now() - started),
    });
    return null;
  }
}
