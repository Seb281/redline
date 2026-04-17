import { describe, it, expect } from "vitest";
import { normalizeLabel } from "./role-heuristics";

describe("normalizeLabel", () => {
  it("uppercases ASCII", () => {
    expect(normalizeLabel("Provider")).toBe("PROVIDER");
  });
  it("replaces spaces with underscore", () => {
    expect(normalizeLabel("Service Provider")).toBe("SERVICE_PROVIDER");
  });
  it("strips diacritics", () => {
    expect(normalizeLabel("Société Générale")).toBe("SOCIETE_GENERALE");
  });
  it("replaces punctuation with underscore and collapses repeats", () => {
    expect(normalizeLabel("A & B—Co.")).toBe("A_B_CO");
  });
  it("trims leading/trailing underscores", () => {
    expect(normalizeLabel("  Provider  ")).toBe("PROVIDER");
    expect(normalizeLabel("--foo--")).toBe("FOO");
  });
  it("truncates to 20 chars", () => {
    expect(normalizeLabel("SupplierOfQualityIndustrialEquipment")).toHaveLength(20);
    expect(normalizeLabel("SupplierOfQualityIndustrialEquipment")).toBe(
      "SUPPLIEROFQUALITYIND",
    );
  });
  it("returns empty string for all-punctuation input", () => {
    expect(normalizeLabel("---")).toBe("");
    expect(normalizeLabel("")).toBe("");
  });
});
