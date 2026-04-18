/**
 * SP-1.7 / SP-2 — Canonical catalog of statutes that clause-level
 * `applicable_law` citations may reference. The Zod schema in
 * `analyzer.ts` validates that every emitted `code` belongs to this
 * set, which gives us the "cannot hallucinate citations" guarantee at
 * the type boundary.
 *
 * SP-2 tags every entry with its country (one of the 6 supported
 * countries or "EU" for EU-wide directives). `filterStatutes` uses the
 * tag to dispatch a jurisdiction-specific whitelist into the Pass 2
 * prompt — supported countries get country statutes + EU, other EU-27
 * members get EU only, non-EU / unknown get the empty set.
 *
 * Labels are the canonical human-readable strings the UI renders.
 * Applicability lines are fed directly into the Pass 2 system prompt.
 * The LLM emits only `code`; labels and applicability are looked up
 * client-side so drift is impossible.
 */

import { EU_COUNTRY_CODES, type CountryCode } from "@/types";

/**
 * SP-2 — Countries with dedicated statute entries in the catalog.
 * Other EU-27 members receive EU-wide statutes only at dispatch time.
 */
export const SUPPORTED_COUNTRIES = [
  "DE",
  "NL",
  "FR",
  "ES",
  "IT",
  "PL",
] as const;
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

/** Re-export for catalog consumers — avoids a second import from @/types. */
export const EU_MEMBERS = EU_COUNTRY_CODES;

/**
 * Country tag on catalog entries. Either one of the 6 supported ISO-2
 * codes or the literal "EU" for EU-wide directives that apply across
 * every member state.
 */
export type StatuteCountry = SupportedCountry | "EU";

/** A single catalog entry — stable id, country tag, and rendering strings. */
export interface StatuteEntry {
  /** Stable machine id, e.g. "IT_CC_2596". Emitted by the LLM. */
  code: string;
  /** Country tag used for Pass 2 dispatch. */
  country: StatuteCountry;
  /** Canonical legal label (local language + short English gloss). */
  label: string;
  /** One-line applicability guidance rendered into the Pass 2 prompt. */
  applicability: string;
}

/**
 * The canonical catalog. Order is stable but not semantically meaningful
 * — consumers filter or look up by `code`.
 */
