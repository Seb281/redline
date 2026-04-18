import { describe, it, expect } from "vitest";
import {
  analyzedClauseSchema,
  buildRiskBreakdown,
  capInventory,
  contractOverviewSchema,
  formatInventoryPrompt,
  buildExtractionPrompt,
  buildAnalysisSystemPrompt,
  buildProvenance,
  OVERVIEW_SYSTEM_PROMPT,
  PROMPT_TEMPLATE_VERSION,
  reconcileJurisdiction,
  shouldRetryPass2,
  INVENTORY_CAP_CEILING,
  INVENTORY_CAP_BYTES_PER_ITEM,
  INVENTORY_CAP_FLOOR,
  PASS2_RETRY_THRESHOLD,
} from "./analyzer";
import type { LLMProvider } from "@/lib/llm/provider";

describe("buildRiskBreakdown", () => {
  it("counts each risk level correctly", () => {
    const clauses = [
      { risk_level: "high" },
      { risk_level: "high" },
      { risk_level: "medium" },
      { risk_level: "low" },
      { risk_level: "informational" },
      { risk_level: "informational" },
      { risk_level: "informational" },
    ];
    expect(buildRiskBreakdown(clauses)).toEqual({
      high: 2,
      medium: 1,
      low: 1,
      informational: 3,
    });
  });

  it("returns all zeros for empty array", () => {
    expect(buildRiskBreakdown([])).toEqual({
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    });
  });
});

describe("formatInventoryPrompt", () => {
  it("formats items with section refs", () => {
    const items = [
      { title: "Non-Compete", section_ref: "Section 6.1" },
      { title: "Governing Law", section_ref: null },
    ];
    const result = formatInventoryPrompt(items);
    expect(result).toBe("1. Non-Compete (Section 6.1)\n2. Governing Law");
  });

  it("returns empty string for empty inventory", () => {
    expect(formatInventoryPrompt([])).toBe("");
  });
});

describe("buildExtractionPrompt", () => {
  it("includes inventory count and contract text", () => {
    const inventory = [
      { title: "Termination", section_ref: "Section 3" },
      { title: "Payment", section_ref: null },
    ];
    const result = buildExtractionPrompt("Contract body here", inventory);
    expect(result).toContain("2 clauses");
    expect(result).toContain("1. Termination (Section 3)");
    expect(result).toContain("2. Payment");
    expect(result).toContain("Contract body here");
  });
});

describe("buildAnalysisSystemPrompt", () => {
  it("includes citation instructions when enabled", () => {
    const prompt = buildAnalysisSystemPrompt(true);
    expect(prompt).toContain("[^1]");
    expect(prompt).not.toContain("Citations (disabled");
  });

  it("disables citations when flag is false", () => {
    const prompt = buildAnalysisSystemPrompt(false);
    expect(prompt).toContain("Citations (disabled");
    expect(prompt).toContain("citations: []");
  });

  it("includes role perspective when userRole provided", () => {
    const prompt = buildAnalysisSystemPrompt(true, "Tenant");
    expect(prompt).toContain("from the perspective of Tenant");
  });

  it("uses weaker-party framing when no role", () => {
    const prompt = buildAnalysisSystemPrompt(true, null);
    expect(prompt).toContain("weaker");
  });

});

