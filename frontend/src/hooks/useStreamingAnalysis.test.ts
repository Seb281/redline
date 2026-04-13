/**
 * Integration tests for the useStreamingAnalysis hook.
 *
 * Verifies the state machine transitions (idle -> analyzing_overview ->
 * awaiting_role -> analyzing -> complete/error) by mocking fetch at the
 * global level and asserting hook state after each operation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStreamingAnalysis } from "./useStreamingAnalysis";

/** Helper: create a ReadableStream from NDJSON lines. */
function createNdjsonStream(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = events.map((e) => JSON.stringify(e) + "\n").join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
}

/** Helper: create a mock Response with JSON body. */
function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Helper: create a mock Response with a readable stream body. */
function mockStreamResponse(
  stream: ReadableStream<Uint8Array>,
  status = 200,
): Response {
  return new Response(stream, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const fakeOverview = {
  contract_type: "Test Agreement",
  parties: ["Alice", "Bob"],
  effective_date: null,
  duration: null,
  total_value: null,
  governing_jurisdiction: "the Netherlands",
  key_terms: ["Term 1"],
  clause_inventory: [{ title: "Clause 1", section_ref: null }],
};

const fakeClause = {
  clause_text: "text",
  category: "termination",
  title: "Termination",
  plain_english: "You can leave.",
  risk_level: "low",
  risk_explanation: "Standard.",
  negotiation_suggestion: null,
  is_unusual: false,
  unusual_explanation: null,
  jurisdiction_note: null,
  citations: [],
};

describe("useStreamingAnalysis", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useStreamingAnalysis());
    expect(result.current.status).toBe("idle");
    expect(result.current.overview).toBeNull();
    expect(result.current.clauses).toEqual([]);
  });

  it("transitions through overview -> awaiting_role", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ overview: fakeOverview }),
    );

    const { result } = renderHook(() => useStreamingAnalysis());

    await act(async () => {
      await result.current.runOverview("contract text");
    });

    expect(result.current.status).toBe("awaiting_role");
    expect(result.current.overview).toEqual(fakeOverview);
  });

  it("accumulates clauses from stream events", async () => {
    const streamEvents = [
      { type: "extraction-complete", data: { clauseCount: 1 } },
      { type: "clause", data: fakeClause },
      {
        type: "complete",
        data: {
          total_clauses: 1,
          risk_breakdown: { high: 0, medium: 0, low: 1, informational: 0 },
          top_risks: [],
        },
      },
    ];

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockJsonResponse({ overview: fakeOverview }))
      .mockResolvedValueOnce(
        mockStreamResponse(createNdjsonStream(streamEvents)),
      );

    const { result } = renderHook(() => useStreamingAnalysis());

    await act(async () => {
      await result.current.runOverview("text");
    });

    await act(async () => {
      await result.current.runAnalysis("text", "fast", true, null);
    });

    expect(result.current.status).toBe("complete");
    expect(result.current.clauses).toHaveLength(1);
    expect(result.current.clauses[0].title).toBe("Termination");
    expect(result.current.summary).not.toBeNull();
  });

  it("transitions to error on stream error event", async () => {
    const streamEvents = [
      { type: "error", data: { message: "Model overloaded" } },
    ];

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockJsonResponse({ overview: fakeOverview }))
      .mockResolvedValueOnce(
        mockStreamResponse(createNdjsonStream(streamEvents)),
      );

    const { result } = renderHook(() => useStreamingAnalysis());

    await act(async () => {
      await result.current.runOverview("text");
    });

    await act(async () => {
      await result.current.runAnalysis("text", "fast", true, null);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Model overloaded");
  });

  it("transitions to error when overview fetch fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ detail: "Server error" }, 500),
    );

    const { result } = renderHook(() => useStreamingAnalysis());

    await act(async () => {
      await result.current.runOverview("text");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Server error");
    expect(result.current.overview).toBeNull();
  });

  it("reset clears state back to idle", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ overview: fakeOverview }),
    );

    const { result } = renderHook(() => useStreamingAnalysis());

    await act(async () => {
      await result.current.runOverview("text");
    });

    expect(result.current.status).toBe("awaiting_role");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.overview).toBeNull();
  });
});
