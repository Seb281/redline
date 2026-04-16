import { describe, it, expect } from "vitest";
import {
  buildRiskBreakdown,
  capInventory,
  formatInventoryPrompt,
  buildExtractionPrompt,
  buildAnalysisSystemPrompt,
  buildProvenance,
  INVENTORY_CAP_CEILING,
  INVENTORY_CAP_BYTES_PER_ITEM,
  INVENTORY_CAP_FLOOR,
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

  it("includes jurisdiction rules when jurisdiction provided", () => {
    const prompt = buildAnalysisSystemPrompt(true, null, "the Netherlands");
    expect(prompt).toContain("the Netherlands");
    expect(prompt).toContain("Karenzentschädigung");
    expect(prompt).toContain("jurisdiction_note");
  });

  it("instructs null jurisdiction_note when no jurisdiction", () => {
    const prompt = buildAnalysisSystemPrompt(true, null, null);
    expect(prompt).toContain("jurisdiction_note");
    expect(prompt).toContain("null for all clauses");
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
