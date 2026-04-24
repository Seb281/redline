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
import { FR_COMMERCIAL_LEASE_TEXT } from "@/data/sample-contracts/fr-commercial-lease";
import { DE_EMPLOYMENT_TEXT } from "@/data/sample-contracts/de-employment";
import { ES_SAAS_SERVICES_TEXT } from "@/data/sample-contracts/es-saas-services";
import { IT_EMPLOYMENT_TEXT } from "@/data/sample-contracts/it-employment";
import { PL_DISTRIBUTION_TEXT } from "@/data/sample-contracts/pl-distribution";

const HAS_KEY = Boolean(process.env.MISTRAL_API_KEY);
const describeIfKey = HAS_KEY ? describe : describe.skip;

// SP-7 Layer B' Phase 2 — locale-specific runs are opt-in. Each locale
// is a full pipeline run, so the default CI/PR gate only exercises the
// EN path (the `describeIfKey` block above). Set `SNAPSHOT_LOCALE_TEST=1`
// alongside `MISTRAL_API_KEY` to run the per-locale harness — used
// manually before flipping a locale live in production.
const RUN_LOCALE_SNAPSHOTS =
  HAS_KEY && process.env.SNAPSHOT_LOCALE_TEST === "1";
const describeIfLocaleRun = RUN_LOCALE_SNAPSHOTS ? describe : describe.skip;

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
    "FR commercial lease: surfaces termination + payment_terms (high risk), detects France",
    async () => {
      const result = await analyzeContract(
        FR_COMMERCIAL_LEASE_TEXT,
        "fast",
        true,
        "Preneur",
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

      // A commercial lease leans on termination (clause résolutoire,
      // exclusion of indemnité d'éviction) and payment_terms (loyer +
      // clause pénale at 15%) rather than the employment-only
      // non-compete signal carried by the previous fixture.
      const cats = result.clauses.map((c) => c.category);
      expect(cats).toContain("termination");

      // High-risk expectation: at least one of the lease's lopsided
      // clauses — termination without indemnité d'éviction, 15%
      // clause pénale, or the restitution-sans-indemnité provision —
      // must surface as high risk to the Preneur.
      expect(result.summary.risk_breakdown.high).toBeGreaterThan(0);

      // SP-1.7 — commercial lease should ground at least one clause
      // on a FR or EU statute (FR_CC_1171, FR_CC_1231_5,
      // FR_CCOM_L442_1, or EU_GDPR on §14 Données personnelles).
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
    "DE employment: surfaces non_compete (high risk) + ip_assignment, detects Germany",
    async () => {
      const result = await analyzeContract(
        DE_EMPLOYMENT_TEXT,
        "fast",
        true,
        "Arbeitnehmer",
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
      // German employment fixture leans on post-contractual non-compete
      // with a Karenzentschädigung below the statutory half-salary
      // minimum, plus a sweeping IP-assignment clause that reaches
      // free-time inventions.
      expect(cats).toContain("non_compete");

      const nonCompete = result.clauses.find(
        (c) => c.category === "non_compete",
      );
      expect(nonCompete).toBeDefined();
      // Under-statutory Karenzentschädigung (25% vs HGB §74's half-
      // salary minimum) must surface as high risk to the Arbeitnehmer.
      expect(nonCompete?.risk_level).toBe("high");

      expect(result.summary.risk_breakdown.high).toBeGreaterThan(0);
      expect(result.provenance.provider).toBe("mistral");

      // SP-1.7 — at least one clause must ground on a DE or EU
      // statute. Expected hits: DE_KARENZENTSCHAEDIGUNG (§11),
      // DE_ARBNERFG (§12), DE_BGB_307 (§6/§13), or EU_GDPR (§15).
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

/**
 * SP-7 Layer B' — locale-specific structural harness.
 *
 * Default-skipped. Opt-in with `SNAPSHOT_LOCALE_TEST=1` alongside a
 * Mistral key. Purpose: verify the pipeline keeps its enum invariants
 * (risk_level, category, source_type, statute codes) when the system
 * prompt is issued in a non-EN locale. Prose fluency is a qualitative
 * quality gate the human reviewer still owns — these tests only guard
 * against *structural* regressions from locale injection.
 *
 * Coverage: ES + DE (Phase 2) + FR + IT + NL (Phase 4). The six-locale
 * routing set is now fully covered on the machine-check side; live
 * qualitative review per locale is still the maintainer's job.
 */
const VALID_RISK_LEVELS = new Set([
  "informational",
  "low",
  "medium",
  "high",
]);
const VALID_CATEGORIES = new Set([
  "non_compete",
  "liability",
  "termination",
  "ip_assignment",
  "confidentiality",
  "governing_law",
  "indemnification",
  "data_protection",
  "payment_terms",
  "limitation_of_liability",
  "force_majeure",
  "dispute_resolution",
  "other",
]);
const VALID_SOURCE_TYPES = new Set(["statute_cited", "general_principle"]);

describeIfLocaleRun("snapshot harness — locale-injected prompts", () => {
  const provider = getProvider("mistral");

  it(
    "ES locale: enum fields stay English, citations stay ES/EU, analysis_locale='es'",
    async () => {
      const result = await analyzeContract(
        ES_SAAS_SERVICES_TEXT,
        "fast",
        true,
        "Cliente",
        provider,
        "es",
      );

      // Provenance locale round-trip
      expect(result.provenance.analysis_locale).toBe("es");
      expect(result.provenance.provider).toBe("mistral");

      // Jurisdiction + clause count band unchanged by locale injection
      expect(result.overview.jurisdiction_evidence?.country).toBe("ES");
      expect(result.clauses.length).toBeGreaterThanOrEqual(8);

      // Enum invariants — every clause must keep machine-code values
      // in English regardless of the prose locale. A translated
      // risk_level or category would hard-fail Zod upstream, but we
      // re-check here as a defense-in-depth gate against future
      // schema relaxation.
      for (const c of result.clauses) {
        expect(VALID_CATEGORIES.has(c.category)).toBe(true);
        expect(VALID_RISK_LEVELS.has(c.risk_level)).toBe(true);
        if (c.applicable_law) {
          expect(VALID_SOURCE_TYPES.has(c.applicable_law.source_type)).toBe(
            true,
          );
        }
      }

      // Citation allowlist + no-leak — same guard as the EN harness.
      const codes = result.clauses.flatMap(
        (c) => c.applicable_law?.citations?.map((cit) => cit.code) ?? [],
      );
      for (const code of codes) {
        expect(["ES", "EU"]).toContain(code.split("_")[0]);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "DE locale: enum fields stay English, citations stay DE/EU, analysis_locale='de'",
    async () => {
      const result = await analyzeContract(
        DE_EMPLOYMENT_TEXT,
        "fast",
        true,
        "Arbeitnehmer",
        provider,
        "de",
      );

      expect(result.provenance.analysis_locale).toBe("de");
      expect(result.provenance.provider).toBe("mistral");

      expect(result.overview.jurisdiction_evidence?.country).toBe("DE");
      expect(result.clauses.length).toBeGreaterThanOrEqual(8);

      for (const c of result.clauses) {
        expect(VALID_CATEGORIES.has(c.category)).toBe(true);
        expect(VALID_RISK_LEVELS.has(c.risk_level)).toBe(true);
        if (c.applicable_law) {
          expect(VALID_SOURCE_TYPES.has(c.applicable_law.source_type)).toBe(
            true,
          );
        }
      }

      // DE employment fixture must ground at least one clause on a DE
      // or EU statute (DE_KARENZENTSCHAEDIGUNG, DE_ARBNERFG,
      // DE_BGB_307, EU_GDPR) after locale injection — catches the
      // scenario where a German-language prompt drops citations.
      const hasStatute = result.clauses.some(
        (c) => c.applicable_law?.source_type === "statute_cited",
      );
      expect(hasStatute).toBe(true);

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
    "FR locale: enum fields stay English, citations stay FR/EU, analysis_locale='fr'",
    async () => {
      const result = await analyzeContract(
        FR_COMMERCIAL_LEASE_TEXT,
        "fast",
        true,
        "Preneur",
        provider,
        "fr",
      );

      expect(result.provenance.analysis_locale).toBe("fr");
      expect(result.provenance.provider).toBe("mistral");

      expect(result.overview.jurisdiction_evidence?.country).toBe("FR");
      expect(result.clauses.length).toBeGreaterThanOrEqual(8);

      for (const c of result.clauses) {
        expect(VALID_CATEGORIES.has(c.category)).toBe(true);
        expect(VALID_RISK_LEVELS.has(c.risk_level)).toBe(true);
        if (c.applicable_law) {
          expect(VALID_SOURCE_TYPES.has(c.applicable_law.source_type)).toBe(
            true,
          );
        }
      }

      // FR commercial lease must ground at least one clause on a FR
      // or EU statute (FR_CC_1171, FR_CC_1231_5, FR_CCOM_L442_1, or
      // EU_GDPR on §14) under a French-language prompt.
      const hasStatute = result.clauses.some(
        (c) => c.applicable_law?.source_type === "statute_cited",
      );
      expect(hasStatute).toBe(true);

      const codes = result.clauses.flatMap(
        (c) => c.applicable_law?.citations?.map((cit) => cit.code) ?? [],
      );
      for (const code of codes) {
        expect(["FR", "EU"]).toContain(code.split("_")[0]);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "IT locale: enum fields stay English, citations stay IT/EU, analysis_locale='it'",
    async () => {
      const result = await analyzeContract(
        IT_EMPLOYMENT_TEXT,
        "fast",
        true,
        "Lavoratrice",
        provider,
        "it",
      );

      expect(result.provenance.analysis_locale).toBe("it");
      expect(result.provenance.provider).toBe("mistral");

      expect(result.overview.jurisdiction_evidence?.country).toBe("IT");
      expect(result.clauses.length).toBeGreaterThanOrEqual(8);

      for (const c of result.clauses) {
        expect(VALID_CATEGORIES.has(c.category)).toBe(true);
        expect(VALID_RISK_LEVELS.has(c.risk_level)).toBe(true);
        if (c.applicable_law) {
          expect(VALID_SOURCE_TYPES.has(c.applicable_law.source_type)).toBe(
            true,
          );
        }
      }

      const codes = result.clauses.flatMap(
        (c) => c.applicable_law?.citations?.map((cit) => cit.code) ?? [],
      );
      // At least one IT citation is expected for an IT employment fixture;
      // guards against a locale-injected prompt accidentally degrading to
      // general_principle for every clause.
      const itCodes = codes.filter((code) => code.startsWith("IT_"));
      expect(itCodes.length).toBeGreaterThan(0);
      for (const code of codes) {
        expect(["IT", "EU"]).toContain(code.split("_")[0]);
      }
    },
    TIMEOUT_MS,
  );

  it(
    "NL locale: enum fields stay English, citations stay NL/EU, analysis_locale='nl'",
    async () => {
      const result = await analyzeContract(
        NL_TEXT,
        "fast",
        true,
        "Contractor",
        provider,
        "nl",
      );

      expect(result.provenance.analysis_locale).toBe("nl");
      expect(result.provenance.provider).toBe("mistral");

      expect(result.overview.jurisdiction_evidence?.country).toBe("NL");
      expect(result.clauses.length).toBeGreaterThanOrEqual(8);

      for (const c of result.clauses) {
        expect(VALID_CATEGORIES.has(c.category)).toBe(true);
        expect(VALID_RISK_LEVELS.has(c.risk_level)).toBe(true);
        if (c.applicable_law) {
          expect(VALID_SOURCE_TYPES.has(c.applicable_law.source_type)).toBe(
            true,
          );
        }
      }

      // NL freelance fixture has a stated-jurisdiction clause, so at
      // least one citation should survive locale injection.
      const hasStatute = result.clauses.some(
        (c) => c.applicable_law?.source_type === "statute_cited",
      );
      expect(hasStatute).toBe(true);

      const codes = result.clauses.flatMap(
        (c) => c.applicable_law?.citations?.map((cit) => cit.code) ?? [],
      );
      for (const code of codes) {
        expect(["NL", "EU"]).toContain(code.split("_")[0]);
      }
    },
    TIMEOUT_MS,
  );
});
