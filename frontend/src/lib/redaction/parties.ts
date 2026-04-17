/**
 * Party-name redaction (SP-1.9).
 *
 * Given the parties extracted by Pass 0 AND the pre-computed role-label
 * tokens for each (from heuristicLabels + user edits + normalizeLabel +
 * disambiguateLabels), replaces literal occurrences in the contract
 * text with `⟦LABEL⟧` tokens before sending to Pass 1 / Pass 2 / chat.
 *
 * Handles:
 *   - case-insensitive matching ("ACME Corp" == "acme corp")
 *   - whitespace normalization (collapse runs)
 *   - possessives ("ACME Corp's" → "⟦PROVIDER⟧'s"), including curly `'`,
 *     preserved verbatim so round-trip restores the original character
 *   - overlapping / duplicate party entries: longest match at each span
 *     wins; subsequent overlapping matches are dropped to avoid splice
 *     corruption during reverse replacement
 *
 * Does NOT handle (intentionally — leak risk acknowledged in spec):
 *   - synonyms / abbreviations not present in the parties list
 *   - defined-term shorthand ("the Company", "the Tenant") when it does
 *     not appear as the label itself — out of scope for SP-1.9, tracked
 *     as a follow-up
 */

export interface PartyMatch {
  text: string;
  index: number;
  length: number;
  partyIndex: number;
  possessive: boolean;
  /** Verbatim possessive suffix from the source text ("'s", "\u2019s", "s'", ""). */
  suffix: string;
}

/** Input shape for replaceParties: party name + its pre-computed token label. */
export interface LabeledParty {
  name: string;
  label: string;
}

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

export function findPartyMatches(text: string, parties: LabeledParty[]): PartyMatch[] {
  const raw: PartyMatch[] = [];
  parties.forEach((p, partyIndex) => {
    if (!p.name || !p.name.trim()) return;
    const re = nameRegex(p.name);
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

/**
 * Replace each party name occurrence with its role-label token.
 * Skips parties with empty labels (caller's decision — UI blocks this,
 * but the core must not corrupt the scrubbed string with `⟦⟧`).
 */
export function replaceParties(text: string, parties: LabeledParty[]): PartiesReplacement {
  const cleaned: LabeledParty[] = parties.filter(
    (p) => p && p.name && p.name.trim() && p.label && p.label.length > 0,
  );
  const matches = findPartyMatches(text, cleaned);
  const matchedIndexes = new Set(matches.map((m) => m.partyIndex));
  const partyMap = new Map<string, string>();
  cleaned.forEach((p, i) => {
    if (matchedIndexes.has(i)) {
      partyMap.set(`\u27E6${p.label}\u27E7`, p.name);
    }
  });

  let scrubbed = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const p = cleaned[m.partyIndex];
    const token = `\u27E6${p.label}\u27E7`;
    const replacement = token + m.suffix;
    scrubbed = scrubbed.slice(0, m.index) + replacement + scrubbed.slice(m.index + m.length);
  }
  return { scrubbed, partyMap };
}
