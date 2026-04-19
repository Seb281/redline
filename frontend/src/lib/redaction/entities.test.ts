/**
 * Unit tests for the SP-3.5 semantic entity resolver.
 *
 * Only the pure helpers are tested here — the integration with
 * `redact()` / `redactEntities()` lives in index.test.ts alongside the
 * round-trip invariants.
 */

import { describe, it, expect } from "vitest";
import { resolveEntities, mergeMatches } from "./entities";
import type { PatternMatch } from "./index";

describe("resolveEntities", () => {
  it("returns an empty array when no entities are provided", () => {
    expect(resolveEntities("hello world", [])).toEqual([]);
  });

  it("locates a single verbatim entity", () => {
    const text = "Ring me on 644805783 after hours.";
    const out = resolveEntities(text, [{ kind: "PHONE", text: "644805783" }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: "PHONE",
      start: text.indexOf("644805783"),
      end: text.indexOf("644805783") + "644805783".length,
      value: "644805783",
    });
  });

  it("emits one match per occurrence of the same string", () => {
    const text = "644805783 and then 644805783 again.";
    const out = resolveEntities(text, [{ kind: "PHONE", text: "644805783" }]);
    expect(out).toHaveLength(2);
    expect(out[0].start).toBeLessThan(out[1].start);
  });

  it("tolerates collapsed whitespace in the model's verbatim copy", () => {
    const text = "Lives at Hauptstraße 12\n10115 Berlin (residence).";
    const out = resolveEntities(text, [
      { kind: "ADDRESS", text: "Hauptstraße 12 10115 Berlin" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("ADDRESS");
  });

  it("skips entries that contain the ⟦⟧ token markers", () => {
    const out = resolveEntities("already redacted \u27E6EMAIL_1\u27E7 here", [
      { kind: "EMAIL", text: "\u27E6EMAIL_1\u27E7" },
    ]);
    expect(out).toEqual([]);
  });

  it("skips whitespace-only and empty entries", () => {
    const out = resolveEntities("contract body", [
      { kind: "PHONE", text: "   " },
      { kind: "PERSON", text: "" },
    ]);
    expect(out).toEqual([]);
  });

  it("escapes regex metacharacters in the entity text", () => {
    const text = "Reference: AB+CD(1)*2 = 42.";
    const out = resolveEntities(text, [
      { kind: "ID_NUMBER", text: "AB+CD(1)*2" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("AB+CD(1)*2");
  });
});

describe("mergeMatches", () => {
  const patternMatch = (start: number, end: number, kind = "EMAIL"): PatternMatch => ({
    kind,
    start,
    end,
    value: "X".repeat(end - start),
  });

  it("returns patterns untouched when entities are empty", () => {
    const p = [patternMatch(0, 5), patternMatch(10, 15)];
    expect(mergeMatches(p, [])).toEqual(p);
  });

  it("drops entity matches that overlap a pattern", () => {
    const patterns = [patternMatch(5, 15)];
    const entities = [patternMatch(10, 20, "ADDRESS")];
    const merged = mergeMatches(patterns, entities);
    expect(merged).toHaveLength(1);
    expect(merged[0].kind).toBe("EMAIL");
  });

  it("keeps non-overlapping entity matches", () => {
    const patterns = [patternMatch(0, 5)];
    const entities = [patternMatch(10, 20, "ADDRESS")];
    const merged = mergeMatches(patterns, entities);
    expect(merged).toHaveLength(2);
    expect(merged.map((m) => m.kind)).toEqual(["EMAIL", "ADDRESS"]);
  });

  it("resolves leftmost-longest within the entity layer itself", () => {
    const entities = [
      patternMatch(10, 20, "ADDRESS"),
      patternMatch(12, 18, "POSTCODE"),
    ];
    const merged = mergeMatches([], entities);
    expect(merged).toHaveLength(1);
    expect(merged[0].kind).toBe("ADDRESS");
  });

  it("returns output sorted by start offset", () => {
    const patterns = [patternMatch(20, 25)];
    const entities = [patternMatch(0, 5, "ADDRESS"), patternMatch(40, 50, "DOB")];
    const merged = mergeMatches(patterns, entities);
    expect(merged.map((m) => m.start)).toEqual([0, 20, 40]);
  });
});
