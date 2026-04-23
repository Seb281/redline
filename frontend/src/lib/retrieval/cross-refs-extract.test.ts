/**
 * SP-10 Arc 2 Task 2.2 — regex extraction of outbound cross-references
 * from a clause's verbatim text.
 *
 * Deterministic safety net under the Pass 1 LLM tagger: every structural
 * reference the LLM might miss (Section 4.2, §307, Schedule B, Art 12)
 * is still surfaced so the graph traversal in Task 2.2b has a complete
 * edge set. Multilingual by design — contracts we eval on span NL/FR/DE/
 * ES/IT/PL, and each language has its own section-label vocabulary.
 */

import { describe, it, expect } from "vitest";
import { extractCrossRefsFromText, mergeCrossRefs } from "./cross-refs-extract";

describe("extractCrossRefsFromText", () => {
  it("returns an empty array on text with no references", () => {
    expect(
      extractCrossRefsFromText(
        "The Provider shall deliver the Services in accordance with industry practice.",
      ),
    ).toEqual([]);
  });

  it("finds English Section references at various depths", () => {
    const refs = extractCrossRefsFromText(
      "As set forth in Section 4.2, the Provider shall indemnify under Section 7.",
    );
    expect(refs).toEqual(expect.arrayContaining(["Section 4.2", "Section 7"]));
  });

  it("finds Clause, Article, and Paragraph references", () => {
    const refs = extractCrossRefsFromText(
      "See Clause 3.1 and Article 12. Paragraph 5 governs termination.",
    );
    expect(refs).toEqual(
      expect.arrayContaining(["Clause 3.1", "Article 12", "Paragraph 5"]),
    );
  });

  it("finds § (paragraph-sign) references common in DE/AT/CH contracts", () => {
    const refs = extractCrossRefsFromText(
      "Haftung gemäß §307 BGB. Weiter siehe § 276.",
    );
    // Both spellings captured; normalization (§307 vs § 307) is the graph
    // step's concern — here we preserve verbatim.
    expect(refs.length).toBeGreaterThanOrEqual(2);
    expect(refs.some((r) => /§\s*307/.test(r))).toBe(true);
    expect(refs.some((r) => /§\s*276/.test(r))).toBe(true);
  });

  it("finds Schedule / Annex / Appendix / Exhibit references", () => {
    const refs = extractCrossRefsFromText(
      "See Schedule A, Annex 2, Appendix C, and Exhibit D for pricing.",
    );
    expect(refs).toEqual(
      expect.arrayContaining([
        "Schedule A",
        "Annex 2",
        "Appendix C",
        "Exhibit D",
      ]),
    );
  });

  it("finds German / French / Spanish / Italian / Dutch / Polish article labels", () => {
    const refs = extractCrossRefsFromText(
      "Siehe Artikel 5. Voir Article 8. Véase Artículo 12. Vedi Articolo 3. Zie Artikel 4. Patrz Artykuł 9.",
    );
    // Each locale-specific label contributes at least one match.
    expect(refs.some((r) => /Artikel\s+5/.test(r))).toBe(true);
    expect(refs.some((r) => /Article\s+8/.test(r))).toBe(true);
    expect(refs.some((r) => /Artículo\s+12/.test(r))).toBe(true);
    expect(refs.some((r) => /Articolo\s+3/.test(r))).toBe(true);
    expect(refs.some((r) => /Artykuł\s+9/.test(r))).toBe(true);
  });

  it("deduplicates repeated references within a clause", () => {
    const refs = extractCrossRefsFromText(
      "As per Section 3, and again Section 3, and once more Section 3.",
    );
    expect(refs).toEqual(["Section 3"]);
  });

  it("is case-insensitive on the leading keyword", () => {
    const refs = extractCrossRefsFromText(
      "See section 4.2 and SECTION 5 and Section 6.",
    );
    // Case is normalised to the canonical capitalised form so graph
    // joins don't split on casing drift.
    expect(refs).toEqual(
      expect.arrayContaining(["Section 4.2", "Section 5", "Section 6"]),
    );
    // Three distinct refs, not nine.
    expect(refs).toHaveLength(3);
  });

  it("does not match bare numbers or unrelated tokens", () => {
    expect(
      extractCrossRefsFromText(
        "The fee is 4.2 EUR per hour; delivery within 3 business days.",
      ),
    ).toEqual([]);
  });

  it("returns a new array on every call (no shared mutable state)", () => {
    const text = "See Section 1.";
    const a = extractCrossRefsFromText(text);
    const b = extractCrossRefsFromText(text);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("mergeCrossRefs", () => {
  it("keeps LLM-emitted prose refs the regex cannot catch", () => {
    // "the Confidentiality Clause" is exactly the kind of prose ref the
    // regex skips by design — the merge must still carry it through.
    const merged = mergeCrossRefs(
      "Obligations under the Confidentiality Clause persist post-termination.",
      ["the Confidentiality Clause"],
    );
    expect(merged).toEqual(["the Confidentiality Clause"]);
  });

  it("supplements LLM output with regex-only structural matches", () => {
    const merged = mergeCrossRefs(
      "See Section 4.2 and the Confidentiality Clause.",
      ["the Confidentiality Clause"],
    );
    expect(merged).toEqual([
      "the Confidentiality Clause",
      "Section 4.2",
    ]);
  });

  it("deduplicates when LLM and regex emit the same reference", () => {
    const merged = mergeCrossRefs(
      "See Section 4.2.",
      ["Section 4.2"],
    );
    expect(merged).toEqual(["Section 4.2"]);
  });

  it("tolerates missing LLM output (undefined / null)", () => {
    const text = "See Section 1 and Schedule B.";
    expect(mergeCrossRefs(text, undefined)).toEqual(["Section 1", "Schedule B"]);
    expect(mergeCrossRefs(text, null)).toEqual(["Section 1", "Schedule B"]);
  });

  it("strips whitespace and drops empty strings from LLM output", () => {
    const merged = mergeCrossRefs("Standalone text.", [
      "  the Main Section  ",
      "",
      "   ",
    ]);
    expect(merged).toEqual(["the Main Section"]);
  });
});
