/**
 * Token extraction for the SP-3 PDF redaction pipeline.
 *
 * Single entry point: `tokenizeForPdf(fullText, apiBaseUrl)` runs the
 * pattern scrubber, then calls Pass 0 for party role labels, and merges
 * the two into `TokenRange[]` indexed into `fullText`. Only the
 * pattern-scrubbed text is sent to the server — raw PII never leaves
 * the browser.
 *
 * Pass 0 failure is a hard error (`SmartOverviewError`) — the hook
 * keeps the extracted PDF in memory so the user can retry without
 * re-uploading. There is no pattern-only fallback: the product promise
 * of `/redact` is semantic role labels, so a silent degrade would
 * contradict the user's expectation.
 */

import { collectPatternMatches, redactPatterns } from "@/lib/redaction";
import { findPartyMatches } from "@/lib/redaction/parties";
import type { SkippedMatch, TokenKind, TokenRange } from "./types";

/**
 * Suffixes that mark a multi-word name as a company rather than a
 * person. Covers the 6 SP-2 jurisdictions plus common US/UK forms.
 * Matched as a word at the end of the name; case-insensitive.
 */
const ORG_SUFFIXES = [
  "Ltd",
  "Ltd.",
  "Limited",
  "GmbH",
  "AG",
  "KG",
  "BV",
  "B.V.",
  "NV",
  "N.V.",
  "SL",
  "S.L.",
  "SA",
  "S.A.",
  "SAS",
  "S.A.S.",
  "Srl",
  "S.r.l.",
  "SpA",
  "S.p.A.",
  "Sp.z.o.o.",
  "Sp. z o.o.",
  "Inc",
  "Inc.",
  "LLC",
  "LLP",
  "PLC",
  "Corp",
  "Corp.",
];

/**
 * Map a PatternMatch kind (prefix used by `⟦KIND_N⟧` tokens) to the
 * richer `TokenKind` used by the SP-3 pipeline. Lossy on purpose:
 * VAT/FR_SSN/DE_TAX_ID all map to their closest PII class rather than
 * a bespoke kind because the skipped-match banner only cares about the
 * sensitivity bucket.
 */
function mapKind(patternKind: string): TokenKind {
  switch (patternKind) {
    case "EMAIL":
      return "EMAIL";
    case "PHONE":
      return "PHONE";
    case "IBAN":
      return "IBAN";
    case "VAT":
      return "ORG";
    case "FR_SSN":
    case "DE_TAX_ID":
    default:
      return "OTHER";
  }
}

/**
 * Render a human-readable label like `[Email 1]` / `[Iban 2]`. The
 * counter is per-kind so each kind numbers from 1 independently, which
 * makes the output PDF easier to scan than a monotonic global count.
 */
function renderLabel(kind: TokenKind, n: number): string {
  const pretty = kind.charAt(0) + kind.slice(1).toLowerCase();
  return `[${pretty} ${n}]`;
}

/**
 * Internal: pattern-only pass over `fullText`. Emits one `TokenRange`
 * per hit, sorted by `start` ascending so the span-matcher can
 * linear-scan without re-sorting. Exported only to the tests because
 * the public surface of this module is `tokenizeForPdf` — patterns
 * alone are not a user-facing product.
 */
