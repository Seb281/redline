/**
 * SP-10 Arc 2 Task 2.1 — natural-language → retrieval hints.
 *
 * Deterministic, zero-network query analysis. Two signals emitted:
 *
 *   - `categories`: which {@link ClauseCategory} values the query hints
 *     at. Feeds the per-clause category boost.
 *   - `statuteCodes`: which catalog codes from `STATUTES` the query
 *     mentions (by family alias or full code). Feeds the per-clause
 *     statute boost.
 *
 * Two rules kept as invariants by the eval harness:
 *
 *   1. Hard-coded, not LLM-driven. Keeps retrieval deterministic, holds
 *      eval numbers reproducible, avoids an extra round-trip per chat
 *      turn.
 *   2. Aliases and synonyms are plain string tables — cheap to extend
 *      and to read in a PR diff. Article-number narrowing is
 *      *deliberately* not implemented in v1: boost magnitude is small
 *      enough that surfacing every clause in a statute family on a
 *      family-name query is fine. Narrowing is refinement for v2.
 */

import type { ClauseCategory } from "@/types";
import type { StatuteCode } from "@/lib/applicable-law";

/** Output shape of {@link extractQueryHints}. */
export interface QueryHints {
  /** Categories inferred from category synonyms in the query text. */
  categories: ReadonlySet<ClauseCategory>;
  /** Catalog codes inferred from statute aliases in the query text. */
  statuteCodes: ReadonlySet<StatuteCode>;
}

/**
 * Category → natural-language synonyms. Matched case-insensitively as
 * substrings of the normalised query (whitespace-collapsed lowercase).
 * Overlaps are intentional: "liability cap" triggers both `liability`
 * (via "liability") and `limitation_of_liability` (via "liability cap")
 * — both are plausibly relevant, so we boost both.
 */
const CATEGORY_SYNONYMS: Record<ClauseCategory, readonly string[]> = {
  non_compete: [
    "non-compete",
    "non compete",
    "noncompete",
    "restrictive covenant",
    "compete clause",
  ],
  liability: ["liability", "liable", "breach of contract"],
  termination: [
    "terminat", // terminate / termination / terminating
    "end the contract",
    "end the agreement",
    "cancellation",
    "cancel the contract",
    "expir", // expire / expiration / expiry
  ],
  ip_assignment: [
    "intellectual property",
    "ip rights",
    "ip assignment",
    "assign intellectual",
    "work product",
    "invention",
  ],
  confidentiality: [
    "confidential",
    "nda",
    "non-disclosure",
    "non disclosure",
    "nondisclosure",
  ],
  governing_law: [
    "governing law",
    "applicable law",
    "choice of law",
    "which law",
    "what law applies",
  ],
  indemnification: ["indemnif", "indemnity", "hold harmless"],
  data_protection: [
    "data protection",
    "gdpr",
    "privacy",
    "personal data",
    "data subject",
  ],
  payment_terms: [
    "payment",
    "invoice",
    "fee schedule",
    "late payment",
    "net 30",
    "net 45",
    "net 60",
  ],
  limitation_of_liability: [
    "liability cap",
    "cap on damages",
    "cap on liability",
    "damage cap",
    "limit of liability",
    "limitation of liability",
  ],
  force_majeure: ["force majeure", "act of god"],
  dispute_resolution: [
    "dispute",
    "arbitration",
    "forum selection",
    "jurisdiction clause",
    "which court",
  ],
  // `other` is the residual bucket — no synonyms.
  other: [],
};

/**
 * Statute alias → catalog code set. Keys are lowercase family names or
 * directive nicknames a legally-literate user might type. Each key
 * expands to every catalog entry that plausibly belongs to that family.
 *
 * The map is tested against the golden set in the eval harness — any
 * miss surfaces as a zero-boost cell in `hybrid_metadata` numbers.
 */
