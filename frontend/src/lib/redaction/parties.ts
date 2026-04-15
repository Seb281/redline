/**
 * Party-name redaction.
 *
 * Given the parties extracted by Pass 0, replaces literal occurrences in
 * the contract text with role-label tokens (`⟦PARTY_A⟧`, `⟦PARTY_B⟧`, ...)
 * before sending to Pass 1 / Pass 2 / chat.
 *
 * Handles:
 *   - case-insensitive matching ("ACME Corp" == "acme corp")
 *   - whitespace normalization (collapse runs)
 *   - possessives ("ACME Corp's" → "⟦PARTY_A⟧'s"), including curly `’`,
 *     preserved verbatim so round-trip restores the original character
 *   - overlapping / duplicate party entries: longest match at each span
 *     wins; subsequent overlapping matches are dropped to avoid splice
 *     corruption during reverse replacement
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
  /** Verbatim possessive suffix from the source text ("'s", "’s", "s'", ""). */
  suffix: string;
}

const PARTY_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameRegex(name: string): RegExp {
  const tokens = name.trim().split(/\s+/).map(escapeRegex);
  const body = tokens.join("\\s+");
  return new RegExp(
    `(?<![A-Za-z0-9_])(${body})('s|'s|s'|\u2019s|s\u2019)?(?![A-Za-z0-9_])`,
    "gi",
  );
}

export function findPartyMatches(text: string, parties: string[]): PartyMatch[] {
  const raw: PartyMatch[] = [];
  parties.forEach((name, partyIndex) => {
    if (!name || !name.trim()) return;
    const re = nameRegex(name);
    for (const m of text.matchAll(re)) {
      const suffix = m[2] ?? "";
      raw.push({
        text: m[0],
        index: m.index ?? 0,
        length: m[0].length,
        partyIndex,
        possessive: Boolean(suffix),
        suffix,
      });
    }
  });
  return dedupOverlaps(raw);
}

/**
 * Drops overlapping matches. When two parties match the same span
 * (duplicate names, or a shorter name contained in a longer one like
 * "ACME" inside "ACME Corp"), keep the longest; ties break by lowest
 * partyIndex so numbering stays stable. Prevents splice corruption
 * during reverse replacement.
 */
function dedupOverlaps(matches: PartyMatch[]): PartyMatch[] {
  const sorted = [...matches].sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    if (a.length !== b.length) return b.length - a.length;
    return a.partyIndex - b.partyIndex;
  });
  const kept: PartyMatch[] = [];
  let lastEnd = -1;
  for (const m of sorted) {
    if (m.index < lastEnd) continue;
    kept.push(m);
    lastEnd = m.index + m.length;
  }
  return kept;
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
      partyMap.set(`\u27E6PARTY_${PARTY_LABELS[i]}\u27E7`, name);
    }
  });

  let scrubbed = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.partyIndex >= PARTY_LABELS.length) continue;
    const token = `\u27E6PARTY_${PARTY_LABELS[m.partyIndex]}\u27E7`;
    const replacement = token + m.suffix;
    scrubbed = scrubbed.slice(0, m.index) + replacement + scrubbed.slice(m.index + m.length);
  }
  return { scrubbed, partyMap };
}
