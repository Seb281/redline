/**
 * SP-9 — transparency receipt builder + filename shape.
 *
 * The receipt is an audit artifact that must stay byte-stable across
 * releases for a given schema version. These tests guard the public
 * shape (kind + schema_version discriminators, expected keys,
 * pipeline/articles/levers/limitations arrays) against accidental
 * drift, and assert the filename convention used by the download
 * helper.
 */

import { describe, it, expect } from "vitest";
import {
  buildReceipt,
  receiptFilename,
  type TransparencyReceipt,
} from "./transparency-receipt";
import type { AnalyzeResponse, AnalysisProvenance } from "@/types";

function fakeProvenance(
  overrides: Partial<AnalysisProvenance> = {},
): AnalysisProvenance {
  return {
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
    prompt_template_version: "1.2",
    timestamp: "2026-04-20T10:00:00.000Z",
    redaction_location: "client",
    analysis_locale: "en",
    schema_version: "1",
    ...overrides,
  };
}

function fakeResponse(
  overrides: Partial<AnalyzeResponse> = {},
): AnalyzeResponse {
  return {
    overview: {
      contract_type: "SaaS",
      parties: [],
      effective_date: null,
      duration: null,
      total_value: null,
      governing_jurisdiction: null,
      jurisdiction_evidence: null,
      key_terms: [],
      clause_inventory: [],
    },
    summary: {
      total_clauses: 2,
      risk_breakdown: { high: 1, medium: 0, low: 1, informational: 0 },
      top_risks: [],
    },
    clauses: [
      {
        clause_text: "",
        category: "governing_law",
        title: "",
        plain_english: "",
        risk_level: "low",
        risk_explanation: "",
        negotiation_suggestion: null,
        is_unusual: false,
        unusual_explanation: null,
        applicable_law: null,
      },
      {
        clause_text: "",
        category: "non_compete",
        title: "",
        plain_english: "",
        risk_level: "high",
        risk_explanation: "",
        negotiation_suggestion: null,
        is_unusual: false,
        unusual_explanation: null,
        applicable_law: null,
      },
    ],
    provenance: fakeProvenance(),
    ...overrides,
  };
}

describe("buildReceipt", () => {
  it("wraps provenance with the canonical kind + schema discriminators", () => {
    const receipt = buildReceipt(fakeResponse());
    expect(receipt.kind).toBe("redline.transparency.receipt");
    expect(receipt.schema_version).toBe("1");
  });

  it("inherits schema_version from provenance when present", () => {
    const receipt = buildReceipt(
      fakeResponse({
        provenance: fakeProvenance({ schema_version: "2" }),
      }),
    );
    expect(receipt.schema_version).toBe("2");
  });

  it("falls back to '1' when provenance omits schema_version (legacy rows)", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { schema_version, ...rest } = fakeProvenance();
    const receipt = buildReceipt(
      fakeResponse({ provenance: rest as AnalysisProvenance }),
    );
    expect(receipt.schema_version).toBe("1");
  });

  it("carries analysis metadata without leaking clause text", () => {
    const receipt = buildReceipt(fakeResponse(), {
      id: "abc-123",
      filename: "contract.pdf",
    });
    expect(receipt.analysis.id).toBe("abc-123");
    expect(receipt.analysis.filename).toBe("contract.pdf");
    expect(receipt.analysis.clause_count).toBe(2);
    expect(receipt.analysis.analysis_locale).toBe("en");
    // Privacy-by-design: the receipt must not carry contract text,
    // per-clause text, the ContractOverview payload, or the full
    // clauses array. The analysis sub-object is restricted to the
    // four identifier fields.
    const r = receipt as unknown as Record<string, unknown>;
    expect(r.contract_text).toBeUndefined();
    expect(r.overview).toBeUndefined();
    expect(r.clauses).toBeUndefined();
    expect(r.summary).toBeUndefined();
    expect(Object.keys(receipt.analysis).sort()).toEqual([
      "analysis_locale",
      "clause_count",
      "filename",
      "id",
    ]);
    expect(JSON.stringify(receipt)).not.toMatch(/"clause_text"/);
  });

  it("serialises the five-stage pipeline in order", () => {
    const receipt = buildReceipt(fakeResponse());
    expect(receipt.pipeline.map((p) => p.key)).toEqual([
      "pass0",
      "redaction",
      "pass1",
      "pass2",
      "chat",
    ]);
  });

  it("always emits both AI Act articles and all operator levers", () => {
    const receipt = buildReceipt(fakeResponse());
    const refs = receipt.ai_act_articles.map((a) => a.reference);
    expect(refs).toContain("Art. 13");
    expect(refs).toContain("Art. 50");
    expect(receipt.operator_levers.length).toBeGreaterThan(0);
    expect(receipt.limitations.length).toBeGreaterThan(0);
  });
});

describe("receiptFilename", () => {
  function sample(
    overrides: Partial<TransparencyReceipt> = {},
  ): TransparencyReceipt {
    return {
      ...buildReceipt(fakeResponse(), { filename: "contract-v2.pdf" }),
      generated_at: "2026-04-20T10:00:00.000Z",
      ...overrides,
    };
  }

  it("includes the stem + date in the filename", () => {
    expect(receiptFilename(sample())).toBe(
      "redline-receipt-contract-v2-20260420.json",
    );
  });

  it("drops the stem when no filename is available", () => {
    expect(
      receiptFilename(
        sample({
          analysis: {
            id: null,
            filename: null,
            clause_count: 0,
            analysis_locale: null,
          },
        }),
      ),
    ).toBe("redline-receipt-20260420.json");
  });

  it("sanitises unsafe characters in the stem", () => {
    expect(
      receiptFilename(
        sample({
          analysis: {
            id: null,
            filename: "My Contract / final!.pdf",
            clause_count: 0,
            analysis_locale: null,
          },
        }),
      ),
    ).toBe("redline-receipt-My-Contract-final-20260420.json");
  });
});