export const STATUTES: readonly StatuteEntry[] = [
  // --- DE (5) ---
  {
    code: "DE_BGB_276",
    country: "DE",
    label: "BGB §276 — German Civil Code",
    applicability:
      "liability exclusion covering gross negligence or intentional misconduct.",
  },
  {
    code: "DE_ARBNERFG",
    country: "DE",
    label: "Arbeitnehmererfindungsgesetz — German Employee Invention Law",
    applicability:
      "broad IP-assignment clause conflicting with employee invention rights.",
  },
  {
    code: "DE_KARENZENTSCHAEDIGUNG",
    country: "DE",
    label: "HGB §74 — German non-compete compensation requirement",
    applicability:
      "German non-compete lacking paid Karenzentschädigung compensation.",
  },
  {
    code: "DE_BGB_307",
    country: "DE",
    label:
      "BGB §307 (Inhaltskontrolle / AGB-Kontrolle) — German standard-terms fairness control",
    applicability:
      "standard-form (non-negotiated) clause unreasonably disadvantaging the counterparty — blanket liability exclusions, one-sided indemnities, broad warranty disclaimers, onerous LD caps, or deviations from statutory defaults (applies B2B per BGH).",
  },
  {
    code: "DE_HGB_377",
    country: "DE",
    label:
      "HGB §377 (Untersuchungs- und Rügepflicht) — German duty to inspect and notice defects",
    applicability:
      "B2B sale-of-goods or supply clause governing acceptance, inspection windows, defect-notice periods, or warranty triggers; buyer forfeits warranty claims without timely notice.",
  },

  // --- NL (5) ---
  {
    code: "NL_BW_7_650",
    country: "NL",
    label: "BW 7:650 — Dutch Civil Code (non-compete form)",
    applicability: "Dutch non-compete lacking written form or clear scope.",
  },
  {
    code: "NL_BW_7_653",
    country: "NL",
    label: "BW 7:653 — Dutch Civil Code (non-compete validity)",
    applicability:
      "Dutch non-compete of questionable validity (scope, duration, compensation).",
  },
  {
    code: "NL_BW_6_248",
    country: "NL",
    label:
      "BW 6:248 (redelijkheid en billijkheid) — Dutch reasonableness-and-fairness override",
    applicability:
      "clause whose enforcement would be unacceptably harsh, one-sided, or contrary to good faith — especially penalty, exclusion, or unilateral-discretion clauses.",
  },
  {
    code: "NL_BW_6_233",
    country: "NL",
    label:
      "BW 6:233 (algemene voorwaarden) — Dutch voidability of unreasonably onerous standard terms",
    applicability:
      "clause in standard/boilerplate terms that is unusually onerous (broad liability caps, short limitation periods, unilateral amendment, automatic renewal) or where no real opportunity to review the terms existed.",
  },
  {
    code: "NL_BW_7_408",
    country: "NL",
    label:
      "BW 7:408 (opzegging opdracht) — Dutch termination of assignment-of-services contracts",
    applicability:
      "services/consulting/freelance (opdracht) clause restricting the principal's right to terminate at will, or imposing penalties/lock-ins on termination by a non-professional principal.",
  },

  // --- FR (4) ---
  {
    code: "FR_CODE_TRAVAIL_NONCOMPETE",
    country: "FR",
    label:
      "Code du Travail — French non-compete compensation (contrepartie financière)",
    applicability: "French non-compete without contrepartie financière.",
  },
  {
    code: "FR_CC_1171",
    country: "FR",
    label:
      "Code civil art. 1171 — French adhesion-contract significant-imbalance rule",
    applicability:
      "non-negotiable boilerplate clause in an adhesion contract granting one party disproportionate rights or obligations (excluding price/main object) — deemed unwritten (réputée non écrite).",
  },
  {
    code: "FR_CCOM_L442_1",
    country: "FR",
    label:
      "Code de commerce art. L.442-1 — French B2B significant imbalance & abrupt-termination liability",
    applicability:
      "B2B supply/distribution/services clause imposing obligations lacking reciprocity, or a termination clause without sufficient notice for an established commercial relationship.",
  },
  {
    code: "FR_CC_1231_5",
    country: "FR",
    label:
      "Code civil art. 1231-5 — French judicial revision of excessive/derisory penalty clauses",
    applicability:
      "liquidated damages / clause pénale fixing a sum that appears manifestly excessive or derisory, or purporting to bar judicial revision (any carve-out is void).",
  },

  // --- ES (5) ---
  {
    code: "ES_CC_1255",
    country: "ES",
    label:
      "Código Civil art. 1255 — Spanish freedom of contract (limits: law, morals, public order)",
    applicability:
      "atypical/bespoke clause whose validity depends on autonomía de la voluntad; also cite as counterweight when a clause pushes against imperative law, morals, or public order.",
  },
  {
    code: "ES_CC_1256",
    country: "ES",
    label:
      "Código Civil art. 1256 — Spanish prohibition on unilateral arbitrio",
    applicability:
      "clause giving one party unilateral discretion to modify, interpret, terminate, or determine performance/price without objective criteria.",
  },
  {
    code: "ES_CC_1258",
    country: "ES",
    label: "Código Civil art. 1258 — Spanish good-faith integration of contracts",
    applicability:
      "clause that is technically compliant but undermines cooperation, disclosure, or reasonable-expectations duties (gotcha notice mechanics, hidden fees, pretextual termination, bad-faith audit rights).",
  },
  {
    code: "ES_CC_1124",
    country: "ES",
    label:
      "Código Civil art. 1124 — Spanish implied right to terminate reciprocal obligations on material breach",
    applicability:
      "termination, default, cure, and breach-remedy clauses that try to waive or narrow the resolution remedy, or where breach definitions are unclear.",
  },
  {
    code: "ES_ET_21",
    country: "ES",
    label:
      "Estatuto de los Trabajadores art. 21 — Spanish non-compete and permanencia",
    applicability:
      "employment non-compete, exclusivity, or permanencia/stay-put clause; caps: post-contract non-compete max 2y (technicians) / 6m (others) with adequate compensation; permanencia max 2y with written form and training investment.",
  },

  // --- IT (5) ---
  {
    code: "IT_CC_1341",
    country: "IT",
    label:
      "Codice Civile art. 1341 — Italian onerous-clause separate-signature rule",
    applicability:
      "B2B/adhesion clause that is onerous (liability limits, withdrawal/suspension rights, forfeitures, tacit renewal, arbitration, forum selection, limits on third-party dealings) and requires separate written signature; unenforceable without it.",
  },
  {
    code: "IT_CC_1229",
    country: "IT",
    label:
      "Codice Civile art. 1229 — Italian void limitation of liability for willful misconduct/gross negligence",
    applicability:
      "clause excluding or capping liability for dolo or colpa grave, or using a token penalty clause to evade that limit — null under Italian law.",
  },
  {
    code: "IT_CC_2125",
    country: "IT",
    label:
      "Codice Civile art. 2125 — Italian post-termination employee non-compete requirements",
    applicability:
      "employment post-termination non-compete clause — void unless in writing, with proportionate consideration, and bounded in object, geography, and duration (max 5y executives / 3y others).",
  },
  {
    code: "IT_CDC_33",
    country: "IT",
    label:
      "Codice del Consumo (D.Lgs. 206/2005) art. 33 — Italian unfair-terms control in B2C contracts",
    applicability:
      "B2C clause creating significant imbalance to consumer detriment — especially exclusions, unilateral modification, forum, penalties, or evidence-burden shifts. Pair with Italian art. 36 black-list of absolute nullity where applicable.",
  },
  {
    code: "IT_CC_1375",
    country: "IT",
    label: "Codice Civile art. 1375 — Italian duty of good-faith performance",
    applicability:
      "clause granting unfettered discretion, one-sided termination/suspension, or aggressive enforcement rights that could be exercised abusively (abuso del diritto).",
  },

  // --- PL (4) ---
  {
    code: "PL_KC_353_1",
    country: "PL",
    label:
      "Kodeks cywilny Art. 353¹ — Polish freedom of contract (public-policy ceiling)",
    applicability:
      "clause whose content or purpose contradicts statutory law, the nature of the contract type, or zasady współżycia społecznego (principles of social coexistence).",
  },
  {
    code: "PL_KC_471",
    country: "PL",
    label:
      "Kodeks cywilny Art. 471 — Polish contractual liability baseline",
    applicability:
      "clause limiting, excluding, or expanding liability for non-performance or improper performance; baseline: debtor liable unless breach stems from circumstances not attributable to them.",
  },
  {
    code: "PL_KC_484",
    country: "PL",
    label:
      "Kodeks cywilny Art. 484 — Polish liquidated damages (kara umowna) judicial reduction",
    applicability:
      "clause setting contractual penalties; § 2 allows judicial reduction if obligation largely performed or penalty grossly excessive; § 1: penalty caps damages unless parties agree otherwise.",
  },
  {
    code: "PL_KP_101_2",
    country: "PL",
    label:
      "Kodeks pracy Art. 101² — Polish post-termination non-compete",
    applicability:
      "employment clause restricting competition after employment ends; mandatory: defined duration and minimum compensation of 25% of pre-termination remuneration.",
  },

  // --- EU (5) ---
  {
    code: "EU_GDPR",
    country: "EU",
    label: "GDPR — Regulation (EU) 2016/679",
    applicability:
      "data-protection clause waiving data subject rights or conflicting with Regulation 2016/679.",
  },
  {
    code: "EU_DIR_93_13_EEC",
    country: "EU",
    label: "Directive 93/13/EEC — EU Unfair Terms",
    applicability:
      "markedly one-sided clause (consumer, sometimes B2B per national implementation).",
  },
  {
    code: "EU_DIR_86_653_EEC",
    country: "EU",
    label:
      "Directive 86/653/EEC — EU Commercial Agents (indemnity/compensation on termination)",
    applicability:
      "clause waiving, capping, or shortening termination indemnity/compensation, post-termination notice, or commission rights of a self-employed commercial agent.",
  },
  {
    code: "EU_REG_593_2008",
    country: "EU",
    label: "Regulation (EC) 593/2008 (Rome I) — law applicable to contractual obligations",
    applicability:
      "choice-of-law clause that overrides mandatory consumer/employee protections, picks a non-EU law in a cross-border B2C/employment context, or conflicts with overriding mandatory rules of the forum.",
  },
  {
    code: "EU_DIR_2011_83_EU",
    country: "EU",
    label:
      "Directive 2011/83/EU — EU Consumer Rights (pre-contractual info + 14-day withdrawal)",
    applicability:
      "B2C distance/off-premises clause omitting mandatory pre-contractual info, waiving/shortening the 14-day withdrawal right, or imposing fees/penalties for withdrawal.",
  },
] as const;

