/**
 * SP-1.7 — Canonical whitelist of statutes that clause-level
 * `applicable_law` citations may reference. The Zod schema in analyzer.ts
 * validates that every emitted `code` belongs to this set, which gives
 * us the "cannot hallucinate citations" guarantee at the type boundary.
 *
 * Launch scope (~8 statutes) harvested from the EU rules already
 * hardcoded in the Pass 2 prompt. Expansion across more EU member
 * states is deferred to SP-1.7.1.
 *
 * Labels are the canonical human-readable strings the UI renders.
 * The LLM emits only `code`; the label is looked up client-side so
 * label drift is impossible.
 */

export const STATUTE_CODES = [
  "DE_BGB_276",
  "DE_ARBNERFG",
  "DE_KARENZENTSCHAEDIGUNG",
  "NL_BW_7_650",
  "NL_BW_7_653",
  "FR_CODE_TRAVAIL_NONCOMPETE",
  "EU_GDPR",
  "EU_DIR_93_13_EEC",
] as const;

export type StatuteCode = (typeof STATUTE_CODES)[number];

export const STATUTE_LABELS: Record<StatuteCode, string> = {
  DE_BGB_276: "BGB §276 — German Civil Code",
  DE_ARBNERFG: "Arbeitnehmererfindungsgesetz — German Employee Invention Law",
  DE_KARENZENTSCHAEDIGUNG:
    "HGB §74 — German non-compete compensation requirement",
  NL_BW_7_650: "BW 7:650 — Dutch Civil Code (non-compete form)",
  NL_BW_7_653: "BW 7:653 — Dutch Civil Code (non-compete validity)",
  FR_CODE_TRAVAIL_NONCOMPETE:
    "Code du Travail — French non-compete compensation (contrepartie financière)",
  EU_GDPR: "GDPR — Regulation (EU) 2016/679",
  EU_DIR_93_13_EEC: "Directive 93/13/EEC — EU Unfair Terms",
};