export function collectPatternRanges(fullText: string): TokenRange[] {
  const hits = collectPatternMatches(fullText);
  const counters: Record<string, number> = {};
  const out: TokenRange[] = [];
  for (const hit of hits) {
    const kind = mapKind(hit.kind);
    counters[kind] = (counters[kind] ?? 0) + 1;
    out.push({
      start: hit.start,
      end: hit.end,
      original: hit.value,
      kind,
      label: renderLabel(kind, counters[kind]),
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Tokenize `fullText` for redaction: pattern pass + party role labels
 * from Pass 0.
 *
 * Only the pattern-scrubbed text is sent to the server — the real PII
 * never leaves the browser. If the overview call fails (network,
 * non-2xx, unexpected shape), throws with `.name === "SmartOverviewError"`
 * so the hook can surface a retry-in-place recoverable error.
 *
 * Merge rule: party ranges win over pattern ranges when they overlap.
 * Party ranges carry a semantic role label (e.g. "[Provider]") which
 * is strictly more informative than the generic "[Other 1]" that a
 * pattern fallback might have produced.
 *
 * Return shape: `{ ranges, skipped }`. Unmatched parties land in
 * `skipped` as synthetic `SkippedMatch` entries — without them, a
 * Pass 0 party whose exact casing / whitespace / possessive form
 * differs from the PDF text would leave the name visible in the
 * output with no SkippedMatch emitted and no download-gating banner.
 */
export async function tokenizeForPdf(
  fullText: string,
): Promise<{ ranges: TokenRange[]; skipped: SkippedMatch[] }> {
  const patternRanges = collectPatternRanges(fullText);
  const { scrubbed } = redactPatterns(fullText);

  let parties: Array<{ name: string; role_label?: string | null }>;
  try {
    // `/api/analyze/overview` is a Next.js App Router route served from the
    // same origin as this client bundle — always reachable via a relative
    // URL. Do NOT prefix with NEXT_PUBLIC_API_URL: that env var points at
    // the FastAPI backend (Railway), which has no such route and answers
    // 404. This was the bug that broke Smart mode in production.
    const res = await fetch("/api/analyze/overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: scrubbed }),
    });
    if (!res.ok) {
      throw new Error(`Overview HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      overview?: {
        parties?: Array<{ name?: string; role_label?: string | null }>;
      };
    };
    const raw = body?.overview?.parties ?? [];
    parties = raw
      .filter((p): p is { name: string; role_label?: string | null } =>
        typeof p?.name === "string" && p.name.trim().length > 0,
      )
      .map((p) => ({ name: p.name.trim(), role_label: p.role_label ?? null }));
  } catch (err) {
    const wrapped = new Error(
      err instanceof Error ? err.message : "Smart overview failed",
    );
    wrapped.name = "SmartOverviewError";
    throw wrapped;
  }

  const partyRanges: TokenRange[] = [];
  const skipped: SkippedMatch[] = [];

  // Reuse `findPartyMatches` so casing / whitespace / possessive
  // handling matches the SP-1.9 redaction pipeline exactly. The
  // ad-hoc regex used previously was case-sensitive and produced
  // zero matches for `"Acme BV"` vs `"ACME BV"`, leaving the name
  // visible with no SkippedMatch — the silent failure this fix closes.
  for (const party of parties) {
    // Skip unlabelled parties — the point of Smart mode is the role
    // label; an unlabelled hit is no better than the pattern
    // fallback would have been.
    if (!party.role_label || !party.role_label.trim()) continue;
    const kind = classifyPartyKind(party.name);
    const label = `[${party.role_label.trim()}]`;
    const hits = findPartyMatches(fullText, [
      { name: party.name, label: party.role_label.trim() },
    ]);
    if (hits.length === 0) {
      // Emit a synthetic SkippedMatch so the hook's skipped-match
      // banner trips — the user must consciously accept that a Pass 0
      // party name stayed visible before they can download.
      skipped.push({ label, kind, original: party.name });
      continue;
    }
    for (const hit of hits) {
      partyRanges.push({
        start: hit.index,
        // Cover only the name portion, not the possessive suffix
        // (the matcher returns `hit.length` including "'s"), so the
        // overlay matches the visible glyph box.
        end: hit.index + (hit.length - hit.suffix.length),
        original: party.name,
        kind,
        label,
      });
    }
  }

  return {
    ranges: mergeRanges(partyRanges, patternRanges),
    skipped,
  };
}

/**
 * Returns ORG when the name ends with a company suffix from
 * `ORG_SUFFIXES`, else PERSON. Deliberately simple — the parties list
 * already went through Pass 0's role-label heuristic, so we only need
 * a binary person/org bucket for the skipped-match banner.
 */
function classifyPartyKind(name: string): TokenKind {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  for (const suffix of ORG_SUFFIXES) {
    const s = suffix.toLowerCase();
    if (lower.endsWith(` ${s}`) || lower === s) return "ORG";
  }
  return "PERSON";
}

/**
 * Merge party + pattern ranges. Party ranges win on overlap because
 * they carry semantic labels; the pattern fallback is dropped. Output
 * is sorted by `start` for the span-matcher.
 */
function mergeRanges(
  partyRanges: TokenRange[],
  patternRanges: TokenRange[],
): TokenRange[] {
  // Build a fast overlap test against party ranges.
  const partySorted = [...partyRanges].sort((a, b) => a.start - b.start);
  const kept: TokenRange[] = [...partySorted];
  for (const pr of patternRanges) {
    const overlaps = partySorted.some(
      (p) => pr.start < p.end && pr.end > p.start,
    );
    if (!overlaps) kept.push(pr);
  }
  return kept.sort((a, b) => a.start - b.start);
}
