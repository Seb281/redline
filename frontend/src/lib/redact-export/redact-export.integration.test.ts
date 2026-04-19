/**
 * End-to-end integration on the in-memory single-page fixture:
 *
 *   buildSinglePagePdf → extractPdf → quickTokenize → findMatches
 *     → buildRedactedPdf → re-extract and verify labels appear.
 */

import { describe, expect, it } from "vitest";
import { extractPdf } from "./pdf-extract";
import { findMatches } from "./span-matcher";
import { buildRedactedPdf } from "./pdf-overlay";
import { quickTokenize } from "./tokenize-for-pdf";
import { buildSinglePagePdf } from "@/test-fixtures/redact/build-fixtures";

describe("redact-export pipeline (integration)", () => {
  it("runs extract → tokenize → match → overlay on a single-page PDF", async () => {
    const src = await buildSinglePagePdf({
      names: ["Acme BV"],
      emails: ["hello@acme.test"],
    });
    const extracted = await extractPdf(src);
    const tokens = quickTokenize(extracted.fullText);
    // Quick mode only recognises patterns: the email is in, the
    // company name ("Acme BV") is not — that is by design.
    expect(tokens.find((t) => t.kind === "EMAIL")).toBeDefined();

    const { matches, skipped } = findMatches(tokens, extracted.spans);
    expect(matches.length).toBeGreaterThan(0);
    // Sensitivity sanity: no email should have ended up in skipped.
    const skippedSensitive = skipped.filter((s) => s.kind === "EMAIL");
    expect(skippedSensitive).toHaveLength(0);

    const redactedBytes = await buildRedactedPdf(extracted.bytes, matches);
    expect(redactedBytes.byteLength).toBeGreaterThan(0);

    const copy = new ArrayBuffer(redactedBytes.byteLength);
    new Uint8Array(copy).set(redactedBytes);
    const reExtracted = await extractPdf(copy);
    expect(reExtracted.fullText).toContain("[Email");
  });
});