describe("buildProvenance", () => {
  /**
   * Minimal fake provider for provenance assembly tests. The `model`
   * factory is unused — `buildProvenance` only reads name/snapshot/region.
   */
  function fakeProvider(overrides: Partial<LLMProvider> = {}): LLMProvider {
    return {
      name: "mistral",
      model: () => ({}) as never,
      snapshot: () => "mistral-small-2603",
      region: "eu-west-paris",
      ...overrides,
    };
  }

  it("mirrors the provider name, snapshot, and region", () => {
    const p = fakeProvider();
    const prov = buildProvenance(p);
    expect(prov.provider).toBe("mistral");
    expect(prov.snapshot).toBe("mistral-small-2603");
    expect(prov.region).toBe("eu-west-paris");
  });

  it("derives model id from provider name", () => {
    expect(buildProvenance(fakeProvider({ name: "mistral" })).model).toBe(
      "mistral-small-4",
    );
    expect(buildProvenance(fakeProvider({ name: "openai" })).model).toBe(
      "gpt-4.1-nano",
    );
  });

  it("records the fixed per-pass reasoning-effort policy", () => {
    const prov = buildProvenance(fakeProvider());
    expect(prov.reasoning_effort_per_pass).toEqual({
      overview: "low",
      extraction: "medium",
      risk: "high",
      think_hard: "high",
    });
  });

  it("emits a prompt-template version and ISO timestamp", () => {
    const prov = buildProvenance(fakeProvider());
    expect(prov.prompt_template_version).toMatch(/^\d+\.\d+/);
    // ISO-8601 round-trip — parsing back gives a valid date.
    expect(Number.isNaN(new Date(prov.timestamp).getTime())).toBe(false);
    expect(prov.timestamp).toMatch(/T.*Z$/);
  });
});

/**
 * `capInventory` protects Pass 2 from collapsing on over-segmented
 * overviews. See `docs/diagnostics/2026-04-16-nl-freelance-mistral-small.md`.
 *
 * Formula: `max(FLOOR, min(CEILING, floor(rawLen / BYTES_PER_ITEM)))`.
 * Tests here lock the divisor, the absolute ceiling, and the absolute
 * floor so none can silently drift. Pure function — no logger spy.
 */
describe("capInventory", () => {
  const fakeItem = (title: string) => ({ title, section_ref: null });

  it("returns the inventory unchanged when under the cap", () => {
    const inventory = Array.from({ length: 10 }, (_, i) => fakeItem(`c${i}`));
    const rawLen = 10 * INVENTORY_CAP_BYTES_PER_ITEM + 1;
    const result = capInventory(inventory, rawLen);
    expect(result.inventory).toHaveLength(10);
    expect(result.inventory).toEqual(inventory);
    expect(result.capped).toBe(false);
    expect(result.originalCount).toBe(10);
  });

  it("truncates the inventory to rawLen/BYTES_PER_ITEM when under the ceiling", () => {
    // 9000 / 400 = 22 → inventory of 46 should cap at 22.
    const rawLen = 9000;
    const expected = Math.floor(rawLen / INVENTORY_CAP_BYTES_PER_ITEM);
    const inventory = Array.from({ length: 46 }, (_, i) => fakeItem(`c${i}`));
    const result = capInventory(inventory, rawLen);
    expect(result.inventory).toHaveLength(expected);
    expect(result.inventory[0]).toEqual(fakeItem("c0"));
    expect(result.inventory[expected - 1]).toEqual(fakeItem(`c${expected - 1}`));
    expect(result.capped).toBe(true);
    expect(result.originalCount).toBe(46);
  });

  it("never exceeds the absolute ceiling regardless of rawLen", () => {
    // 100KB would permit 250 items by the divisor; ceiling must clamp to 40.
    const rawLen = 100_000;
    const inventory = Array.from({ length: 300 }, (_, i) => fakeItem(`c${i}`));
    const result = capInventory(inventory, rawLen);
    expect(result.inventory).toHaveLength(INVENTORY_CAP_CEILING);
    expect(result.capped).toBe(true);
  });

  it("returns inventory unchanged when within both cap and ceiling", () => {
    const rawLen = 100_000;
    const inventory = Array.from({ length: 35 }, (_, i) => fakeItem(`c${i}`));
    // 35 < ceiling 40, and 35 < 100000/400 = 250 → no truncation.
    const result = capInventory(inventory, rawLen);
    expect(result.inventory).toHaveLength(35);
    expect(result.capped).toBe(false);
  });

  it("handles empty inventories without throwing", () => {
    expect(capInventory([], 0)).toEqual({
      inventory: [],
      capped: false,
      originalCount: 0,
    });
    expect(capInventory([], 10_000)).toEqual({
      inventory: [],
      capped: false,
      originalCount: 0,
    });
  });

  it("clamps cap to FLOOR so tiny contracts never wipe a non-empty inventory", () => {
    // rawLen < BYTES_PER_ITEM → divisor gives 0. FLOOR must rescue the cap
    // so a 50–399-char contract (above backend <50 gate, below one item by
    // divisor) still forwards at least one clause to Pass 1.
    const inventory = Array.from({ length: 5 }, (_, i) => fakeItem(`c${i}`));
    for (const rawLen of [0, 50, 399]) {
      const result = capInventory(inventory, rawLen);
      expect(result.inventory).toHaveLength(INVENTORY_CAP_FLOOR);
      expect(result.inventory[0]).toEqual(fakeItem("c0"));
      expect(result.capped).toBe(true);
    }
  });
});

