/**
 * Provider abstraction: env routing + dev-only override gate.
 */
import { describe, it, expect, afterEach } from "vitest";
import { getProvider, isOverrideAllowed } from "./provider";

describe("getProvider", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns mistral by default", () => {
    delete process.env.LLM_PROVIDER;
    const p = getProvider();
    expect(p.name).toBe("mistral");
    expect(p.region).toBe("eu-west-paris");
  });

  it("returns openai when env says so", () => {
    process.env.LLM_PROVIDER = "openai";
    const p = getProvider();
    expect(p.name).toBe("openai");
    expect(p.region).toBe("us-east");
  });

  it("respects override when supplied", () => {
    process.env.LLM_PROVIDER = "mistral";
    const p = getProvider("openai");
    expect(p.name).toBe("openai");
  });

  it("snapshot returns a non-empty string", () => {
    expect(getProvider("mistral").snapshot()).toMatch(/.+/);
    expect(getProvider("openai").snapshot()).toMatch(/.+/);
  });

  it("model() returns a model instance for each effort", () => {
    const p = getProvider("mistral");
    expect(p.model("low")).toBeDefined();
    expect(p.model("medium")).toBeDefined();
    expect(p.model("high")).toBeDefined();
  });
});

describe("isOverrideAllowed", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns true outside production", () => {
    process.env.NODE_ENV = "development";
    expect(isOverrideAllowed()).toBe(true);
    process.env.NODE_ENV = "test";
    expect(isOverrideAllowed()).toBe(true);
  });

  it("returns false in production", () => {
    process.env.NODE_ENV = "production";
    expect(isOverrideAllowed()).toBe(false);
  });
});
