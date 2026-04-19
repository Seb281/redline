/**
 * Snapshot harness — runs the full analysis pipeline against the three EU
 * sample contracts and asserts structural shape (clause count band,
 * required categories, risk distribution, jurisdiction).
 *
 * Hits the real Mistral API. Skipped if MISTRAL_API_KEY is unset (so CI
 * without secrets and local devs without a key still pass).
 *
 * Run with a key:
 *   cd frontend \
 *     && MISTRAL_API_KEY=$(grep MISTRAL_API_KEY .env.local | cut -d= -f2) \
 *        pnpm test src/lib/analyzer.snapshot.test.ts
 *
 * Purpose: catch provider-side regressions (Zod schema drift on structured
 * output, prompt-template breakage, region/endpoint changes) before they
 * ship to users. Structural invariants only — we never assert exact LLM
 * strings because Mistral output is non-deterministic across runs.
 */

import { describe, it, expect } from "vitest";
import { analyzeContract } from "./analyzer";
import { getProvider } from "./llm/provider";
import { SAMPLE_CONTRACT_TEXT as NL_TEXT } from "@/data/sample-contracts/nl-freelance";
import { FR_EMPLOYMENT_TEXT } from "@/data/sample-contracts/fr-employment";
import { DE_SAAS_DPA_TEXT } from "@/data/sample-contracts/de-saas-dpa";
import { ES_SAAS_SERVICES_TEXT } from "@/data/sample-contracts/es-saas-services";
import { IT_EMPLOYMENT_TEXT } from "@/data/sample-contracts/it-employment";
import { PL_DISTRIBUTION_TEXT } from "@/data/sample-contracts/pl-distribution";

const HAS_KEY = Boolean(process.env.MISTRAL_API_KEY);
const describeIfKey = HAS_KEY ? describe : describe.skip;

// Long timeout — each test is a full three-pass pipeline run against a
// real LLM. 180s gives headroom for transient provider slowness.
const TIMEOUT_MS = 180_000;