/**
 * `shouldRetryPass2` decides when to reissue a Pass 2 call after the
 * model returned fewer analyzed clauses than Pass 1 extracted. The
 * retry guard defends the fast-mode batch path (streaming and
 * non-streaming) from the collapse observed on Mistral Small where
 * Pass 2 short-circuited to a single informational clause.
 */
describe("shouldRetryPass2", () => {
  it("exposes the empirical 0.5 threshold", () => {
    expect(PASS2_RETRY_THRESHOLD).toBe(0.5);
  });

  it("returns false when expected is 0 (no work to retry)", () => {
    expect(shouldRetryPass2(0, 0)).toBe(false);
    expect(shouldRetryPass2(5, 0)).toBe(false);
  });

  it("returns false when expected is negative (defensive)", () => {
    expect(shouldRetryPass2(0, -1)).toBe(false);
  });

  it("returns true when streamed count is below half the expected", () => {
    expect(shouldRetryPass2(0, 20)).toBe(true);
    expect(shouldRetryPass2(1, 20)).toBe(true);  // the observed collapse
    expect(shouldRetryPass2(9, 20)).toBe(true);
  });

  it("returns false when streamed count meets or exceeds half the expected", () => {
    expect(shouldRetryPass2(10, 20)).toBe(false); // ceil(20*0.5) = 10
    expect(shouldRetryPass2(11, 20)).toBe(false);
    expect(shouldRetryPass2(20, 20)).toBe(false);
  });

  it("handles expected=1 (streamed=0 retries, streamed=1 does not)", () => {
    expect(shouldRetryPass2(0, 1)).toBe(true);
    expect(shouldRetryPass2(1, 1)).toBe(false);
  });

  it("uses ceil, not floor, for odd expected counts", () => {
    // expected=3 → ceil(1.5) = 2 → streamed<2 retries
    expect(shouldRetryPass2(1, 3)).toBe(true);
    expect(shouldRetryPass2(2, 3)).toBe(false);
  });
});

