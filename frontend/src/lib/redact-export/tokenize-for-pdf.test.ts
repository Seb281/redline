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
});
