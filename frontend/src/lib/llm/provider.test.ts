/**
 * Provider abstraction — single-provider Mistral surface with
 * pass-aware routing (SP-11 Phase 1).
 */
import { describe, it, expect } from "vitest";
import { getProvider } from "./provider";
import type { AnalysisPass, PipelinePass } from "./provider";

const ANALYSIS_PASSES: AnalysisPass[] = [
  "overview",
  "extraction",
  "risk",
  "think_hard",
];
const ALL_PASSES: PipelinePass[] = [...ANALYSIS_PASSES, "chat"];

describe("getProvider", () => {
  it("returns the Mistral provider with EU region metadata", () => {
    const p = getProvider();
    expect(p.name).toBe("mistral");
    expect(p.region).toBe("eu-west-paris");
  });

  it("returns a non-empty snapshot string for every analysis pass", () => {
    const p = getProvider();
    for (const pass of ANALYSIS_PASSES) {
      expect(p.snapshotFor(pass)).toMatch(/.+/);
    }
  });

  it("returns a non-empty model ID for every analysis pass", () => {
    const p = getProvider();
    for (const pass of ANALYSIS_PASSES) {
      expect(p.modelIdFor(pass)).toMatch(/.+/);
    }
  });

  it("returns a model instance for each pass × effort combination", () => {
    const p = getProvider();
    for (const pass of ALL_PASSES) {
      expect(p.model({ effort: "low", pass })).toBeDefined();
      expect(p.model({ effort: "medium", pass })).toBeDefined();
      expect(p.model({ effort: "high", pass })).toBeDefined();
    }
  });

  it("routes every pass onto Mistral Small in Phase 1 (no behavior change)", () => {
    const p = getProvider();
    for (const pass of ANALYSIS_PASSES) {
      expect(p.modelIdFor(pass)).toBe("mistral-small-latest");
      expect(p.snapshotFor(pass)).toBe("mistral-small-2603");
    }
  });
});