/** Literal union of every catalog entry's `code` — the Zod enum source. */
export type StatuteCode = (typeof STATUTES)[number]["code"];

/**
 * Flat list of catalog codes, derived from `STATUTES`. Kept as a named
 * export for backwards compatibility with the SP-1.7 analyzer schema
 * (`z.enum(STATUTE_CODES)`). New code should prefer `STATUTES` + a
 * `.map(s => s.code)` projection at call site.
 */
export const STATUTE_CODES: readonly StatuteCode[] = STATUTES.map(
  (s) => s.code,
) as StatuteCode[];

/**
 * Code → canonical label map, derived from `STATUTES`. Kept as a named
 * export so UI components (`ApplicableLawCite`) can look up a label
 * from the stable code emitted by the LLM.
 */
export const STATUTE_LABELS: Record<StatuteCode, string> =
  Object.fromEntries(
    STATUTES.map((s) => [s.code, s.label]),
  ) as Record<StatuteCode, string>;

/**
 * SP-2 — Filter the catalog for a given contract jurisdiction.
 *
 * Dispatch tiers:
 *  - supported country (DE/NL/FR/ES/IT/PL): country statutes + EU
 *  - other EU-27 (BE, AT, SE, ...):         EU only
 *  - non-EU or unknown (country === null):  empty
 */
export function filterStatutes(
  country: CountryCode | null,
): StatuteEntry[] {
  if (country === null) return [];
  const supported = (SUPPORTED_COUNTRIES as readonly string[]).includes(
    country,
  );
  return STATUTES.filter(
    (s) =>
      s.country === "EU" ||
      (supported && s.country === (country as SupportedCountry)),
  );
}
