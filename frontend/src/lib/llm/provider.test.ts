/**
 * Provider abstraction — single-provider Mistral surface.
 */
import { describe, it, expect } from "vitest";
import { getProvider } from "./provider";

describe("getProvider", () => {
  it("returns the Mistral provider with EU region metadata", () => {
    const p = getProvider();
    expect(p.name).toBe("mistral");
    expect(p.region).toBe("eu-west-paris");
  });

  it("returns a non-empty snapshot string for AI Act provenance", () => {
    expect(getProvider().snapshot()).toMatch(/.+/);
  });

  it("returns a model instance for each reasoning effort level", () => {
    const p = getProvider();
    expect(p.model("low")).toBeDefined();
    expect(p.model("medium")).toBeDefined();
    expect(p.model("high")).toBeDefined();
  });
});
