/**
 * SP-10 Arc 2 Task 2.2b — build a clause→clause graph from Pass 2
 * cross_refs and expose a depth-1 neighbour lookup.
 *
 * Strategy: each clause's cross_refs are strings. We normalise them to
 * the same canonical form the regex extractor uses ("section 4.2" →
 * "Section 4.2"), then join against an index of canonical *incoming*
 * labels for every clause — a clause's title often contains its own
 * section label ("Section 4.2 — Service Levels"), and many contracts
 * prefix clause text with a section number we can parse.
 *
 * Conservative by design: an unresolved ref is dropped silently rather
 * than producing a noisy edge. Downstream retrieval would rather miss
 * a neighbour than surface an unrelated clause as graph-proximate.
 *
 * Depth-1 only. Transitive closure on an in-memory graph is cheap but
 * adds no measurable recall at the traversal depths that matter for
 * chat context — the LLM only consumes the top-K anyway.
 */

import type { AnalyzedClause } from "@/types";

/**
 * Canonicalise a label string for graph joins: lower-case, collapse
 * whitespace, strip trailing punctuation. Applied to both refs and
 * incoming labels so casing/punctuation drift does not cause misses.
 */
function canonical(label: string): string {
  return label
    .toLowerCase()
    .replace(/[\s.,;:—–-]+/g, " ")
    .trim();
}

/**
 * Regex catalog mirroring `cross-refs-extract.ts`. Kept local so the
 * graph builder can scan clause titles + text prefixes for *incoming*
 * labels without importing the extractor's private rule table.
 */
const INCOMING_LABEL_PATTERNS: readonly RegExp[] = [
  /\bSection\s+\d+(?:\.\d+)*\b/gi,
  /\bClause\s+\d+(?:\.\d+)*\b/gi,
  /\bArt(?:icle|\.)?\s+\d+(?:\.\d+)*\b/gi,
  /\bParagraph\s+\d+(?:\.\d+)*\b/gi,
  /\b(?:Schedule|Annexe?|Appendix|Exhibit)\s+[A-Z0-9]+(?:\.\d+)*\b/g,
  /\bArtikel\s+\d+(?:\.\d+)*\b/gi,
  /\bAbschnitt\s+\d+(?:\.\d+)*\b/gi,
  /\bAbsatz\s+\d+(?:\.\d+)*\b/gi,
  /\bZiffer\s+\d+(?:\.\d+)*\b/gi,
  /§\s*\d+(?:\.\d+)*\b/g,
  /\bArtículo\s+\d+(?:\.\d+)*\b/gi,
  /\bArticolo\s+\d+(?:\.\d+)*\b/gi,
  /\bArtykuł\s+\d+(?:\.\d+)*\b/gi,
];

/**
 * Collect every incoming-label candidate a clause can match against.
 *
 * Scans the title and the first line of clause_text — section labels
 * almost always sit at the head of the clause in real contracts, and
 * scanning the whole body would occasionally pick up an *outgoing*
 * reference by accident (e.g. a clause about Section 3 that also
 * mentions Section 7 would then match both labels as incoming).
 */
function incomingLabelsFor(c: AnalyzedClause): string[] {
  const head = [c.title ?? "", (c.clause_text ?? "").split("\n")[0]]
    .join(" ")
    .trim();
  const labels = new Set<string>();
  for (const re of INCOMING_LABEL_PATTERNS) {
    for (const m of head.matchAll(re)) {
      labels.add(canonical(m[0]));
    }
  }
  return [...labels];
}

/**
 * Build the clause→clause cross-reference graph.
 *
 * Return value: a Map from source clause index to a Set of target
 * clause indices. Clauses with no resolvable outbound edges are absent
 * from the map (not mapped to an empty set) so the data structure is
 * cheap for sparse graphs — the typical case on our eval corpus is
 * <10% of clauses having any outbound ref.
 */
export function buildCrossRefGraph(
  clauses: readonly AnalyzedClause[],
): Map<number, Set<number>> {
  // Inverse index: canonical incoming label → clause indices that
  // advertise that label. Arrays (not Sets) because we typically see a
  // single owner per label; a duplicate label across two clauses means
  // the edge goes to *all* advertising clauses.
  const labelToIds = new Map<string, number[]>();
  for (let i = 0; i < clauses.length; i++) {
    for (const label of incomingLabelsFor(clauses[i])) {
      const existing = labelToIds.get(label);
      if (existing) existing.push(i);
      else labelToIds.set(label, [i]);
    }
  }

  const graph = new Map<number, Set<number>>();
  for (let i = 0; i < clauses.length; i++) {
    const refs = clauses[i].cross_refs ?? [];
    if (refs.length === 0) continue;
    const targets = new Set<number>();
    for (const rawRef of refs) {
      const canonRef = canonical(rawRef);
      const hits = labelToIds.get(canonRef);
      if (!hits) continue;
      for (const j of hits) {
        if (j !== i) targets.add(j);
      }
    }
    if (targets.size > 0) graph.set(i, targets);
  }
  return graph;
}

/**
 * Return every clause id one hop out from any seed, excluding the
 * seeds themselves. Deterministic iteration order: follows insertion
 * order of the underlying Maps/Sets.
 */
export function depthOneNeighbours(
  seeds: ReadonlySet<number>,
  graph: ReadonlyMap<number, ReadonlySet<number>>,
): Set<number> {
  const out = new Set<number>();
  for (const seed of seeds) {
    const adj = graph.get(seed);
    if (!adj) continue;
    for (const target of adj) {
      if (seeds.has(target)) continue;
      out.add(target);
    }
  }
  return out;
}