describe("analyzedClauseSchema — applicable_law (SP-1.7)", () => {
  const clauseBase = {
    clause_text: "x",
    category: "other" as const,
    title: "t",
    plain_english: "p",
    risk_level: "low" as const,
    risk_explanation: "r",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    citations: [],
  };

  it("accepts applicable_law=null (the common case)", () => {
    const r = analyzedClauseSchema.safeParse({ ...clauseBase, applicable_law: null });
    expect(r.success).toBe(true);
  });

  it("accepts statute_cited with citations", () => {
    const r = analyzedClauseSchema.safeParse({
      ...clauseBase,
      applicable_law: {
        observation: "void under German law",
        source_type: "statute_cited",
        citations: [{ code: "DE_BGB_276" }],
      },
    });
    expect(r.success).toBe(true);
  });

  it("accepts general_principle with empty citations", () => {
    const r = analyzedClauseSchema.safeParse({
      ...clauseBase,
      applicable_law: {
        observation: "general EU principle",
        source_type: "general_principle",
        citations: [],
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects statute_cited with empty citations (invariant)", () => {
    const r = analyzedClauseSchema.safeParse({
      ...clauseBase,
      applicable_law: {
        observation: "void",
        source_type: "statute_cited",
        citations: [],
      },
    });
    expect(r.success).toBe(false);
  });

  it("rejects general_principle with non-empty citations (invariant)", () => {
    const r = analyzedClauseSchema.safeParse({
      ...clauseBase,
      applicable_law: {
        observation: "principle",
        source_type: "general_principle",
        citations: [{ code: "EU_GDPR" }],
      },
    });
    expect(r.success).toBe(false);
  });

  it("rejects off-enum citation codes", () => {
    const r = analyzedClauseSchema.safeParse({
      ...clauseBase,
      applicable_law: {
        observation: "fake",
        source_type: "statute_cited",
        citations: [{ code: "NOT_A_REAL_STATUTE" }],
      },
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty observation", () => {
    const r = analyzedClauseSchema.safeParse({
      ...clauseBase,
      applicable_law: {
        observation: "",
        source_type: "general_principle",
        citations: [],
      },
    });
    expect(r.success).toBe(false);
  });
});

describe("contractOverviewSchema — jurisdiction_evidence (SP-1.7)", () => {
  const base = {
    contract_type: "x",
    parties: [],
    effective_date: null,
    duration: null,
    total_value: null,
    governing_jurisdiction: null,
    key_terms: [],
    clause_inventory: [],
  };

  it("accepts source_type stated with source_text", () => {
    const r = contractOverviewSchema.safeParse({
      ...base,
      governing_jurisdiction: "Netherlands",
      jurisdiction_evidence: {
        source_type: "stated",
        source_text: "§14 Governing Law",
        country: "NL",
      },
    });
    expect(r.success).toBe(true);
  });

  it("accepts source_type unknown with null source_text", () => {
    const r = contractOverviewSchema.safeParse({
      ...base,
      jurisdiction_evidence: { source_type: "unknown", source_text: null, country: null },
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing jurisdiction_evidence", () => {
    const r = contractOverviewSchema.safeParse(base);
    expect(r.success).toBe(false);
  });
});

describe("OVERVIEW_SYSTEM_PROMPT includes jurisdiction_evidence instructions", () => {
  it("mentions jurisdiction_evidence and its three source_type values", () => {
    expect(OVERVIEW_SYSTEM_PROMPT).toContain("jurisdiction_evidence");
    expect(OVERVIEW_SYSTEM_PROMPT).toContain('source_type="stated"');
    expect(OVERVIEW_SYSTEM_PROMPT).toContain('source_type="inferred"');
    expect(OVERVIEW_SYSTEM_PROMPT).toContain('source_type="unknown"');
  });
});

describe("reconcileJurisdiction (SP-1.7)", () => {
  const base = {
    contract_type: "x",
    parties: [],
    effective_date: null,
    duration: null,
    total_value: null,
    key_terms: [],
    clause_inventory: [],
  };

  it("passes through consistent stated pair", () => {
    const out = reconcileJurisdiction({
      ...base,
      governing_jurisdiction: "Netherlands",
      jurisdiction_evidence: { source_type: "stated", source_text: "§14" },
    });
    expect(out.governing_jurisdiction).toBe("Netherlands");
    expect(out.jurisdiction_evidence.source_type).toBe("stated");
  });

  it("passes through consistent unknown pair", () => {
    const out = reconcileJurisdiction({
      ...base,
      governing_jurisdiction: null,
      jurisdiction_evidence: { source_type: "unknown", source_text: null },
    });
    expect(out.jurisdiction_evidence.source_type).toBe("unknown");
  });

  it("downgrades to unknown when governing_jurisdiction is null but source_type is stated", () => {
    const out = reconcileJurisdiction({
      ...base,
      governing_jurisdiction: null,
      jurisdiction_evidence: { source_type: "stated", source_text: "§14" },
    });
    expect(out.jurisdiction_evidence.source_type).toBe("unknown");
    expect(out.jurisdiction_evidence.source_text).toBeNull();
    expect(out.governing_jurisdiction).toBeNull();
  });

  it("nulls governing_jurisdiction when source_type is unknown but value was set", () => {
    const out = reconcileJurisdiction({
      ...base,
      governing_jurisdiction: "Germany",
      jurisdiction_evidence: { source_type: "unknown", source_text: null },
    });
    expect(out.jurisdiction_evidence.source_type).toBe("unknown");
    expect(out.governing_jurisdiction).toBeNull();
  });
});

describe("buildAnalysisSystemPrompt — SP-1.7 dispatch", () => {
  it("when jurisdiction is unknown, instructs applicable_law=null for every clause", () => {
    const prompt = buildAnalysisSystemPrompt(true, null, null, {
      source_type: "unknown",
      source_text: null,
    });
    expect(prompt).toContain("applicable_law: null");
    expect(prompt).toContain("EVERY clause");
    // The whitelist must NOT appear when we have no jurisdiction anchor.
    expect(prompt).not.toContain("DE_BGB_276");
  });

  it("when jurisdiction is stated, includes the whitelist and cites-from-list instruction", () => {
    const prompt = buildAnalysisSystemPrompt(true, null, "Germany", {
      source_type: "stated",
      source_text: "§20 Governing Law",
    });
    expect(prompt).toContain("DE_BGB_276");
    expect(prompt).toContain("EU_GDPR");
    expect(prompt).toContain("EU_DIR_93_13_EEC");
    expect(prompt).toContain("Do NOT invent codes");
    expect(prompt).toContain("applicable_law: null UNLESS");
  });

  it("no longer mentions jurisdiction_note anywhere", () => {
    const prompt = buildAnalysisSystemPrompt(true, null, "Netherlands", {
      source_type: "stated",
      source_text: "§14",
    });
    expect(prompt).not.toContain("jurisdiction_note");
  });
});

describe("PROMPT_TEMPLATE_VERSION", () => {
  it("is bumped to 1.1 for SP-1.7", () => {
    expect(PROMPT_TEMPLATE_VERSION).toBe("1.1");
  });
});

describe("contractOverviewSchema — country (SP-2)", () => {
  const baseOverview = {
    contract_type: "Freelance Services Agreement",
    parties: [{ name: "Provider", role_label: "Provider" }],
    effective_date: null,
    duration: null,
    total_value: null,
    governing_jurisdiction: "Netherlands",
    key_terms: ["k1"],
    clause_inventory: [{ title: "c1", section_ref: null }],
  };

  it("accepts EU-27 country codes on jurisdiction_evidence", () => {
    const r = contractOverviewSchema.safeParse({
      ...baseOverview,
      jurisdiction_evidence: {
        source_type: "stated",
        source_text: "Dutch law",
        country: "NL",
      },
    });
    expect(r.success).toBe(true);
  });

  it("accepts country=null when jurisdiction is non-EU", () => {
    const r = contractOverviewSchema.safeParse({
      ...baseOverview,
      governing_jurisdiction: "Switzerland",
      jurisdiction_evidence: {
        source_type: "stated",
        source_text: "Swiss law",
        country: null,
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects lowercase country code", () => {
    const r = contractOverviewSchema.safeParse({
      ...baseOverview,
      jurisdiction_evidence: {
        source_type: "stated",
        source_text: "Dutch law",
        country: "nl",
      },
    });
    expect(r.success).toBe(false);
  });

  it("rejects source_type=unknown with a non-null country", () => {
    const r = contractOverviewSchema.safeParse({
      ...baseOverview,
      governing_jurisdiction: null,
      jurisdiction_evidence: {
        source_type: "unknown",
        source_text: null,
        country: "NL",
      },
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-EU ISO codes", () => {
    const r = contractOverviewSchema.safeParse({
      ...baseOverview,
      jurisdiction_evidence: {
        source_type: "stated",
        source_text: "US law",
        country: "US",
      },
    });
    expect(r.success).toBe(false);
  });
});
