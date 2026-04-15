/**
 * Regex catalog for PII redaction. Patterns are length-validated and
 * (where applicable) checksum-validated to minimize false positives that
 * would mangle clause text.
 */

export interface Pattern {
  /** Token kind name; used as the prefix in `⟦KIND_N⟧` substitutions. */
  kind: string;
  regex: RegExp;
  /** Optional post-match validator (e.g. IBAN checksum). */
  validate?: (match: string) => boolean;
}

/**
 * IBAN mod-97 checksum per ISO 13616. Strips whitespace before checking.
 * Rejects sequences whose check digits don't compute to 1.
 *
 * Chunk size 7: leading remainder (≤96, 2 digits) concatenated with 7
 * digits yields at most 9 decimal digits (< 10^9), well under 2^53 — safe
 * for native Number arithmetic, no BigInt required.
 */
export function validIban(ibanRaw: string): boolean {
  const iban = ibanRaw.replace(/\s+/g, "").toUpperCase();
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const expanded = rearranged
    .split("")
    .map((c) => (/[A-Z]/.test(c) ? (c.charCodeAt(0) - 55).toString() : c))
    .join("");
  let remainder = 0;
  for (let i = 0; i < expanded.length; i += 7) {
    const chunk = remainder.toString() + expanded.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }
  return remainder === 1;
}

/**
 * EU member state country codes for VAT identification. Restricting the
 * prefix alternation avoids false positives on arbitrary 2-letter+digit
 * product SKUs / case references that would otherwise match a loose
 * `[A-Z]{2}\d{8,10}` pattern.
 */
const EU_VAT_PREFIXES =
  "AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|EL|HU|IE|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE|XI";

export const PATTERNS: Record<string, Pattern> = {
  email: {
    kind: "EMAIL",
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  phone: {
    kind: "PHONE",
    regex: /\+\d[\d\s\-]{7,18}\d/g,
  },
  iban: {
    kind: "IBAN",
    regex: /\b[A-Z]{2}\d{2}(?:[ \-]?[A-Z0-9]){11,30}\b/g,
    validate: (m) => validIban(m),
  },
  vat: {
    kind: "VAT",
    regex: new RegExp(
      `(?<![A-Z])(?:${EU_VAT_PREFIXES})\\d{8,12}[A-Z0-9]{0,3}\\b`,
      "g",
    ),
  },
  frenchSsn: {
    kind: "FR_SSN",
    regex: /\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/g,
  },
  germanTaxId: {
    kind: "DE_TAX_ID",
    regex: /(?<!\d)\d{11}(?!\d)/g,
  },
};
