/**
 * Token extraction for the SP-3 PDF redaction pipeline.
 *
 * Single entry point: `tokenizeForPdf(fullText)` runs the pattern
 * scrubber, calls Pass 0 for party role labels AND semantic PII
 * entities (addresses, unprefixed phones, national IDs, DOBs, etc.),
 * then merges all three into `TokenRange[]` indexed into `fullText`.
 * Only the pattern-scrubbed text is sent to the server — raw PII
 * already covered by the regex catalog never leaves the browser.
 *
 * Pass 0 failure is a hard error (`SmartOverviewError`) — the hook
 * keeps the extracted PDF in memory so the user can retry without
 * re-uploading. There is no pattern-only fallback: the product promise
 * of `/redact` is semantic redaction, so a silent degrade would
 * contradict the user's expectation.
 */

import { collectPatternMatches, redactPatterns } from "@/lib/redaction";
import { findPartyMatches } from "@/lib/redaction/parties";
import { resolveEntities, type PiiEntityInput } from "@/lib/redaction/entities";
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
 * richer `TokenKind` used by the SP-3 pipeline.
 *
 * FR_SSN and DE_TAX_ID are national identification numbers — surface
 * them under `ID_NUMBER` so the skipped-match banner treats them as
 * sensitive. VAT (public business register) stays in its own bucket.
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
      return "VAT";
    case "FR_SSN":
    case "DE_TAX_ID":
      return "ID_NUMBER";
    default:
      return "OTHER";
  }
}

/**
 * Map a Pass 0 `pii_entities.kind` value to a SP-3 `TokenKind`. The
 * string spaces overlap almost entirely (both are uppercase, both
 * speak the same vocabulary of PII kinds); the few mismatches fall
 * through to `OTHER` so an unrecognised future kind cannot leak an
 * entity through the type system.
 */
function mapEntityKind(entityKind: string): TokenKind {
  switch (entityKind) {
    case "PERSON":
    case "EMAIL":
    case "PHONE":
    case "IBAN":
    case "VAT":
    case "ADDRESS":
    case "POSTCODE":
    case "ID_NUMBER":
    case "DOB":
    case "BANK":
    case "COMPANY_REG":
    case "URL":
      return entityKind;
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
 * + LLM-sourced PII entities from Pass 0.
 *
 * Only the pattern-scrubbed text is sent to the server — the regex
 * catalog's matches (email/phone-with-prefix/IBAN/VAT/FR_SSN/DE_TAX_ID)
 * never leave the browser. Addresses, unprefixed phones, national IDs,
 * DOBs, etc. are visible to Pass 0 by necessity — the LLM cannot flag
 * what it cannot see, and those kinds have no reliable regex form
 * across 27 member states.
 *
 * If the overview call fails (network, non-2xx, unexpected shape),
 * throws with `.name === "SmartOverviewError"` so the hook can surface
 * a retry-in-place recoverable error.
 *
 * Precedence when ranges overlap: party > pattern > entity. Party
 * ranges carry the most informative label (role name). Pattern ranges
 * are deterministic and checksum-validated so they outrank the LLM
 * layer. Entity ranges fill the remaining gaps.
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
  let piiEntities: PiiEntityInput[] = [];
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
        pii_entities?: Array<{ kind?: string; text?: string }>;
      };
    };
    const raw = body?.overview?.parties ?? [];
    parties = raw
      .filter((p): p is { name: string; role_label?: string | null } =>
        typeof p?.name === "string" && p.name.trim().length > 0,
      )
      .map((p) => ({ name: p.name.trim(), role_label: p.role_label ?? null }));

    const rawEntities = body?.overview?.pii_entities ?? [];
    piiEntities = rawEntities
      .filter(
        (e): e is { kind: string; text: string } =>
          typeof e?.kind === "string" &&
          typeof e?.text === "string" &&
          e.text.trim().length > 0,
      )
      .map((e) => ({ kind: e.kind, text: e.text }));
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

  const entityRanges = collectEntityRanges(fullText, piiEntities);

  return {
    ranges: mergeAllRanges(partyRanges, patternRanges, entityRanges),
    skipped,
  };
}

/**
 * Build `TokenRange[]` from Pass 0 PII entities. Counters are per-kind
 * so each kind numbers independently (same UX as pattern ranges).
 *
 * Resolution is whitespace-tolerant (see `resolveEntities`) so a
 * multi-line postal address copied verbatim by the model still matches
 * a PDF where pdfjs inserted line breaks between glyph runs.
 */
function collectEntityRanges(
  fullText: string,
  entities: PiiEntityInput[],
): TokenRange[] {
  if (!entities.length) return [];
  const hits = resolveEntities(fullText, entities);
  const counters: Record<string, number> = {};
  const out: TokenRange[] = [];
  for (const hit of hits) {
    const kind = mapEntityKind(hit.kind);
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
 * Merge party + pattern + entity ranges in strict precedence order:
 * party > pattern > entity. Each layer contributes only the ranges
 * that do not overlap something already kept.
 *
 * - Party ranges win outright: they carry the richest semantic label
 *   (role name) and sit on text the user explicitly confirmed.
 * - Pattern ranges come next: deterministic, checksum-validated, never
 *   hallucinate. Where a pattern fires, we trust it over the LLM.
 * - Entity ranges fill the remaining gaps — addresses, unprefixed
 *   phones, national IDs, DOBs that no regex can express safely across
 *   27 member states.
 *
 * Output is sorted by `start` for the span-matcher.
 */
function mergeAllRanges(
  partyRanges: TokenRange[],
  patternRanges: TokenRange[],
  entityRanges: TokenRange[],
): TokenRange[] {
  const kept: TokenRange[] = [];
  const overlaps = (r: TokenRange) =>
    kept.some((k) => r.start < k.end && r.end > k.start);

  for (const r of [...partyRanges].sort((a, b) => a.start - b.start)) {
    if (!overlaps(r)) kept.push(r);
  }
  for (const r of [...patternRanges].sort((a, b) => a.start - b.start)) {
    if (!overlaps(r)) kept.push(r);
  }
  for (const r of [...entityRanges].sort((a, b) => a.start - b.start)) {
    if (!overlaps(r)) kept.push(r);
  }
  return kept.sort((a, b) => a.start - b.start);
}
