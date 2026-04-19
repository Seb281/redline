/**
 * Tests for `tokenizeForPdf` and the internal `collectPatternRanges`.
 *
 * `tokenizeForPdf`'s overview fetch is stubbed via `vi.fn()` on
 * `globalThis.fetch`. Tests never touch the network, and the
 * SmartOverviewError failure path is exercised by returning a non-2xx.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectPatternRanges,
  tokenizeForPdf,
} from "./tokenize-for-pdf";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("collectPatternRanges", () => {
  it("returns pattern matches with per-kind counter labels", () => {
    const text = "Email hello@test.com and pay IBAN DE89370400440532013000 now.";
    const out = collectPatternRanges(text);
    const emails = out.filter((r) => r.kind === "EMAIL");
    const ibans = out.filter((r) => r.kind === "IBAN");
    expect(emails).toHaveLength(1);
    expect(ibans).toHaveLength(1);
    expect(emails[0].label).toBe("[Email 1]");
    expect(ibans[0].label).toBe("[Iban 1]");
  });

  it("sorts output by start ascending", () => {
    const text = "first a@b.co then DE89370400440532013000";
    const out = collectPatternRanges(text);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].start).toBeGreaterThanOrEqual(out[i - 1].start);
    }
  });
});

describe("tokenizeForPdf", () => {
  it("merges pattern + party ranges with party winning on overlap", async () => {
    const text = "Acme BV is the provider. Contact a@b.co for support.";
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          overview: {
            parties: [{ name: "Acme BV", role_label: "Provider" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const out = await tokenizeForPdf(text);
    const party = out.ranges.find((t) => t.label === "[Provider]");
    expect(party).toBeDefined();
    expect(party?.kind).toBe("ORG");
    const email = out.ranges.find((t) => t.kind === "EMAIL");
    expect(email).toBeDefined();
    // Output stays sorted by start.
    for (let i = 1; i < out.ranges.length; i++) {
      expect(out.ranges[i].start).toBeGreaterThanOrEqual(
        out.ranges[i - 1].start,
      );
    }
    // No party was missing — nothing in the skipped bucket.
    expect(out.skipped).toEqual([]);
  });

  it("case-insensitive party match — Pass 0 'Acme BV' vs PDF 'ACME BV'", async () => {
    // Previously the ad-hoc regex was case-sensitive so this produced
    // zero matches and left the name visible in the output PDF with
    // no SkippedMatch emitted. Fix #4 reuses `findPartyMatches` so
    // casing differences succeed.
    const text = "ACME BV entered into this agreement on 1 January.";
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          overview: {
            parties: [{ name: "Acme BV", role_label: "Provider" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const out = await tokenizeForPdf(text);
    const party = out.ranges.find((t) => t.label === "[Provider]");
    expect(party).toBeDefined();
    expect(party?.original).toBe("Acme BV");
    expect(out.skipped).toEqual([]);
  });

  it("emits a SkippedMatch for a Pass 0 party that never appears in fullText", async () => {
    // The party name Pass 0 returned does not occur anywhere in the
    // PDF text. Before Fix #4 this vanished silently — now it lands
    // in `skipped` so the hook's banner trips on a sensitive kind.
    const text = "This agreement contains no party name matching the input.";
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          overview: {
            parties: [
              { name: "Ghost Ltd", role_label: "Counterparty" },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const out = await tokenizeForPdf(text);
    expect(out.ranges.find((t) => t.label === "[Counterparty]")).toBeUndefined();
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0]).toMatchObject({
      kind: "ORG",
      original: "Ghost Ltd",
      label: "[Counterparty]",
    });
  });

  it("throws SmartOverviewError on non-2xx response", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("down", { status: 500 }),
    ) as typeof fetch;
    await expect(tokenizeForPdf("any")).rejects.toMatchObject({
      name: "SmartOverviewError",
    });
  });

  it("throws SmartOverviewError on network failure", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(tokenizeForPdf("any")).rejects.toMatchObject({
      name: "SmartOverviewError",
    });
  });

  it("redacts unprefixed phone numbers via the LLM entity layer", async () => {
    // "644805783" slips past the PHONE regex (which requires a +prefix).
    // Pass 0 emits it as a PHONE entity and tokenizeForPdf must pick
    // it up as a sensitive TokenRange so the overlay paints over it.
    const text = "Support line 644805783 is open 9-18.";
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          overview: {
            parties: [],
            pii_entities: [{ kind: "PHONE", text: "644805783" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const out = await tokenizeForPdf(text);
    const phone = out.ranges.find((r) => r.kind === "PHONE");
    expect(phone).toBeDefined();
    expect(phone?.original).toBe("644805783");
    expect(phone?.label).toBe("[Phone 1]");
  });

  it("maps ADDRESS entities to the TokenKind of the same name", async () => {
    const text = "Registered office at Hauptstraße 12, 10115 Berlin.";
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          overview: {
            parties: [],
            pii_entities: [
              { kind: "ADDRESS", text: "Hauptstraße 12, 10115 Berlin" },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const out = await tokenizeForPdf(text);
    const address = out.ranges.find((r) => r.kind === "ADDRESS");
    expect(address).toBeDefined();
    expect(address?.original).toBe("Hauptstraße 12, 10115 Berlin");
  });

  it("drops entity matches that overlap a pattern hit", async () => {
    // Both the regex and the LLM flag the email — only the pattern
    // range should survive, so the tokenMap has exactly one email
    // entry and the overlay paints one rectangle, not two overlapping.
    const text = "Contact dpo@example.eu for support.";
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          overview: {
            parties: [],
            pii_entities: [{ kind: "EMAIL", text: "dpo@example.eu" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const out = await tokenizeForPdf(text);
    const emails = out.ranges.filter((r) => r.kind === "EMAIL");
    expect(emails).toHaveLength(1);
    // Pattern ranges carry labels of the form "[Email 1]" while entity
    // ranges also start numbering from 1 for their own kind — checking
    // the count is the unambiguous assertion here.
  });

  it("tolerates overviews that omit pii_entities (legacy shape)", async () => {
    const text = "Classic Pass 0 response without pii_entities.";
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ overview: { parties: [] } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const out = await tokenizeForPdf(text);
    expect(out.ranges).toEqual([]);
    expect(out.skipped).toEqual([]);
  });
});
