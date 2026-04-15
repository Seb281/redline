/**
 * Party-name redaction.
 *
 * Given the parties extracted by Pass 0, replaces literal occurrences in
 * the contract text with role-label tokens (`[PARTY_A]`, `[PARTY_B]`, ...)
 * before sending to Pass 1 / Pass 2 / chat.
 *
 * Handles:
 *   - case-insensitive matching ("ACME Corp" == "acme corp")
 *   - whitespace normalization (collapse runs)
 *   - possessives ("ACME Corp's" → "[PARTY_A]'s")
 *
 * Does NOT handle (intentionally — leak risk acknowledged in spec):
 *   - synonyms / abbreviations not present in the parties list
 *   - "the Company" / "the Tenant" defined-term shorthand (out of scope for SP-1)
 */

export interface PartyMatch {
  text: string;
  index: number;
  length: number;
  partyIndex: number;
  possessive: boolean;
}

const PARTY_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameRegex(name: string): RegExp {
  const tokens = name.trim().split(/\s+/).map(escapeRegex);
  const body = tokens.join("\\s+");
  return new RegExp(`(?<![A-Za-z0-9_])(${body})('s|'s|s')?(?![A-Za-z0-9_])`, "gi");
}

export function findPartyMatches(text: string, parties: string[]): PartyMatch[] {
  const out: PartyMatch[] = [];
  parties.forEach((name, partyIndex) => {
    if (!name || !name.trim()) return;
    const re = nameRegex(name);
    for (const m of text.matchAll(re)) {
      const possessive = Boolean(m[2]);
      out.push({
        text: m[0],
        index: m.index ?? 0,
        length: m[0].length,
        partyIndex,
        possessive,
      });
    }
  });
  return out.sort((a, b) => a.index - b.index);
}

export interface PartiesReplacement {
  scrubbed: string;
  partyMap: Map<string, string>;
}

export function replaceParties(text: string, parties: string[]): PartiesReplacement {
  const cleanedParties = parties.filter((p) => p && p.trim());
  const matches = findPartyMatches(text, cleanedParties);
  const partyMap = new Map<string, string>();
  cleanedParties.forEach((name, i) => {
    if (i < PARTY_LABELS.length) {
      partyMap.set(`[PARTY_${PARTY_LABELS[i]}]`, name);
    }
  });

  let scrubbed = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.partyIndex >= PARTY_LABELS.length) continue;
    const token = `[PARTY_${PARTY_LABELS[m.partyIndex]}]`;
    const replacement = m.possessive ? `${token}'s` : token;
    scrubbed = scrubbed.slice(0, m.index) + replacement + scrubbed.slice(m.index + m.length);
  }
  return { scrubbed, partyMap };
}
