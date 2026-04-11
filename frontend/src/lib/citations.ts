/**
 * Parse a plain-English narrative containing `[^N]` citation markers into
 * a flat segment list suitable for React rendering.
 *
 * This module is pure — no React, no async, no I/O — so it can be unit
 * tested in isolation and reused anywhere we need to turn an LLM-produced
 * narrative with inline citations into either UI or Markdown output.
 */

import type { AnalyzedClause } from "@/types";

/** One renderable segment of a citation-annotated narrative. */
export type CitationSegment =
  | { kind: "text"; value: string }
  | {
      kind: "cite";
      id: number;
      /** The verbatim quote from the clause, or null for orphan markers. */
      quotedText: string | null;
      /** True only if `quotedText` was confirmed to exist in the clause. */
      verified: boolean;
    };

/** Regex that matches `[^1]`, `[^23]`, etc. — the inline marker form. */
const MARKER_REGEX = /\[\^(\d+)\]/g;

/**
 * Normalize a string for substring verification.
 *
 * Makes the comparison robust to minor differences that do not change
 * semantics: case, collapsible whitespace, and curly-vs-straight quotes.
 * Anything else (punctuation, digits, parens) stays literal so the match
 * still means "this phrase actually appears in the clause".
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Verify that `quote` is a substring of `clauseText` under normalization. */
function isQuoteInClause(quote: string, clauseText: string): boolean {
  return normalize(clauseText).includes(normalize(quote));
}

/**
 * Split a narrative on `[^N]` markers, resolve each marker against the
 * provided citations, verify quotes against the clause text, and append
 * any standalone (unreferenced) citations at the end.
 */
export function parseExplanation(
  narrative: string,
  citations: AnalyzedClause["citations"],
  clauseText: string,
): CitationSegment[] {
  const citationMap = new Map<number, string>();
  for (const c of citations ?? []) {
    citationMap.set(c.id, c.quoted_text);
  }

  const segments: CitationSegment[] = [];
  const usedIds = new Set<number>();

  let lastIndex = 0;
  // Reset regex state — the `g` flag is stateful across calls.
  MARKER_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MARKER_REGEX.exec(narrative)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        kind: "text",
        value: narrative.slice(lastIndex, match.index),
      });
    }

    const id = Number.parseInt(match[1], 10);
    const quoted = citationMap.get(id);
    usedIds.add(id);

    if (quoted === undefined) {
      segments.push({ kind: "cite", id, quotedText: null, verified: false });
    } else {
      segments.push({
        kind: "cite",
        id,
        quotedText: quoted,
        verified: isQuoteInClause(quoted, clauseText),
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < narrative.length) {
    segments.push({ kind: "text", value: narrative.slice(lastIndex) });
  }

  // Append any citations that had no matching marker in the narrative.
  for (const c of citations ?? []) {
    if (!usedIds.has(c.id)) {
      segments.push({
        kind: "cite",
        id: c.id,
        quotedText: c.quoted_text,
        verified: isQuoteInClause(c.quoted_text, clauseText),
      });
    }
  }

  return segments;
}
