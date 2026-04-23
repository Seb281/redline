/**
 * SP-10 Arc 2 Task 2.2b — defined-term resolver + depth-1 expansion.
 *
 * Contracts lean on capitalised defined terms introduced in a dedicated
 * definitions clause ("Confidential Information", "the Services"). A
 * question like "what counts as confidential information?" wants the
 * *defining* clause, not a downstream breach clause that merely cites
 * the term. This module builds a term→clause-index map and exposes a
 * helper that widens a retrieval set with every defining clause
 * referenced by the hit set.
 *
 * Conservative by design: only matches terms introduced via canonical
 * patterns. Casual capitalisation would match every proper noun —
 * every "Provider", "Services" capitalisation would land in the map —
 * and poison graph-widening with noise.
 */

import type { AnalyzedClause } from "@/types";

/**
 * Quoted term introduced as a subject of a `means`/`shall mean` clause.
 * Matches `"Confidential Information" means …` and minor variants.
 */
const QUOTE_MEANS_RE =
  /"([^"\n]{1,120}?)"\s+(?:shall\s+)?means?\b/g;

/**
 * Parenthetical definition: `ACME Industries (the "Provider")`.
 * The `the` is optional — contracts occasionally drop it.
 */
const PARENTHETICAL_RE =
  /\(\s*(?:the\s+)?"([^"\n]{1,120}?)"\s*\)/g;

/**
 * Extract defined-term candidates from a single clause's text.
 * Returns terms in source order, duplicates preserved so the caller
 * can apply first-wins semantics across the whole corpus.
 */
function extractDefinedTerms(text: string): string[] {
  const terms: string[] = [];
  for (const re of [QUOTE_MEANS_RE, PARENTHETICAL_RE]) {
    for (const m of text.matchAll(re)) {
      const term = m[1]?.trim();
      if (term) terms.push(term);
    }
  }
  return terms;
}

/**
 * Build the defined-terms → clause-index map.
 *
 * First-definition-wins: real contracts occasionally redefine a term
 * informally further down. Retrieval precision wants the authoritative
 * definitions clause, not the later incidental one, so we skip a term
 * that is already mapped.
 */
export function buildDefinitionsMap(
  clauses: readonly AnalyzedClause[],
): Map<string, number> {
  const defs = new Map<string, number>();
  for (let i = 0; i < clauses.length; i++) {
    const text = clauses[i].clause_text ?? "";
    for (const term of extractDefinedTerms(text)) {
      if (!defs.has(term)) defs.set(term, i);
    }
  }
  return defs;
}

/**
 * Widen a retrieved clause set with every defining clause referenced
 * by the set's members. Returns only the *added* ids (the caller unions
 * this with its own seed set) and excludes clauses already retrieved —
 * matches the shape `depthOneNeighbours` returns for cross-refs so the
 * two widening passes compose the same way.
 *
 * Term detection uses `includes()` — case-sensitive, substring — which
 * is adequate because defined terms are always capitalised in real
 * contracts. Case-insensitive matching would pick up lowercase English
 * prose ("the services we offer") and over-widen.
 */
export function expandWithDefinitions(
  retrieved: ReadonlySet<number>,
  clauses: readonly AnalyzedClause[],
): Set<number> {
  const defs = buildDefinitionsMap(clauses);
  if (defs.size === 0) return new Set();

  const out = new Set<number>();
  for (const idx of retrieved) {
    const text = clauses[idx]?.clause_text ?? "";
    if (!text) continue;
    for (const [term, defIdx] of defs) {
      if (retrieved.has(defIdx)) continue;
      if (defIdx === idx) continue;
      if (text.includes(term)) out.add(defIdx);
    }
  }
  return out;
}
