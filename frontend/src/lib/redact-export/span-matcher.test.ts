/**
 * Unit tests for `findMatches`. Spans are hand-constructed (not
 * extracted from a real PDF) so edge cases — token crossing two
 * spans, page boundary, zero-span fallback — can be expressed
 * compactly and deterministically.
 */

import { describe, expect, it } from "vitest";
import { findMatches } from "./span-matcher";
import type { PdfSpan, TokenRange } from "./types";

function span(
  charStart: number,
  charEnd: number,
  page = 1,
  x = 0,
  y = 0,
  w = 100,
  h = 12,
  text?: string,
): PdfSpan {
  return {
    page,
    x,
    y,
    w,
    h,
    charStart,
    charEnd,
    text: text ?? "x".repeat(charEnd - charStart),
  };
}

function token(
  start: number,
  end: number,
  label = "[X]",
  kind: TokenRange["kind"] = "EMAIL",
  original = "orig",
): TokenRange {
  return { start, end, label, kind, original };
}

describe("findMatches", () => {
  it("matches a token fully contained in one span", () => {
    const spans = [span(0, 10, 1, 100, 700, 80, 12, "hello@test")];
    const tokens = [token(0, 10, "[Email 1]")];
    const out = findMatches(tokens, spans);
    expect(out.matches).toHaveLength(1);
    expect(out.matches[0]).toMatchObject({
      page: 1,
      x: 100,
      y: 700,
      w: 80,
      h: 12,
      label: "[Email 1]",
    });
    expect(out.skipped).toHaveLength(0);
  });

  it("emits one match per span when a token crosses two spans", () => {
    const spans = [
      span(0, 5, 1, 100, 700, 50, 12, "Hello"),
      span(5, 10, 1, 150, 700, 50, 12, "World"),
    ];
    const tokens = [token(0, 10, "[HelloWorld]")];
    const out = findMatches(tokens, spans);
    expect(out.matches).toHaveLength(2);
    expect(out.matches[0].x).toBe(100);
    expect(out.matches[1].x).toBe(150);
  });

  it("produces matches on both pages when a token straddles a page break", () => {
    const spans = [
      span(0, 5, 1, 100, 700, 50, 12, "foo"),
      span(5, 10, 2, 200, 750, 50, 12, "bar"),
    ];
    const tokens = [token(0, 10, "[span]")];
    const out = findMatches(tokens, spans);
    expect(out.matches.map((m) => m.page).sort()).toEqual([1, 2]);
  });

  it("records a SkippedMatch when no span covers the token range", () => {
    const spans = [span(0, 5, 1)];
    const tokens = [token(20, 30, "[Ghost]", "PERSON", "Jane Doe")];
    const out = findMatches(tokens, spans);
    expect(out.matches).toHaveLength(0);
    expect(out.skipped).toEqual([
      { label: "[Ghost]", kind: "PERSON", original: "Jane Doe" },
    ]);
  });

  // Privacy-critical: the skipped-match banner + download gating logic
  // in `useRedactExport` keys off `SkippedMatch.kind` belonging to
  // `SENSITIVE_KINDS`. Pin each sensitive kind explicitly so a
  // refactor that accidentally drops one kind trips this test.
  it("preserves the sensitive kind tag (PERSON) on a skipped match", () => {
    const spans = [span(0, 5, 1)];
    const tokens = [token(20, 30, "[Person 1]", "PERSON", "Jane Doe")];
    const out = findMatches(tokens, spans);
    expect(out.skipped).toEqual([
      { label: "[Person 1]", kind: "PERSON", original: "Jane Doe" },
    ]);
  });

  it("preserves the sensitive kind tag (ORG) on a skipped match", () => {
    const spans = [span(0, 5, 1)];
    const tokens = [token(20, 30, "[Provider]", "ORG", "Acme BV")];
    const out = findMatches(tokens, spans);
    expect(out.skipped).toEqual([
      { label: "[Provider]", kind: "ORG", original: "Acme BV" },
    ]);
  });

  it("preserves the sensitive kind tag (EMAIL) on a skipped match", () => {
    const spans = [span(0, 5, 1)];
    const tokens = [token(20, 30, "[Email 1]", "EMAIL", "hello@acme.test")];
    const out = findMatches(tokens, spans);
    expect(out.skipped).toEqual([
      { label: "[Email 1]", kind: "EMAIL", original: "hello@acme.test" },
    ]);
  });

  it("preserves the sensitive kind tag (IBAN) on a skipped match", () => {
    const spans = [span(0, 5, 1)];
    const tokens = [
      token(20, 30, "[Iban 1]", "IBAN", "DE89370400440532013000"),
    ];
    const out = findMatches(tokens, spans);
    expect(out.skipped).toEqual([
      { label: "[Iban 1]", kind: "IBAN", original: "DE89370400440532013000" },
    ]);
  });

  it("clips intersection widths proportionally", () => {
    const spans = [span(0, 10, 1, 100, 700, 100, 12, "abcdefghij")];
    const tokens = [token(2, 5, "[clip]")];
    const out = findMatches(tokens, spans);
    expect(out.matches).toHaveLength(1);
    // 30% of the 100pt span, starting 20% in.
    expect(out.matches[0].x).toBeCloseTo(120);
    expect(out.matches[0].w).toBeCloseTo(30);
  });
});
