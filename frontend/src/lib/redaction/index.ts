/**
 * Public API for client-side PII redaction.
 *
 * Flow:
 *   1. Pass 0 (overview) extracts party names from raw contract text.
 *   2. Caller invokes `redact(rawText, parties)` → {scrubbed, tokenMap}.
 *   3. Pipeline sends `scrubbed` to Pass 1 / Pass 2 / chat.
 *   4. UI calls `rehydrate(displayedString, tokenMap)` before render so
 *      users see real names / emails again.
 *
 * Token format: `⟦KIND_N⟧` (U+27E6/U+27E7 mathematical white square
 * brackets). Chosen over ASCII `[KIND_N]` because contracts often contain
 * literal bracketed placeholders ("schedule [X]", redacted exhibits) —
 * ASCII collisions corrupt the round-trip. The `⟦⟧` delimiters are
 * effectively absent from real contract text and from LLM output, so
 * tokens survive Pass 1/2 intact.
 *
 * tokenMap lives only in client memory. It is never persisted server-side
 * (saved analyses store the rehydrated `clause_text`, not scrubbed).
 */

import { PATTERNS, type Pattern } from "./patterns";
import { replaceParties, type LabeledParty } from "./parties";
import { resolveEntities, type PiiEntityInput } from "./entities";

export type { LabeledParty };
export type { PiiEntityInput };

export interface RedactionResult {
  scrubbed: string;
  tokenMap: Map<string, string>;
}

/**
 * One raw pattern hit in a text, preserving the character offsets into
 * the original string (no substitution, no token map). Consumed by the
 * SP-3 PDF redaction pipeline, which needs offsets (not tokens) to
 * intersect with pdfjs span coordinates.
 *
 * `kind` is the same prefix used by `⟦KIND_N⟧` tokens elsewhere
 * (EMAIL/PHONE/IBAN/VAT/FR_SSN/DE_TAX_ID).
 */
export interface PatternMatch {
  kind: string;
  start: number;
  end: number;
  value: string;
}

/**
 * Returns every pattern hit in `text` as a character range.
 *
 * Unlike `redactPatterns`, this does not substitute tokens and does not
 * build a token map — it preserves the offsets into the input string so
 * downstream consumers can map them onto another coordinate system
 * (e.g. pdfjs glyph spans for layout-preserving PDF redaction).
 *
 * Ordering invariant: results are sorted by `start` ascending so the
 * caller can linear-scan without re-sorting. Overlaps between kinds are
 * resolved leftmost-wins then longest — the same precedence
 * `redactPatterns` would produce if the kinds were applied in iteration
 * order. We apply the same de-dup across kinds too so e.g. a VAT that
 * superficially looks like an IBAN fragment doesn't produce two
 * overlapping rectangles on the output PDF.
 */
export function collectPatternMatches(text: string): PatternMatch[] {
  const raw: PatternMatch[] = [];
  for (const pattern of Object.values(PATTERNS) as Pattern[]) {
    for (const m of text.matchAll(pattern.regex)) {
      const value = m[0];
      if (pattern.validate && !pattern.validate(value)) continue;
      const start = m.index ?? 0;
      raw.push({ kind: pattern.kind, start, end: start + value.length, value });
    }
  }
  // Leftmost wins, break ties by longest then by original kind order
  // (Object.values keeps insertion order, which matches PATTERNS declaration).
  const sorted = raw.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });
  const kept: PatternMatch[] = [];
  let lastEnd = -1;
  for (const hit of sorted) {
    if (hit.start < lastEnd) continue;
    kept.push(hit);
    lastEnd = hit.end;
  }
  return kept;
}

/**
 * Pattern-only redaction phase (SP-1.6). Runs BEFORE Pass 0 so the
 * server never sees raw emails, phones, IBANs, VAT numbers, national
 * IDs during overview extraction. Party names remain visible — that's
 * how Pass 0 discovers them — and are masked later by `redactParties`.
 */
export function redactPatterns(text: string): RedactionResult {
  const tokenMap = new Map<string, string>();
  let working = text;
  for (const pattern of Object.values(PATTERNS)) {
    working = applyPattern(working, pattern, tokenMap);
  }
  return { scrubbed: working, tokenMap };
}

/**
 * Party-only redaction phase (SP-1.9). Runs AFTER Pass 0 has extracted
 * the party names. Thin wrapper around `replaceParties` kept on the
 * public index for symmetry with `redactPatterns`.
 */
