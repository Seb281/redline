/**
 * Integration tests for the useStreamingAnalysis hook.
 *
 * Verifies the state machine transitions (idle -> analyzing_overview ->
 * awaiting_role -> analyzing -> complete/error) by mocking fetch at the
 * global level and asserting hook state after each operation.
 *
 * SP-1.9: fakeOverview uses `parties: Party[]` shape; confirmRedaction
 * tests use `Set<string>` (disabledTokens) instead of `Map<string, string>`.
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
  parties: [
    { name: "Alice", role_label: null },
    { name: "Bob", role_label: null },
  ],
  effective_date: null,
  duration: null,
  total_value: null,
  governing_jurisdiction: "the Netherlands",
  jurisdiction_evidence: { source_type: "stated", source_text: null },
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
  applicable_law: null,
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
    const fakeProvenance = {
      provider: "mistral",
      model: "mistral-small-4",
      snapshot: "mistral-small-2603",
      region: "eu-west-paris",
      reasoning_effort_per_pass: {
        overview: "low",
        extraction: "medium",
        risk: "high",
        think_hard: "high",
      },
      prompt_template_version: "1.0",
      timestamp: "2026-04-15T00:00:00.000Z",
    };
    const streamEvents = [
      { type: "extraction-complete", data: { clauseCount: 1 } },
      { type: "clause", data: fakeClause },
      {
        type: "complete",
        data: {
          total_clauses: 1,
          risk_breakdown: { high: 0, medium: 0, low: 1, informational: 0 },
          top_risks: [],
          provenance: fakeProvenance,
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

    let finalResponse: Awaited<ReturnType<typeof result.current.runAnalysis>> | null = null;
    await act(async () => {
      finalResponse = await result.current.runAnalysis("text", "fast", true, null);
    });

    expect(result.current.status).toBe("complete");
    expect(result.current.clauses).toHaveLength(1);
    expect(result.current.clauses[0].title).toBe("Termination");
    expect(result.current.summary).not.toBeNull();
    // Provenance from the `complete` event is folded into the response
    // returned by runAnalysis and must be available to callers that save
    // the analysis to the backend.
    expect(finalResponse).not.toBeNull();
    expect(finalResponse!.provenance).toEqual(fakeProvenance);
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

  it("parks in awaiting_redaction with populated tokenMap when PII is detected", async () => {
    // Raw text includes a party name returned by Pass 0 ("ACME Corp") and
    // an email pattern. After the two redaction phases merge, the hook
    // should pause on the preview screen with both tokens in its map.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        overview: {
          contract_type: "NDA",
          parties: [{ name: "ACME Corp", role_label: null }],
          effective_date: null,
          duration: null,
          total_value: null,
          governing_jurisdiction: "Netherlands",
          key_terms: [],
          clause_inventory: [{ title: "Confidentiality", section_ref: null }],
        },
      }),
    );

    const { result } = renderHook(() => useStreamingAnalysis());
    await act(async () => {
      await result.current.runOverview(
        "ACME Corp, email dpo@acme.eu, agrees to terms.",
      );
    });

    expect(result.current.status).toBe("awaiting_redaction");
    expect(result.current.tokenMap).not.toBeNull();
    expect(result.current.tokenMap!.size).toBeGreaterThanOrEqual(2);
    expect(result.current.rawText).toBe(
      "ACME Corp, email dpo@acme.eu, agrees to terms.",
    );
  });

  it("skips preview when no tokens detected (goes straight to awaiting_role)", async () => {
    // Parties don't appear in text, no patterns present — fullMap is
    // empty, so the preview has nothing to show and the hook jumps
    // straight to role select.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        overview: {
          contract_type: "Note",
          parties: [],
          effective_date: null,
          duration: null,
          total_value: null,
          governing_jurisdiction: null,
          key_terms: [],
          clause_inventory: [],
        },
      }),
    );

    const { result } = renderHook(() => useStreamingAnalysis());
    await act(async () => {
      await result.current.runOverview("Short plain text with nothing to redact.");
    });

    expect(result.current.status).toBe("awaiting_role");
    expect(result.current.tokenMap).not.toBeNull();
    expect(result.current.tokenMap!.size).toBe(0);
  });

  it("confirmRedaction transitions to awaiting_role with the user's active subset", async () => {
    // "NDA" contract type → heuristic maps to DISCLOSING_PARTY / RECEIVING_PARTY.
    // Party "ACME Corp" appears in text → gets a token in the map.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        overview: {
          contract_type: "NDA",
          parties: [{ name: "ACME Corp", role_label: null }],
          effective_date: null,
          duration: null,
          total_value: null,
          governing_jurisdiction: null,
          key_terms: [],
          clause_inventory: [],
        },
      }),
    );

    const { result } = renderHook(() => useStreamingAnalysis());
    await act(async () => {
      await result.current.runOverview("ACME Corp signed dpo@acme.eu");
    });

    expect(result.current.status).toBe("awaiting_redaction");

    // SP-1.9: confirmRedaction takes a Set<string> of tokens to DISABLE
    // (i.e. leave visible). Pass empty set = keep everything redacted.
    act(() => {
      result.current.confirmRedaction(new Set<string>());
    });

    expect(result.current.status).toBe("awaiting_role");
    // tokenMap should contain both the party token and the email token
    expect(result.current.tokenMap!.size).toBeGreaterThanOrEqual(1);
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

  it("seeds editableLabels from LLM role_label when provided", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        overview: {
          contract_type: "Services Agreement",
          parties: [
            { name: "ACME Corp", role_label: "Provider" },
            { name: "Beta LLC", role_label: "Client" },
          ],
          effective_date: null,
          duration: null,
          total_value: null,
          governing_jurisdiction: null,
          key_terms: [],
          clause_inventory: [],
        },
      }),
    );

    const { result } = renderHook(() => useStreamingAnalysis());
    await act(async () => {
      await result.current.runOverview("ACME Corp and Beta LLC agree.");
    });

    expect(result.current.editableLabels).toEqual(["PROVIDER", "CLIENT"]);
  });

  it("falls back to heuristic when role_label is null", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        overview: {
          contract_type: "Residential Lease",
          parties: [
            { name: "Landlord Co", role_label: null },
            { name: "Tenant Co", role_label: null },
          ],
          effective_date: null,
          duration: null,
          total_value: null,
          governing_jurisdiction: null,
          key_terms: [],
          clause_inventory: [],
        },
      }),
    );

    const { result } = renderHook(() => useStreamingAnalysis());
    await act(async () => {
      await result.current.runOverview("Landlord Co rents to Tenant Co.");
    });

    expect(result.current.editableLabels).toEqual(["LANDLORD", "TENANT"]);
  });

  it("confirmRedaction writes edited labels back to overview.parties[].role_label", async () => {
    // Regression guard: ReportView (final report) renders ContractOverview
    // without a labels prop, so it falls back to deriveLabels() which reads
    // `party.role_label`. If the user edits a label in RedactionPreview, the
    // final report must reflect the edit — not the original Pass 0 label.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        overview: {
          contract_type: "Services Agreement",
          parties: [
            { name: "ACME Corp", role_label: "Provider" },
            { name: "Beta LLC", role_label: "Client" },
          ],
          effective_date: null,
          duration: null,
          total_value: null,
          governing_jurisdiction: null,
          key_terms: [],
          clause_inventory: [],
        },
      }),
    );

    const { result } = renderHook(() => useStreamingAnalysis());
    await act(async () => {
      await result.current.runOverview("ACME Corp and Beta LLC agree.");
    });

    expect(result.current.editableLabels).toEqual(["PROVIDER", "CLIENT"]);

    // User renames the first party.
    act(() => {
      result.current.updatePartyLabel(0, "VENDOR");
    });
    expect(result.current.editableLabels).toEqual(["VENDOR", "CLIENT"]);

    act(() => {
      result.current.confirmRedaction(new Set<string>());
    });

    expect(result.current.status).toBe("awaiting_role");
    // The edited label must land on the overview so downstream consumers
    // (ReportView, saved analyses) see the user's choice, not Pass 0's.
    expect(result.current.overview?.parties[0].role_label).toBe("VENDOR");
    expect(result.current.overview?.parties[1].role_label).toBe("CLIENT");
  });
});