describeIfKey("snapshot harness — Mistral provider", () => {
  const provider = getProvider("mistral");

  it(
    "NL freelance: surfaces non-compete + liability + IP, detects Netherlands",
    async () => {
      const result = await analyzeContract(
        NL_TEXT,
        "fast",
        true,
        "Contractor",
        provider,
      );

      // Overview structural invariants
      expect(result.overview.contract_type).toBeTruthy();
      expect(result.overview.parties.length).toBeGreaterThanOrEqual(2);
      expect(result.overview.key_terms.length).toBeGreaterThanOrEqual(1);
      expect(result.overview.governing_jurisdiction?.toLowerCase()).toMatch(
        /netherlands|dutch|nl/,
      );

      // SP-2 — Pass 0 must emit country code for EU-27 fixtures.
      expect(result.overview.jurisdiction_evidence?.country).toBe("NL");

      // Clause count band — inventory-guided extraction should surface
      // roughly 8-20 clauses on this contract.
      expect(result.clauses.length).toBeGreaterThanOrEqual(8);
      expect(result.clauses.length).toBeLessThanOrEqual(20);

      // SP-1.7 — a stated-jurisdiction fixture must produce at least one
      // canonical citation. Catches prompt-regression where the model
      // stops emitting applicable_law entirely.
      const hasStatute = result.clauses.some(
        (c) => c.applicable_law?.source_type === "statute_cited",
      );
      expect(hasStatute).toBe(true);

      // SP-2 leak test — no citation from a foreign country may appear
      // (allow NL + EU only).
      const codes = result.clauses.flatMap(
        (c) => c.applicable_law?.citations?.map((cit) => cit.code) ?? [],
      );
      for (const code of codes) {
        expect(["NL", "EU"]).toContain(code.split("_")[0]);
      }

      const cats = result.clauses.map((c) => c.category);
      expect(cats).toContain("non_compete");
      expect(cats).toContain("ip_assignment");
      // Accept either normalized category for liability-style clauses.
      expect(
        cats.includes("limitation_of_liability") || cats.includes("liability"),
      ).toBe(true);

      expect(result.summary.risk_breakdown.high).toBeGreaterThan(0);
      expect(
        result.summary.risk_breakdown.low +
          result.summary.risk_breakdown.informational,
      ).toBeGreaterThan(0);

      // Provenance must round-trip a real Mistral snapshot.
      expect(result.provenance.provider).toBe("mistral");
      expect(result.provenance.snapshot).toMatch(/.+/);
    },
    TIMEOUT_MS,
  );

  it(
    "FR employment: surfaces non-compete (high risk), detects France",
    async () => {
      const result = await analyzeContract(
        FR_EMPLOYMENT_TEXT,
        "fast",
        true,
        "Salarié",
        provider,
      );

      expect(result.overview.contract_type).toBeTruthy();
      expect(result.overview.parties.length).toBeGreaterThanOrEqual(2);
      expect(result.overview.key_terms.length).toBeGreaterThanOrEqual(1);
      expect(result.overview.governing_jurisdiction?.toLowerCase()).toMatch(
        /france|french|fr/,
      );

      // SP-2 — Pass 0 must emit country code for EU-27 fixtures.
      expect(result.overview.jurisdiction_evidence?.country).toBe("FR");

      expect(result.clauses.length).toBeGreaterThanOrEqual(8);

      const nonCompete = result.clauses.find(
        (c) => c.category === "non_compete",
      );
      expect(nonCompete).toBeDefined();
      // French non-compete missing contrepartie financière = high risk.
      expect(nonCompete?.risk_level).toBe("high");

      // SP-1.7 — FR non-compete without contrepartie must trigger the
      // FR_CODE_TRAVAIL_NONCOMPETE citation.
      const hasStatute = result.clauses.some(
        (c) => c.applicable_law?.source_type === "statute_cited",
      );
      expect(hasStatute).toBe(true);

      // SP-2 leak test — no foreign-country citation permitted (FR + EU only).
      const codes = result.clauses.flatMap(
        (c) => c.applicable_law?.citations?.map((cit) => cit.code) ?? [],
      );
      for (const code of codes) {
        expect(["FR", "EU"]).toContain(code.split("_")[0]);
      }

      expect(result.provenance.provider).toBe("mistral");
    },
    TIMEOUT_MS,
  );

  it(
    "DE SaaS+DPA: surfaces data_protection + limitation_of_liability, detects Germany",
    async () => {
      const result = await analyzeContract(
        DE_SAAS_DPA_TEXT,
        "fast",
        true,
        "Kunde",
        provider,
      );

      expect(result.overview.contract_type).toBeTruthy();
      expect(result.overview.parties.length).toBeGreaterThanOrEqual(2);
      expect(result.overview.key_terms.length).toBeGreaterThanOrEqual(1);
      expect(result.overview.governing_jurisdiction?.toLowerCase()).toMatch(
        /germany|german|de|deutschland/,
      );

      // SP-2 — Pass 0 must emit country code for EU-27 fixtures.
      expect(result.overview.jurisdiction_evidence?.country).toBe("DE");

      const cats = result.clauses.map((c) => c.category);
      expect(cats).toContain("data_protection");
      expect(
        cats.includes("limitation_of_liability") || cats.includes("liability"),
      ).toBe(true);

      expect(result.summary.risk_breakdown.high).toBeGreaterThan(0);
      expect(result.provenance.provider).toBe("mistral");

      // SP-1.7 — DE DPA must ground data-protection clauses on GDPR.
      const hasStatute = result.clauses.some(
        (c) => c.applicable_law?.source_type === "statute_cited",
      );
      expect(hasStatute).toBe(true);

      // SP-2 leak test — no foreign-country citation permitted (DE + EU only).
      const codes = result.clauses.flatMap(
        (c) => c.applicable_law?.citations?.map((cit) => cit.code) ?? [],
      );
      for (const code of codes) {
        expect(["DE", "EU"]).toContain(code.split("_")[0]);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "ES SaaS/services: detects Spain, cites ES statute, no foreign leaks",
    async () => {
      const result = await analyzeContract(
        ES_SAAS_SERVICES_TEXT,
        "fast",
        true,
        "Cliente",
        provider,
      );

      expect(result.overview.contract_type).toBeTruthy();
      expect(result.overview.parties.length).toBeGreaterThanOrEqual(2);
      expect(result.overview.governing_jurisdiction?.toLowerCase()).toMatch(
        /spain|spanish|es|españa|espana/,
      );
      expect(result.overview.jurisdiction_evidence?.country).toBe("ES");

      expect(result.clauses.length).toBeGreaterThanOrEqual(8);

      const codes = result.clauses.flatMap(
        (c) => c.applicable_law?.citations?.map((cit) => cit.code) ?? [],
      );
      const esCodes = codes.filter((code) => code.startsWith("ES_"));
      expect(esCodes.length).toBeGreaterThan(0);

      for (const code of codes) {
        expect(["ES", "EU"]).toContain(code.split("_")[0]);
      }

      expect(result.provenance.provider).toBe("mistral");
    },
    TIMEOUT_MS,
  );

  it(
    "IT employment: detects Italy, cites IT statute, no foreign leaks",
    async () => {
      const result = await analyzeContract(
        IT_EMPLOYMENT_TEXT,
        "fast",
        true,
        "Lavoratrice",
        provider,
      );

      expect(result.overview.contract_type).toBeTruthy();
      expect(result.overview.parties.length).toBeGreaterThanOrEqual(2);
      expect(result.overview.governing_jurisdiction?.toLowerCase()).toMatch(
        /italy|italian|it|italia/,
      );
      expect(result.overview.jurisdiction_evidence?.country).toBe("IT");

      expect(result.clauses.length).toBeGreaterThanOrEqual(8);

      const codes = result.clauses.flatMap(
        (c) => c.applicable_law?.citations?.map((cit) => cit.code) ?? [],
      );
      const itCodes = codes.filter((code) => code.startsWith("IT_"));
      expect(itCodes.length).toBeGreaterThan(0);

      for (const code of codes) {
        expect(["IT", "EU"]).toContain(code.split("_")[0]);
      }

      expect(result.provenance.provider).toBe("mistral");
    },
    TIMEOUT_MS,
  );

  it(
    "PL distribution: detects Poland, cites PL statute, no foreign leaks",
    async () => {
      const result = await analyzeContract(
        PL_DISTRIBUTION_TEXT,
        "fast",
        true,
        "Dystrybutor",
        provider,
      );

      expect(result.overview.contract_type).toBeTruthy();
      expect(result.overview.parties.length).toBeGreaterThanOrEqual(2);
      expect(result.overview.governing_jurisdiction?.toLowerCase()).toMatch(
        /poland|polish|pl|polska/,
      );
      expect(result.overview.jurisdiction_evidence?.country).toBe("PL");

      expect(result.clauses.length).toBeGreaterThanOrEqual(8);

      const codes = result.clauses.flatMap(
        (c) => c.applicable_law?.citations?.map((cit) => cit.code) ?? [],
      );
      const plCodes = codes.filter((code) => code.startsWith("PL_"));
      expect(plCodes.length).toBeGreaterThan(0);

      for (const code of codes) {
        expect(["PL", "EU"]).toContain(code.split("_")[0]);
      }

      expect(result.provenance.provider).toBe("mistral");
    },
    TIMEOUT_MS,
  );
});
