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

  it("routes metadata passes to Mistral Small (structured-output compliance)", () => {
    const p = getProvider();
    for (const pass of ["overview", "extraction"] as const) {
      expect(p.modelIdFor(pass)).toBe("mistral-small-latest");
      expect(p.snapshotFor(pass)).toBe("mistral-small-2603");
    }
  });

  it("routes risk passes to Magistral Medium (native reasoning)", () => {
    const p = getProvider();
    for (const pass of ["risk", "think_hard"] as const) {
      expect(p.modelIdFor(pass)).toBe("magistral-medium-latest");
      expect(p.snapshotFor(pass)).toBe("magistral-medium-2509");
    }
  });

  it("never threads providerOptions — Magistral rejects reasoning_effort", () => {
    const p = getProvider();
    // Magistral models on Mistral La Plateforme run reasoning by default
    // and reject `reasoning_effort` as an unsupported parameter. We keep
    // the hook on the provider surface but always return undefined so
    // future call sites do not accidentally reintroduce the bad header.
    for (const pass of [
      "overview",
      "extraction",
      "chat",
      "risk",
      "think_hard",
    ] as const) {
      expect(p.reasoningOptionsFor(pass)).toBeUndefined();
    }
  });

  it("flags metadata passes as non-reasoning", () => {
    const p = getProvider();
    for (const pass of ["overview", "extraction", "chat"] as const) {
      expect(p.emitsReasoning(pass)).toBe(false);
    }
  });

  it("flags risk passes as reasoning-emitting", () => {
    const p = getProvider();
    expect(p.emitsReasoning("risk")).toBe(true);
    expect(p.emitsReasoning("think_hard")).toBe(true);
  });
});
