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
import { replaceParties } from "./parties";

export interface RedactionResult {
  scrubbed: string;
  tokenMap: Map<string, string>;
}

export function redact(text: string, parties: string[]): RedactionResult {
  const tokenMap = new Map<string, string>();

  const partyResult = replaceParties(text, parties);
  for (const [token, original] of partyResult.partyMap) {
    tokenMap.set(token, original);
  }
  let working = partyResult.scrubbed;

  for (const pattern of Object.values(PATTERNS)) {
    working = applyPattern(working, pattern, tokenMap);
  }

  return { scrubbed: working, tokenMap };
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