const STATUTE_ALIASES: Record<string, readonly StatuteCode[]> = {
  // EU directives / regulations
  gdpr: ["EU_GDPR"],
  "2016/679": ["EU_GDPR"],
  "rome i": ["EU_REG_593_2008"],
  "593/2008": ["EU_REG_593_2008"],
  "unfair terms": ["EU_DIR_93_13_EEC"],
  "93/13": ["EU_DIR_93_13_EEC"],
  "commercial agents": ["EU_DIR_86_653_EEC"],
  "86/653": ["EU_DIR_86_653_EEC"],
  "consumer rights": ["EU_DIR_2011_83_EU"],
  "2011/83": ["EU_DIR_2011_83_EU"],

  // Germany
  bgb: ["DE_BGB_276", "DE_BGB_307"],
  hgb: ["DE_HGB_377", "DE_KARENZENTSCHAEDIGUNG"],
  agb: ["DE_BGB_307"],
  "agb-kontrolle": ["DE_BGB_307"],
  inhaltskontrolle: ["DE_BGB_307"],
  arbeitnehmererfindungsgesetz: ["DE_ARBNERFG"],
  karenzentschädigung: ["DE_KARENZENTSCHAEDIGUNG"],
  karenzentschaedigung: ["DE_KARENZENTSCHAEDIGUNG"],

  // Netherlands
  bw: ["NL_BW_7_650", "NL_BW_7_653", "NL_BW_6_248", "NL_BW_6_233", "NL_BW_7_408"],
  "burgerlijk wetboek": [
    "NL_BW_7_650",
    "NL_BW_7_653",
    "NL_BW_6_248",
    "NL_BW_6_233",
    "NL_BW_7_408",
  ],
  "redelijkheid en billijkheid": ["NL_BW_6_248"],
  "algemene voorwaarden": ["NL_BW_6_233"],
  opzegging: ["NL_BW_7_408"],

  // France
  "code civil": ["FR_CC_1171", "FR_CC_1231_5"],
  "code de commerce": ["FR_CCOM_L442_1"],
  "code du travail": ["FR_CODE_TRAVAIL_NONCOMPETE"],
  "contrepartie financière": ["FR_CODE_TRAVAIL_NONCOMPETE"],
  "clause pénale": ["FR_CC_1231_5"],

  // Spain
  "código civil": ["ES_CC_1255", "ES_CC_1256", "ES_CC_1258", "ES_CC_1124"],
  "codigo civil": ["ES_CC_1255", "ES_CC_1256", "ES_CC_1258", "ES_CC_1124"],
  "estatuto de los trabajadores": ["ES_ET_21"],
  permanencia: ["ES_ET_21"],

  // Italy
  "codice civile": ["IT_CC_1341", "IT_CC_1229", "IT_CC_2125", "IT_CC_1375"],
  "codice del consumo": ["IT_CDC_33"],
  "d.lgs. 206/2005": ["IT_CDC_33"],

  // Poland
  "kodeks cywilny": ["PL_KC_353_1", "PL_KC_471", "PL_KC_484"],
  "kodeks pracy": ["PL_KP_101_2"],
  "kara umowna": ["PL_KC_484"],
};

function normalise(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Parse a free-text query into retrieval hints.
 *
 * Case-insensitive substring matching. Never throws, always returns a
 * (possibly empty) {@link QueryHints}. Callers can feed the empty case
 * straight through the boost function, which no-ops on empty hints.
 */
export function extractQueryHints(query: string): QueryHints {
  const normalised = normalise(query);
  if (!normalised) {
    return { categories: new Set(), statuteCodes: new Set() };
  }

  const categories = new Set<ClauseCategory>();
  for (const [cat, syns] of Object.entries(CATEGORY_SYNONYMS) as [
    ClauseCategory,
    readonly string[],
  ][]) {
    for (const s of syns) {
      if (normalised.includes(s)) {
        categories.add(cat);
        break;
      }
    }
  }

  const statuteCodes = new Set<StatuteCode>();
  for (const [alias, codes] of Object.entries(STATUTE_ALIASES)) {
    if (normalised.includes(alias)) {
      for (const c of codes) statuteCodes.add(c);
    }
  }

  return { categories, statuteCodes };
}
