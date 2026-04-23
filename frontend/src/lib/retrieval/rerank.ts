/**
 * SP-10 Arc 2 Task 2.3 — Jina Rerank client.
 *
 * Thin HTTP wrapper around Jina's `/v1/rerank` endpoint. The only
 * relevance-ranking layer in the SP-10 stack that sees the full clause
 * text (not just tokens or embeddings), so this is the layer that can
 * disambiguate near-identical BM25/cosine candidates — the biggest
 * expected single-layer lift per the plan.
 *
 * Design tenets:
 *   - **Fail-soft by construction.** Chat answers must not wedge on a
 *     best-effort reranker. Every error path falls back to the
 *     pre-rerank order (identity ranking). The caller always gets a
 *     valid `RerankResult[]`.
 *   - **Retry on transient errors only.** 429 and 5xx are retriable
 *     with capped exponential backoff. 4xx (other than 429) is a
 *     contract error — no point retrying, return identity.
 *   - **No partial results.** If Jina returns something we can't fully
 *     validate (out-of-range index, malformed JSON), we throw the whole
 *     response away rather than composing a half-reranked list. A
 *     non-deterministic partial result would be harder to debug than an
 *     honest identity fallback.
 *   - **No key, no call.** The client refuses to issue requests when
 *     `apiKey` is empty — deployments without `JINA_API_KEY` degrade
 *     silently to identity instead of getting 401s in the logs.
 *
 * Provider residency: Jina AI is EU-hosted (Berlin). Adding it to the
 * data-residency page + transparency map lives in `data-flows.ts` and
 * `messages/*.json` — this module stays free of any user-facing copy.
 */

const JINA_RERANK_URL = "https://api.jina.ai/v1/rerank";

/**
 * Model pin. `jina-reranker-v2-base-multilingual` covers every language
 * in our EU corpus (EN/FR/DE/NL/ES/IT/PL) without a per-language model
 * split. Keep the pin literal so bumps are deliberate, reviewable, and
 * show up in git blame alongside the eval re-pin that justified them.
 */
const JINA_MODEL = "jina-reranker-v2-base-multilingual";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_BASE_MS = 250;
const DEFAULT_BACKOFF_CAP_MS = 2000;

/** One candidate passed into the reranker. */
export interface RerankCandidate {
  id: number;
  text: string;
}

/** One reranked result. `score` is Jina's `relevance_score`. */
export interface RerankResult {
  id: number;
  score: number;
}

/** Arguments to a single rerank call. */
export interface RerankInput {
  query: string;
  candidates: readonly RerankCandidate[];
  /** Max results to return. Defaults to all candidates. */
  topN?: number;
}

/**
 * Rerank function signature — decouples call sites from the concrete
 * Jina client so test fixtures can inject a deterministic cached
 * reranker in the eval harness.
 */
export type RerankFn = (input: RerankInput) => Promise<RerankResult[]>;

/** Factory options. `fetch` + backoff knobs exist for test injection. */
export interface CreateJinaRerankerOptions {
  apiKey: string;
  /** Inject a mock fetch in tests. Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
  /** Max retry attempts on transient errors. Defaults to 3. */
  maxAttempts?: number;
  /** Base of the exponential backoff in ms. Defaults to 250. */
  backoffBaseMs?: number;
  /** Cap on a single backoff delay in ms. Defaults to 2000. */
  backoffCapMs?: number;
}

/** Identity ranking: preserves input order, scores zero. Used as fail-soft fallback. */
function identityRanking(
  candidates: readonly RerankCandidate[],
  topN?: number,
): RerankResult[] {
  const out = candidates.map((c) => ({ id: c.id, score: 0 }));
  return typeof topN === "number" ? out.slice(0, topN) : out;
}

/** Simple sleep helper for the backoff loop. */
function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate a Jina response payload. Returns the mapped result list
 * on success or `null` on any malformed field — caller falls back to
 * identity on null.
 */
function parseJinaResults(
  raw: unknown,
  candidates: readonly RerankCandidate[],
): RerankResult[] | null {
  if (typeof raw !== "object" || raw === null) return null;
  const results = (raw as { results?: unknown }).results;
  if (!Array.isArray(results)) return null;
  const out: RerankResult[] = [];
  const seen = new Set<number>();
  for (const entry of results) {
    if (typeof entry !== "object" || entry === null) return null;
    const { index, relevance_score } = entry as {
      index?: unknown;
      relevance_score?: unknown;
    };
    if (typeof index !== "number" || !Number.isInteger(index)) return null;
    if (typeof relevance_score !== "number") return null;
    if (index < 0 || index >= candidates.length) return null;
    if (seen.has(index)) return null;
    seen.add(index);
    out.push({ id: candidates[index].id, score: relevance_score });
  }
  return out;
}

/**
 * Build a rerank function bound to Jina. Returns a `RerankFn` that
 * takes `{ query, candidates, topN? }` and resolves to a scored rank.
 * Errors are absorbed — the returned promise never rejects.
 */
export function createJinaReranker(
  options: CreateJinaRerankerOptions,
): RerankFn {
  const {
    apiKey,
    fetch: fetchImpl = globalThis.fetch,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    backoffBaseMs = DEFAULT_BACKOFF_BASE_MS,
    backoffCapMs = DEFAULT_BACKOFF_CAP_MS,
  } = options;

  return async ({ query, candidates, topN }) => {
    if (candidates.length === 0) return [];
    if (!apiKey) return identityRanking(candidates, topN);

    const body = JSON.stringify({
      model: JINA_MODEL,
      query,
      documents: candidates.map((c) => c.text),
      // Jina's `top_n` caps the result list server-side; request the
      // full candidate count when unspecified so the caller can slice
      // to its own topN without a second round-trip on mismatch.
      top_n: topN ?? candidates.length,
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let response: Response | null = null;
      try {
        response = await fetchImpl(JINA_RERANK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body,
        });
      } catch {
        // Network-level failure: retry if budget remains, else fall
        // through to identity fallback outside the loop.
        if (attempt < maxAttempts) {
          await sleep(
            Math.min(backoffBaseMs * 2 ** (attempt - 1), backoffCapMs),
          );
          continue;
        }
        break;
      }

      if (response.ok) {
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          return identityRanking(candidates, topN);
        }
        const parsed = parseJinaResults(payload, candidates);
        if (parsed === null) return identityRanking(candidates, topN);
        return typeof topN === "number" ? parsed.slice(0, topN) : parsed;
      }

      const retriable = response.status === 429 || response.status >= 500;
      if (!retriable || attempt >= maxAttempts) {
        return identityRanking(candidates, topN);
      }
      await sleep(
        Math.min(backoffBaseMs * 2 ** (attempt - 1), backoffCapMs),
      );
    }

    return identityRanking(candidates, topN);
  };
}
