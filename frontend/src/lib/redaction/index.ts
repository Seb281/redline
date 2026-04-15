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

function applyPattern(text: string, pattern: Pattern, tokenMap: Map<string, string>): string {
  const seen = new Map<string, string>();
  let counter = 1;

  const matches: { index: number; length: number; value: string }[] = [];
  for (const m of text.matchAll(pattern.regex)) {
    const value = m[0];
    if (pattern.validate && !pattern.validate(value)) continue;
    matches.push({ index: m.index ?? 0, length: value.length, value });
  }

  let out = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const { index, length, value } = matches[i];
    let token = seen.get(value);
    if (!token) {
      while (tokenMap.has(`[${pattern.kind}_${counter}]`)) counter++;
      token = `[${pattern.kind}_${counter}]`;
      tokenMap.set(token, value);
      seen.set(value, token);
      counter++;
    }
    out = out.slice(0, index) + token + out.slice(index + length);
  }
  return out;
}

/**
 * Reverse `redact`. Tokens not present in the map are left as-is so the
 * function is safe to apply twice or to partial outputs (e.g. streamed
 * chat replies that mention `[PARTY_A]`).
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
