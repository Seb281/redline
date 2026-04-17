import { describe, it, expect } from "vitest";
import { normalizeLabel, heuristicLabels, disambiguateLabels } from "./role-heuristics";

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

describe("heuristicLabels", () => {
  const cases: Array<[string, string, string]> = [
    ["Employment Agreement", "EMPLOYER", "EMPLOYEE"],
    ["Residential Lease", "LANDLORD", "TENANT"],
    ["Tenancy Agreement", "LANDLORD", "TENANT"],
    ["Asset Purchase Agreement", "SELLER", "BUYER"],
    ["Software License Agreement", "LICENSOR", "LICENSEE"],
    ["Loan Agreement", "LENDER", "BORROWER"],
    ["Mutual Non-Disclosure Agreement", "DISCLOSING_PARTY", "RECEIVING_PARTY"],
    ["Master Services Agreement", "PROVIDER", "CLIENT"],
    ["Consulting Agreement", "PROVIDER", "CLIENT"],
    ["Freelance Services Agreement", "PROVIDER", "CLIENT"],
    ["Partnership Agreement", "PARTY_A", "PARTY_B"],
  ];
  for (const [ctype, first, second] of cases) {
    it(`maps "${ctype}" → ${first}/${second}`, () => {
      const labels = heuristicLabels(ctype, 2);
      expect(labels[0]).toBe(first);
      expect(labels[1]).toBe(second);
    });
  }
  it("returns PARTY_C, PARTY_D for parties beyond first two", () => {
    const labels = heuristicLabels("Master Services Agreement", 4);
    expect(labels).toEqual(["PROVIDER", "CLIENT", "PARTY_C", "PARTY_D"]);
  });
  it("returns PARTY_A only when one party", () => {
    expect(heuristicLabels("Something", 1)).toEqual(["PARTY_A"]);
  });
});

describe("disambiguateLabels", () => {
  it("passes unique labels through unchanged", () => {
    expect(disambiguateLabels(["PROVIDER", "CLIENT"])).toEqual([
      "PROVIDER",
      "CLIENT",
    ]);
  });
  it("suffixes duplicate with _2", () => {
    expect(disambiguateLabels(["PROVIDER", "PROVIDER"])).toEqual([
      "PROVIDER",
      "PROVIDER_2",
    ]);
  });
  it("suffixes triplicates _2, _3", () => {
    expect(disambiguateLabels(["PROV", "PROV", "PROV"])).toEqual([
      "PROV",
      "PROV_2",
      "PROV_3",
    ]);
  });
  it("keeps first-seen base label even with later collisions", () => {
    expect(disambiguateLabels(["A", "B", "A", "B"])).toEqual([
      "A",
      "B",
      "A_2",
      "B_2",
    ]);
  });
  it("does not alter empty entries (caller's responsibility)", () => {
    expect(disambiguateLabels(["", "PROVIDER"])).toEqual(["", "PROVIDER"]);
  });
});
