/**
 * LLM-sourced PII entity resolution (SP-3.5).
 *
 * Pass 0 emits `pii_entities: { kind, text }[]` — verbatim substrings
 * the model flagged as personally identifying (addresses, unprefixed
 * phone numbers, national IDs, dates of birth, bank details, etc.).
 * This module maps those strings back to character offsets in the
 * source text so downstream consumers (token substitution for the
 * analysis pipeline, PDF rectangle overlays for /redact) can treat
 * them uniformly with the deterministic regex hits from `patterns.ts`.
 *
 * Invariants:
 *   - Patterns always run FIRST. Entity matches that overlap an existing
 *     pattern match are dropped — the regex catalog is the trust anchor.
 *   - Entity kinds use the uppercase strings defined in the Zod schema
 *     (`piiEntityKindEnum` in analyzer.ts). Downstream consumers may
 *     coarsen these to their own `TokenKind` vocabulary.
 *   - Already-redacted tokens (`⟦KIND_N⟧`) are never re-resolved. Even
 *     if the LLM echoes a token back as an entity, it is skipped.
 */

import type { PatternMatch } from "./index";

/** One PII span as emitted by Pass 0. Kept string-typed for the kind so
 *  this module has zero runtime dependency on the analyzer schema file. */
export interface PiiEntityInput {
  kind: string;
  text: string;
}

const TOKEN_MARKER = /[\u27E6\u27E7]/;

/**
 * Escape a string for safe inclusion in a RegExp literal while keeping
 * internal whitespace tolerant: runs of spaces/tabs/newlines in the
 * model's verbatim copy are rewritten to `\s+` so a PDF that renders
 * "Hauptstraße\n12" still matches an entity text of "Hauptstraße 12".
 *
 * Returns `null` when the input collapses to an empty string (e.g. the
 * model returned whitespace only) — caller should skip such entries.
 */
function buildFlexibleRegex(text: string): RegExp | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const escaped = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(escaped, "g");
}

/**
 * Find every occurrence of each entity text in `text` and emit one
 * {@link PatternMatch} per hit. The same entity string appearing twice
 * in the document produces two matches (same behaviour as
 * `collectPatternMatches`).
 *
 * Entities whose text contains the `⟦⟧` token delimiters are skipped —
 * that character pair is reserved for already-redacted placeholders,
 * and resolving them would corrupt the token map.
 */
export function resolveEntities(
  text: string,
  entities: PiiEntityInput[],
): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const entity of entities) {
    if (!entity?.text) continue;
    if (TOKEN_MARKER.test(entity.text)) continue;
    const regex = buildFlexibleRegex(entity.text);
    if (!regex) continue;
    for (const m of text.matchAll(regex)) {
      const start = m.index ?? 0;
      const value = m[0];
      out.push({
        kind: entity.kind,
        start,
        end: start + value.length,
        value,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Merge deterministic pattern hits with LLM-sourced entity hits.
 * Patterns win on overlap — they are checksum-validated where possible
 * and never hallucinate; the entity layer is strictly additive,
 * filling the gaps (addresses, unprefixed phones, national IDs across
 * 27 member states, DOBs).
 *
 * Within the entity hits themselves, leftmost-longest wins — identical
 * policy to `collectPatternMatches` so ordering is stable across layers.
 */
export function mergeMatches(
  patternMatches: PatternMatch[],
  entityMatches: PatternMatch[],
): PatternMatch[] {
  const patterns = [...patternMatches].sort((a, b) => a.start - b.start);
  const entitiesSorted = [...entityMatches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });

  const kept: PatternMatch[] = [...patterns];
  for (const hit of entitiesSorted) {
    const overlapsPattern = patterns.some(
      (p) => hit.start < p.end && hit.end > p.start,
    );
    if (overlapsPattern) continue;
    const overlapsKept = kept.some(
      (k) => hit.start < k.end && hit.end > k.start,
    );
    if (overlapsKept) continue;
    kept.push(hit);
  }
  return kept.sort((a, b) => a.start - b.start);
}