export function redactParties(text: string, parties: LabeledParty[]): RedactionResult {
  const result = replaceParties(text, parties);
  return { scrubbed: result.scrubbed, tokenMap: result.partyMap };
}

/**
 * LLM-sourced PII redaction phase (SP-3.5). Runs AFTER `redactPatterns`
 * so the deterministic regex catalog always wins — entities only fill
 * the gaps the regexes cannot express cleanly across 27 member states
 * (unprefixed phones, postal addresses, national IDs, DOBs, etc.).
 *
 * Counters are allocated against `existingMap` so kinds that already
 * appeared in the pattern phase (e.g. `⟦PHONE_1⟧`) continue numbering
 * from the next free index — no collision possible.
 */
export function redactEntities(
  text: string,
  entities: PiiEntityInput[],
  existingMap?: Map<string, string>,
): RedactionResult {
  const tokenMap = new Map<string, string>();
  if (!entities || entities.length === 0) {
    return { scrubbed: text, tokenMap };
  }

  const taken = new Set<string>(existingMap?.keys() ?? []);

  const raw = resolveEntities(text, entities);
  const sorted = [...raw].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });
  const deduped: typeof sorted = [];
  let lastEnd = -1;
  for (const m of sorted) {
    if (m.start < lastEnd) continue;
    deduped.push(m);
    lastEnd = m.end;
  }

  const counters = new Map<string, number>();
  const seen = new Map<string, string>();
  const replacements: { start: number; end: number; token: string }[] = [];
  for (const m of deduped) {
    let token = seen.get(m.value);
    if (!token) {
      let n = (counters.get(m.kind) ?? 0) + 1;
      while (taken.has(makeToken(m.kind, n))) n++;
      counters.set(m.kind, n);
      token = makeToken(m.kind, n);
      taken.add(token);
      tokenMap.set(token, m.value);
      seen.set(m.value, token);
    }
    replacements.push({ start: m.start, end: m.end, token });
  }

  let out = text;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end, token } = replacements[i];
    out = out.slice(0, start) + token + out.slice(end);
  }
  return { scrubbed: out, tokenMap };
}

/**
 * Thin wrapper composing the redaction phases — kept so callers outside
 * the streaming flow (chat route, Markdown export, tests) keep their
 * existing single-call API.
 *
 * Order: patterns → entities → parties. Patterns are the trust anchor
 * (checksum-validated, no hallucinations). Entities layer semantic PII
 * from Pass 0 on top of what the regexes cannot catch. Parties run last
 * so their natural-language names never straddle an already-tokenized
 * span. The three kind spaces are structurally disjoint so collisions
 * between them are avoided at the counter layer (see `redactEntities`).
 *
 * `entities` defaults to `[]` for backwards compatibility — every pre-
 * SP-3.5 caller works unchanged.
 */
export function redact(
  text: string,
  parties: LabeledParty[],
  entities: PiiEntityInput[] = [],
): RedactionResult {
  const patternPhase = redactPatterns(text);
  const entityPhase = redactEntities(
    patternPhase.scrubbed,
    entities,
    patternPhase.tokenMap,
  );
  const partyPhase = redactParties(entityPhase.scrubbed, parties);
  const tokenMap = new Map<string, string>();
  for (const [k, v] of patternPhase.tokenMap) tokenMap.set(k, v);
  for (const [k, v] of entityPhase.tokenMap) tokenMap.set(k, v);
  for (const [k, v] of partyPhase.tokenMap) tokenMap.set(k, v);
  return { scrubbed: partyPhase.scrubbed, tokenMap };
}

/**
 * Re-redact `raw` using only the tokens in `activeTokens`.
 *
 * With SP-1.9 labels, we can no longer distinguish party tokens from
 * pattern tokens by label alone (a user could pick `EMAIL` as a role —
 * unlikely but legal). The caller is responsible for supplying BOTH
 * the original full tokenMap (to know what was once tokenized) and the
 * subset still active. We rebuild by:
 *
 *   1. Running `redactPatterns` unconditionally against `raw` — every
 *      email/phone/etc. gets tokenized.
 *   2. Identifying the party tokens as (fullMap \ patternMap). For each
 *      still-active party token, we already know its original name, so
 *      we build a `LabeledParty[]` from the active subset and call
 *      `redactParties` on the patterns-scrubbed text.
 *   3. Whatever remains tokenized but is in the disabled set gets
 *      rehydrated back to originals.
 *
 * Callers must pass `fullMap` so step 2 can distinguish pattern tokens
 * from party tokens. The old signature took only `activeTokens`; this
 * is a breaking change.
 */
