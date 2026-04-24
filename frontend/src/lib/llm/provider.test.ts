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

  it("demotes Fast-mode risk to Mistral Small for latency", () => {
    const p = getProvider();
    // Fast mode deliberately forgoes the Magistral reasoning trace on
    // the risk pass so the user-facing analysis returns faster. Deep
    // mode still routes to Magistral so the per-clause trace survives.
    expect(p.modelIdFor("risk", "fast")).toBe("mistral-small-latest");
    expect(p.snapshotFor("risk", "fast")).toBe("mistral-small-2603");
    expect(p.modelIdFor("risk", "deep")).toBe("magistral-medium-latest");
    expect(p.snapshotFor("risk", "deep")).toBe("magistral-medium-2509");
  });

  it("keeps think_hard on Magistral regardless of analysis mode", () => {
    const p = getProvider();
    // think_hard is an explicit escalation path and must not be tied
    // to the surrounding Fast/Deep choice the user made at upload.
    expect(p.modelIdFor("think_hard", "fast")).toBe("magistral-medium-latest");
    expect(p.modelIdFor("think_hard", "deep")).toBe("magistral-medium-latest");
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

  it("flips risk to non-reasoning under Fast mode (demoted to Mistral Small)", () => {
    const p = getProvider();
    // Downstream call sites use this to decide whether to speculatively
    // attach `reasoning` to the streamed clause. Fast mode must report
    // `false` or the UI will claim a trace was captured when the call
    // actually ran on a non-reasoning model.
    expect(p.emitsReasoning("risk", "fast")).toBe(false);
    expect(p.emitsReasoning("risk", "deep")).toBe(true);
    // think_hard is mode-insensitive.
    expect(p.emitsReasoning("think_hard", "fast")).toBe(true);
    expect(p.emitsReasoning("think_hard", "deep")).toBe(true);
  });
});
