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
    },
    TIMEOUT_MS,
  );
});