export function rebuildScrubbed(
  raw: string,
  fullMap: Map<string, string>,
  activeTokens: Map<string, string>,
  entities: PiiEntityInput[] = [],
): string {
  const patternPhase = redactPatterns(raw);
  const entityPhase = redactEntities(
    patternPhase.scrubbed,
    entities,
    patternPhase.tokenMap,
  );
  const patternTokens = new Set(patternPhase.tokenMap.keys());
  const entityTokens = new Set(entityPhase.tokenMap.keys());

  // Anything in fullMap that isn't a pattern or entity token is a party
  // token — reconstruct it from the encoded label.
  const partyEntries: LabeledParty[] = [];
  for (const [token, original] of fullMap) {
    if (patternTokens.has(token)) continue;
    if (entityTokens.has(token)) continue;
    if (!activeTokens.has(token)) continue;
    const m = token.match(/^\u27E6(.+)\u27E7$/);
    if (m) partyEntries.push({ name: original, label: m[1] });
  }
  const { scrubbed } = redactParties(entityPhase.scrubbed, partyEntries);

  const disabled = new Map<string, string>();
  for (const [token, original] of patternPhase.tokenMap) {
    if (!activeTokens.has(token)) disabled.set(token, original);
  }
  for (const [token, original] of entityPhase.tokenMap) {
    if (!activeTokens.has(token)) disabled.set(token, original);
  }
  return rehydrate(scrubbed, disabled);
}

/**
 * Applies one regex pattern to the working text. Matches are collected
 * forward-order, tokens are assigned forward-order (so the first
 * occurrence of an email gets `⟦EMAIL_1⟧`), then spliced in reverse to
 * keep earlier indices valid. Overlapping matches within this pattern
 * are dropped (keep longest leftmost).
 */
function applyPattern(
  text: string,
  pattern: Pattern,
  tokenMap: Map<string, string>,
): string {
  const seen = new Map<string, string>();
  let counter = 1;

  const raw: { index: number; length: number; value: string }[] = [];
  for (const m of text.matchAll(pattern.regex)) {
    const value = m[0];
    if (pattern.validate && !pattern.validate(value)) continue;
    raw.push({ index: m.index ?? 0, length: value.length, value });
  }

  // Forward pass: assign tokens in the order we encounter each value.
  const ordered = [...raw].sort((a, b) => a.index - b.index);
  const deduped: typeof ordered = [];
  let lastEnd = -1;
  for (const r of ordered) {
    if (r.index < lastEnd) continue;
    deduped.push(r);
    lastEnd = r.index + r.length;
  }

  const replacements: { index: number; length: number; token: string }[] = [];
  for (const r of deduped) {
    let token = seen.get(r.value);
    if (!token) {
      while (tokenMap.has(makeToken(pattern.kind, counter))) counter++;
      token = makeToken(pattern.kind, counter);
      tokenMap.set(token, r.value);
      seen.set(r.value, token);
      counter++;
    }
    replacements.push({ index: r.index, length: r.length, token });
  }

  // Reverse splice so earlier indices stay valid.
  let out = text;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { index, length, token } = replacements[i];
    out = out.slice(0, index) + token + out.slice(index + length);
  }
  return out;
}

function makeToken(kind: string, n: number): string {
  return `\u27E6${kind}_${n}\u27E7`;
}

/**
 * Reverse `redact`. Tokens not present in the map are left as-is so the
 * function is safe to apply twice or to partial outputs (e.g. streamed
 * chat replies that mention `⟦PARTY_A⟧`).
 *
 * Tokens are replaced longest-first as a defense against prefix
 * collisions (e.g. `⟦EMAIL_1⟧` vs `⟦EMAIL_10⟧`). With `⟦⟧` delimiters
 * the closing bracket already disambiguates, but sort-by-length keeps
 * the invariant if delimiters ever change.
 */
export function rehydrate(text: string, tokenMap: Map<string, string>): string {
  if (tokenMap.size === 0) return text;
  const tokens = Array.from(tokenMap.keys()).sort((a, b) => b.length - a.length);
  let out = text;
  for (const token of tokens) {
    const original = tokenMap.get(token)!;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), original);
  }
  return out;
}
