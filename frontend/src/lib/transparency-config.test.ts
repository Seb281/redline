/**
 * SP-9 — structural invariants for the AI Act transparency config.
 *
 * The config drives both the `/transparency` page and the
 * transparency receipt; either surface drifting from the other would
 * produce an audit artifact that disagrees with itself. These tests
 * guard the low-cost invariants (no duplicate keys, no empty labels,
 * pipeline starts at Pass 0 and ends at chat) so a careless edit
 * breaks the suite before it breaks a receipt in production.
 */

import { describe, it, expect } from "vitest";
import {
  AI_ACT_ARTICLES,
  LIMITATIONS,
  OPERATOR_LEVERS,
  PIPELINE_STEPS,
} from "./transparency-config";

describe("transparency-config", () => {
  it("exposes Art 13 and Art 50 — the two AI Act articles Redline covers", () => {
    const refs = AI_ACT_ARTICLES.map((a) => a.reference);
    expect(refs).toContain("Art. 13");
    expect(refs).toContain("Art. 50");
  });

  it("pipeline ordering matches the documented five-stage flow", () => {
    const keys = PIPELINE_STEPS.map((s) => s.translationKey);
    expect(keys).toEqual(["pass0", "redaction", "pass1", "pass2", "chat"]);
  });

  it("redaction step is the only non-LLM stage", () => {
    const nonLlm = PIPELINE_STEPS.filter((s) => !s.isLlmCall);
    expect(nonLlm.map((s) => s.translationKey)).toEqual(["redaction"]);
  });

  it("every operator lever names a real env var in SCREAMING_SNAKE_CASE", () => {
    for (const lever of OPERATOR_LEVERS) {
      expect(lever.envVar).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(lever.translationKey.length).toBeGreaterThan(0);
    }
  });

  it("all lists use unique translation keys", () => {
    const collect = (xs: ReadonlyArray<{ translationKey: string }>) =>
      xs.map((x) => x.translationKey);
    for (const group of [
      collect(AI_ACT_ARTICLES),
      collect(PIPELINE_STEPS),
      collect(OPERATOR_LEVERS),
      collect(LIMITATIONS),
    ]) {
      expect(new Set(group).size).toBe(group.length);
    }
  });
});
