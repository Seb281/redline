/**
 * SP-10 Arc 2 Task 2.3 — Jina Rerank client wrapper tests.
 *
 * The module under test is a thin HTTP client around Jina's /v1/rerank
 * endpoint. Contract:
 *   - Returns a reranked `{id, score}[]` ordered by relevance.
 *   - Fails soft: on any unrecoverable error (network, auth, 4xx other
 *     than 429, malformed JSON), returns the candidates in input order
 *     so the surrounding chat request can still serve an answer. A hard
 *     throw in this code path would take down a user-visible chat
 *     reply for a best-effort ranking improvement — not the right
 *     trade.
 *   - Retries on 429 and 5xx with capped exponential backoff.
 *   - No-op when `JINA_API_KEY` is absent — call site decides whether
 *     to wire the reranker based on env; the client itself refuses to
 *     call the API without a key.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createJinaReranker,
  type RerankCandidate,
} from "./rerank";

/** Fixture candidates — order is the pre-rerank input order. */
const CANDIDATES: RerankCandidate[] = [
  { id: 0, text: "Payment terms: Net 30." },
  { id: 1, text: "Confidentiality obligations survive termination." },
  { id: 2, text: "Governing law: German law applies." },
];

/** Shape a mock fetch response that matches Jina's /v1/rerank payload. */
function mockJinaResponse(ranking: { index: number; score: number }[]) {
  return new Response(
    JSON.stringify({
      model: "jina-reranker-v2-base-multilingual",
      usage: { total_tokens: 100 },
      results: ranking.map((r) => ({
        index: r.index,
        relevance_score: r.score,
      })),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("createJinaReranker", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns reranked ids in the order Jina produced", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJinaResponse([
        { index: 2, score: 0.9 },
        { index: 0, score: 0.5 },
        { index: 1, score: 0.2 },
      ]),
    );
    const rerank = createJinaReranker({
      apiKey: "test-key",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    const out = await rerank({ query: "what law applies?", candidates: CANDIDATES });
    expect(out.map((r) => r.id)).toEqual([2, 0, 1]);
    expect(out[0].score).toBeCloseTo(0.9);
  });

  it("respects topN by slicing the reranked output", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJinaResponse([
        { index: 2, score: 0.9 },
        { index: 0, score: 0.5 },
        { index: 1, score: 0.2 },
      ]),
    );
    const rerank = createJinaReranker({
      apiKey: "test-key",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    const out = await rerank({
      query: "q",
      candidates: CANDIDATES,
      topN: 2,
    });
    expect(out.map((r) => r.id)).toEqual([2, 0]);
  });

  it("posts only the document text + query (no ids leak across the wire)", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJinaResponse([{ index: 0, score: 0.1 }]),
    );
    const rerank = createJinaReranker({
      apiKey: "test-key",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await rerank({ query: "payment?", candidates: CANDIDATES });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.jina.ai/v1/rerank");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.query).toBe("payment?");
    expect(body.documents).toEqual(CANDIDATES.map((c) => c.text));
    expect(body).not.toHaveProperty("ids");
  });

  it("retries on 429 with backoff and succeeds on the follow-up", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response("rate limited", { status: 429 }),
      )
      .mockResolvedValueOnce(
        mockJinaResponse([
          { index: 1, score: 0.7 },
          { index: 0, score: 0.3 },
        ]),
      );
    const rerank = createJinaReranker({
      apiKey: "test-key",
      fetch: fetchSpy as unknown as typeof fetch,
      // Zero delay in tests — timing behaviour is encoded in the impl
      // but we do not want to wall-clock it here.
      backoffBaseMs: 0,
    });
    const out = await rerank({
      query: "q",
      candidates: CANDIDATES.slice(0, 2),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(out.map((r) => r.id)).toEqual([1, 0]);
  });

  it("fails soft to input order when the API keeps 5xx-ing", async () => {
    fetchSpy.mockResolvedValue(
      new Response("down", { status: 503 }),
    );
    const rerank = createJinaReranker({
      apiKey: "test-key",
      fetch: fetchSpy as unknown as typeof fetch,
      backoffBaseMs: 0,
      maxAttempts: 2,
    });
    const out = await rerank({ query: "q", candidates: CANDIDATES });
    expect(out.map((r) => r.id)).toEqual([0, 1, 2]);
    // Every returned entry carries a score so callers can branch on it.
    for (const r of out) {
      expect(typeof r.score).toBe("number");
    }
  });

  it("fails soft to input order on a network error", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    const rerank = createJinaReranker({
      apiKey: "test-key",
      fetch: fetchSpy as unknown as typeof fetch,
      backoffBaseMs: 0,
      maxAttempts: 1,
    });
    const out = await rerank({ query: "q", candidates: CANDIDATES });
    expect(out.map((r) => r.id)).toEqual([0, 1, 2]);
  });

  it("fails soft without calling fetch when the API key is empty", async () => {
    const rerank = createJinaReranker({
      apiKey: "",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    const out = await rerank({ query: "q", candidates: CANDIDATES });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out.map((r) => r.id)).toEqual([0, 1, 2]);
  });

  it("handles an empty candidate list without calling fetch", async () => {
    const rerank = createJinaReranker({
      apiKey: "test-key",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    const out = await rerank({ query: "q", candidates: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(out).toEqual([]);
  });

  it("fails soft on malformed JSON response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("{not:valid", { status: 200 }),
    );
    const rerank = createJinaReranker({
      apiKey: "test-key",
      fetch: fetchSpy as unknown as typeof fetch,
      backoffBaseMs: 0,
      maxAttempts: 1,
    });
    const out = await rerank({ query: "q", candidates: CANDIDATES });
    expect(out.map((r) => r.id)).toEqual([0, 1, 2]);
  });

  it("fails soft on an out-of-range index in the response", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJinaResponse([
        { index: 99, score: 0.9 },
        { index: 0, score: 0.5 },
      ]),
    );
    const rerank = createJinaReranker({
      apiKey: "test-key",
      fetch: fetchSpy as unknown as typeof fetch,
      backoffBaseMs: 0,
      maxAttempts: 1,
    });
    const out = await rerank({ query: "q", candidates: CANDIDATES });
    // 99 is invalid — whole response is distrusted, identity fallback
    // rather than partial results in an unpredictable order.
    expect(out.map((r) => r.id)).toEqual([0, 1, 2]);
  });
});
