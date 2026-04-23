/**
 * SP-10 Arc 2 Task 2.1 — tests for query-hint extraction.
 *
 * These tests pin the contract `metadata-boost.ts` depends on:
 * natural-language → {category terms, statute codes}, fully
 * deterministic, no LLM call. Aliases live next to the catalog in
 * `applicable-law.ts`; synonyms live next to the category enum.
 */

import { describe, it, expect } from "vitest";
import { extractQueryHints } from "./query-analysis";

describe("extractQueryHints — category detection", () => {
  it("maps non-compete phrasings to non_compete", () => {
    expect(extractQueryHints("is the non-compete enforceable?").categories).toContain("non_compete");
    expect(extractQueryHints("what restrictive covenant applies").categories).toContain("non_compete");
    expect(extractQueryHints("noncompete duration").categories).toContain("non_compete");
  });

  it("maps termination-family verbs to termination", () => {
    expect(extractQueryHints("can I terminate early?").categories).toContain("termination");
    expect(extractQueryHints("cancellation rights").categories).toContain("termination");
    expect(extractQueryHints("how does termination work").categories).toContain("termination");
  });

  it("maps confidentiality / NDA / non-disclosure to confidentiality", () => {
    expect(extractQueryHints("NDA scope").categories).toContain("confidentiality");
    expect(extractQueryHints("confidential information definition").categories).toContain("confidentiality");
    expect(extractQueryHints("non-disclosure obligations").categories).toContain("confidentiality");
  });

  it("maps data-protection synonyms to data_protection", () => {
    expect(extractQueryHints("GDPR compliance").categories).toContain("data_protection");
    expect(extractQueryHints("personal data handling").categories).toContain("data_protection");
    expect(extractQueryHints("what's the privacy clause").categories).toContain("data_protection");
  });

  it("maps liability-cap phrasings to limitation_of_liability (not just liability)", () => {
    const hits = extractQueryHints("liability cap?").categories;
    expect(hits).toContain("limitation_of_liability");
  });

  it("maps force majeure, dispute resolution, governing law correctly", () => {
    expect(extractQueryHints("force majeure scope").categories).toContain("force_majeure");
    expect(extractQueryHints("arbitration forum").categories).toContain("dispute_resolution");
    expect(extractQueryHints("governing law clause").categories).toContain("governing_law");
  });

  it("returns an empty category set for off-topic queries", () => {
    expect(extractQueryHints("hello world").categories.size).toBe(0);
  });
});

describe("extractQueryHints — statute detection", () => {
  it("maps GDPR to EU_GDPR", () => {
    expect(extractQueryHints("GDPR article 6 lawful basis").statuteCodes).toContain("EU_GDPR");
  });

  it("maps BGB to the BGB family codes", () => {
    const codes = extractQueryHints("BGB §307 standard-terms control").statuteCodes;
    expect(codes).toContain("DE_BGB_307");
    expect(codes).toContain("DE_BGB_276");
  });

  it("maps BW to the Dutch Civil Code family", () => {
    const codes = extractQueryHints("BW 7:653 non-compete").statuteCodes;
    expect(codes).toContain("NL_BW_7_653");
    expect(codes).toContain("NL_BW_7_650");
  });

  it("maps Code civil / Codice Civile to FR / IT families respectively", () => {
    const fr = extractQueryHints("article 1171 Code civil").statuteCodes;
    expect(fr).toContain("FR_CC_1171");
    const it = extractQueryHints("Codice Civile 1341").statuteCodes;
    expect(it).toContain("IT_CC_1341");
  });

  it("maps Kodeks cywilny / Kodeks pracy separately", () => {
    const kc = extractQueryHints("Kodeks cywilny 484 penalty").statuteCodes;
    expect(kc).toContain("PL_KC_484");
    expect(kc).not.toContain("PL_KP_101_2");
    const kp = extractQueryHints("Kodeks pracy non-compete").statuteCodes;
    expect(kp).toContain("PL_KP_101_2");
    expect(kp).not.toContain("PL_KC_471");
  });

  it("maps EU directive nicknames to their codes", () => {
    expect(extractQueryHints("Rome I choice of law").statuteCodes).toContain("EU_REG_593_2008");
    expect(extractQueryHints("Unfair Terms Directive").statuteCodes).toContain("EU_DIR_93_13_EEC");
    expect(extractQueryHints("Commercial Agents Directive 86/653").statuteCodes).toContain("EU_DIR_86_653_EEC");
  });

  it("returns empty for queries with no statute signal", () => {
    expect(extractQueryHints("what does the agreement say about pay").statuteCodes.size).toBe(0);
  });
});

describe("extractQueryHints — orthogonality", () => {
  it("a GDPR query triggers both statute (EU_GDPR) and category (data_protection)", () => {
    const hints = extractQueryHints("GDPR data subject rights");
    expect(hints.statuteCodes).toContain("EU_GDPR");
    expect(hints.categories).toContain("data_protection");
  });

  it("is case-insensitive for both category synonyms and statute aliases", () => {
    expect(extractQueryHints("GDPR").statuteCodes).toContain("EU_GDPR");
    expect(extractQueryHints("gdpr").statuteCodes).toContain("EU_GDPR");
    expect(extractQueryHints("CONFIDENTIAL").categories).toContain("confidentiality");
  });
});
