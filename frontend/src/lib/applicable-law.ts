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
    code: "FR_CODE_TRAVAIL_NONCOMPETE",
    country: "FR",
    label:
      "Code du Travail — French non-compete compensation (contrepartie financière)",
    applicability: "French non-compete without contrepartie financière.",
  },
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
