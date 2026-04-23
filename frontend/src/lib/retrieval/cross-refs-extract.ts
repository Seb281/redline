/**
 * SP-10 Arc 2 Task 2.2 — deterministic regex extractor for outbound
 * clause cross-references.
 *
 * Acts as the fallback half of the hybrid tagger: Pass 1 (LLM) emits
 * prose references the model can actually read ("as set forth in the
 * Termination Clause"), and this module catches the structural
 * references a literal-extraction LLM might skip over ("Section 4.2",
 * "§ 307", "Schedule B", "Artikel 12"). Output is the union of both;
 * graph-traversal (Task 2.2b) resolves the strings to clause indices.
 *
 * The catalog is deliberately multilingual — every golden-set contract
 * language (EN/FR/DE/NL/ES/IT/PL) has its own section-label vocabulary,
 * and a pure-English regex would silently miss most DE/FR/ES refs.
 */

/**
 * Each rule matches a reference family and normalises its first token
 * to a canonical casing so the graph step can deduplicate safely.
 */
interface ReferenceRule {
  /** Regex with the `g` flag; ignores case via (?i)-like patterns below. */
  readonly pattern: RegExp;
  /**
   * Canonical casing of the leading keyword. When supplied, the matched
   * string is rewritten so `section 4.2` / `SECTION 4.2` / `Section 4.2`
   * all collapse to the same canonical label.
   */
  readonly canonicalKeyword?: string;
}

/**
 * Number tail: `\d+(\.\d+)*` — supports `4`, `4.2`, `4.2.3`.
 * Used on every structural rule.
 */
const NUMERIC_TAIL = String.raw`\d+(?:\.\d+)*`;
/**
 * Schedule/Annex/Appendix/Exhibit identifier — a single capital letter
 * or one-plus digits. Tighter than the numeric tail so "Schedule Z" is
 * matched but "Schedule verysmallcase" is not (we require structured
 * labels).
 */
const SCHEDULE_ID = String.raw`[A-Z0-9]+(?:\.\d+)*`;

const RULES: readonly ReferenceRule[] = [
  // EN — Section 4.2, Section 4
  {
    pattern: new RegExp(String.raw`\bSection\s+${NUMERIC_TAIL}\b`, "gi"),
    canonicalKeyword: "Section",
  },
  // EN — Clause 3.1
  {
    pattern: new RegExp(String.raw`\bClause\s+${NUMERIC_TAIL}\b`, "gi"),
    canonicalKeyword: "Clause",
  },
  // EN — Article 12, Art. 12, Art 12
  {
    pattern: new RegExp(String.raw`\bArt(?:icle|\.)?\s+${NUMERIC_TAIL}\b`, "gi"),
    canonicalKeyword: "Article",
  },
  // EN — Paragraph 5
  {
    pattern: new RegExp(String.raw`\bParagraph\s+${NUMERIC_TAIL}\b`, "gi"),
    canonicalKeyword: "Paragraph",
  },
  // EN — Schedule A, Annex 2, Annexe B, Appendix C, Exhibit D
  {
    pattern: new RegExp(
      String.raw`\b(?:Schedule|Annexe?|Appendix|Exhibit)\s+${SCHEDULE_ID}\b`,
      "g",
    ),
  },
  // DE — Artikel, Abschnitt, Absatz, Ziffer
  {
    pattern: new RegExp(String.raw`\bArtikel\s+${NUMERIC_TAIL}\b`, "gi"),
    canonicalKeyword: "Artikel",
  },
  {
    pattern: new RegExp(String.raw`\bAbschnitt\s+${NUMERIC_TAIL}\b`, "gi"),
    canonicalKeyword: "Abschnitt",
  },
  {
    pattern: new RegExp(String.raw`\bAbsatz\s+${NUMERIC_TAIL}\b`, "gi"),
    canonicalKeyword: "Absatz",
  },
  {
    pattern: new RegExp(String.raw`\bZiffer\s+${NUMERIC_TAIL}\b`, "gi"),
    canonicalKeyword: "Ziffer",
  },
  // DE/AT/CH — § 307, §307. Kept verbatim (spacing preserved) because
  // BGB citations often travel with legal-database identifiers that the
  // graph step treats as distinct edges.
  {
    pattern: new RegExp(String.raw`§\s*${NUMERIC_TAIL}\b`, "g"),
  },
  // ES — Artículo 12
  {
    pattern: new RegExp(String.raw`\bArtículo\s+${NUMERIC_TAIL}\b`, "gi"),
    canonicalKeyword: "Artículo",
  },
  // IT — Articolo 3
  {
    pattern: new RegExp(String.raw`\bArticolo\s+${NUMERIC_TAIL}\b`, "gi"),
    canonicalKeyword: "Articolo",
  },
  // PL — Artykuł 9
  {
    pattern: new RegExp(String.raw`\bArtykuł\s+${NUMERIC_TAIL}\b`, "gi"),
    canonicalKeyword: "Artykuł",
  },
];

/**
 * Canonicalise the leading keyword of a matched reference.
 *
 * Rewrites only the first token (the keyword), preserving the numeric
 * tail's original spacing and separators. Rules with no
 * `canonicalKeyword` (e.g. `§`, `Schedule`) pass through unchanged — §
 * is already unambiguous, and `Schedule|Annex|...` is matched
 * case-sensitively.
 */
function canonicalize(match: string, rule: ReferenceRule): string {
  if (!rule.canonicalKeyword) return match.trim();
  // Split the first whitespace-run: keep `<canonical> <rest>`.
  const firstSpace = match.search(/\s/);
  if (firstSpace === -1) return rule.canonicalKeyword;
  return `${rule.canonicalKeyword} ${match.slice(firstSpace + 1).trim()}`;
}

/**
 * Extract all outbound structural references from a clause's verbatim
 * text. Deduplicated; insertion order preserved.
 */
export function extractCrossRefsFromText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rule of RULES) {
    // RegExp with `g` flag retains lastIndex between calls; rebuild on
    // each invocation via `matchAll` to stay pure.
    for (const m of text.matchAll(rule.pattern)) {
      const canonical = canonicalize(m[0], rule);
      if (!seen.has(canonical)) {
        seen.add(canonical);
        out.push(canonical);
      }
    }
  }
  return out;
}

/**
 * Merge LLM-emitted cross-references with regex-derived ones.
 *
 * LLM entries land first so prose references the model actually read
 * ("the Confidentiality Clause") outrank structural duplicates the
 * regex would also catch. Deduplication is string-identity — matching
 * on casing/whitespace happens at the regex canonicalisation step, not
 * here. `llmRefs` is defensively treated as possibly `undefined` to
 * tolerate older batch outputs or model drops of the required field.
 */
export function mergeCrossRefs(
  clauseText: string,
  llmRefs: readonly string[] | undefined | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ref of llmRefs ?? []) {
    const trimmed = ref.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  for (const ref of extractCrossRefsFromText(clauseText)) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out;
}
