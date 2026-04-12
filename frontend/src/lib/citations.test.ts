import { describe, it, expect } from "vitest";
import { parseExplanation } from "./citations";

const clauseText =
  "Either party may terminate this agreement with thirty (30) days written notice. " +
  "The Landlord reserves the sole right to increase rent.";

describe("parseExplanation — happy path", () => {
  it("splits narrative around markers and verifies citations", () => {
    const segments = parseExplanation(
      "Either party can end the deal [^1], but the landlord alone controls rent [^2].",
      [
        { id: 1, quoted_text: "thirty (30) days written notice" },
        { id: 2, quoted_text: "sole right to increase rent" },
      ],
      clauseText,
    );

    expect(segments).toEqual([
      { kind: "text", value: "Either party can end the deal " },
      {
        kind: "cite",
        id: 1,
        quotedText: "thirty (30) days written notice",
        verified: true,
      },
      { kind: "text", value: ", but the landlord alone controls rent " },
      {
        kind: "cite",
        id: 2,
        quotedText: "sole right to increase rent",
        verified: true,
      },
      { kind: "text", value: "." },
    ]);
  });
});

describe("parseExplanation — missing / partial citations", () => {
  it("returns a single text segment when citations is undefined", () => {
    const segments = parseExplanation("Plain narrative.", undefined, clauseText);
    expect(segments).toEqual([{ kind: "text", value: "Plain narrative." }]);
  });

  it("returns a single text segment when citations is empty and no markers", () => {
    const segments = parseExplanation("Plain narrative.", [], clauseText);
    expect(segments).toEqual([{ kind: "text", value: "Plain narrative." }]);
  });

  it("renders orphan markers (no matching citation id) with quotedText null", () => {
    const segments = parseExplanation("Something happens [^5].", [], clauseText);
    expect(segments).toEqual([
      { kind: "text", value: "Something happens " },
      { kind: "cite", id: 5, quotedText: null, verified: false },
      { kind: "text", value: "." },
    ]);
  });

  it("appends standalone citations (no matching marker) at the end", () => {
    const segments = parseExplanation(
      "Narrative with no markers.",
      [{ id: 1, quoted_text: "thirty (30) days written notice" }],
      clauseText,
    );
    expect(segments).toEqual([
      { kind: "text", value: "Narrative with no markers." },
      {
        kind: "cite",
        id: 1,
        quotedText: "thirty (30) days written notice",
        verified: true,
      },
    ]);
  });
});

describe("parseExplanation — verification", () => {
  it("marks unverified when quote not in clause text", () => {
    const segments = parseExplanation(
      "Claim [^1].",
      [{ id: 1, quoted_text: "fabricated phrase that does not exist" }],
      clauseText,
    );
    expect(segments[1]).toEqual({
      kind: "cite",
      id: 1,
      quotedText: "fabricated phrase that does not exist",
      verified: false,
    });
  });

  it("normalizes whitespace when verifying", () => {
    const segments = parseExplanation(
      "Claim [^1].",
      [{ id: 1, quoted_text: "thirty (30)    days    written notice" }],
      clauseText,
    );
    expect(segments[1]).toMatchObject({ verified: true });
  });

  it("normalizes case when verifying", () => {
    const segments = parseExplanation(
      "Claim [^1].",
      [{ id: 1, quoted_text: "SOLE RIGHT TO INCREASE RENT" }],
      clauseText,
    );
    expect(segments[1]).toMatchObject({ verified: true });
  });

  it("normalizes smart quotes to ASCII when verifying", () => {
    const clauseWithSmartQuotes =
      "The Tenant shall provide \u201cwritten notice\u201d before vacating.";
    const segments = parseExplanation(
      "Claim [^1].",
      [{ id: 1, quoted_text: '"written notice"' }],
      clauseWithSmartQuotes,
    );
    expect(segments[1]).toMatchObject({ verified: true });
  });
});

describe("parseExplanation — robustness", () => {
  it("does not match literal square brackets that aren't markers", () => {
    const segments = parseExplanation("See figure [A] for details.", [], clauseText);
    expect(segments).toEqual([
      { kind: "text", value: "See figure [A] for details." },
    ]);
  });

  it("handles quoted_text containing regex metacharacters", () => {
    const clauseWithRegexChars =
      "Late fees equal 1.5% per month (or the maximum allowed by law).";
    const segments = parseExplanation(
      "Claim [^1].",
      [{ id: 1, quoted_text: "1.5% per month" }],
      clauseWithRegexChars,
    );
    expect(segments[1]).toMatchObject({ verified: true });
  });

  it("handles multiple markers in a row", () => {
    const segments = parseExplanation(
      "[^1][^2]",
      [
        { id: 1, quoted_text: "thirty (30) days written notice" },
        { id: 2, quoted_text: "sole right to increase rent" },
      ],
      clauseText,
    );
    expect(segments.filter((s) => s.kind === "cite")).toHaveLength(2);
  });
});

describe("parseExplanation — edge cases", () => {
  it("handles duplicate citation IDs (uses first occurrence)", () => {
    const segments = parseExplanation(
      "First [^1] and second [^1].",
      [{ id: 1, quoted_text: "thirty (30) days written notice" }],
      clauseText,
    );
    const cites = segments.filter((s) => s.kind === "cite");
    expect(cites).toHaveLength(2);
    expect(cites[0]).toMatchObject({ id: 1, verified: true });
    expect(cites[1]).toMatchObject({ id: 1, verified: true });
  });

  it("handles marker with very large ID number", () => {
    const segments = parseExplanation(
      "Claim [^999].",
      [{ id: 999, quoted_text: "thirty (30) days written notice" }],
      clauseText,
    );
    expect(segments[1]).toMatchObject({ kind: "cite", id: 999, verified: true });
  });

  it("handles narrative that is only a marker", () => {
    const segments = parseExplanation(
      "[^1]",
      [{ id: 1, quoted_text: "thirty (30) days written notice" }],
      clauseText,
    );
    expect(segments).toEqual([
      { kind: "cite", id: 1, quotedText: "thirty (30) days written notice", verified: true },
    ]);
  });

  it("handles empty narrative string", () => {
    const segments = parseExplanation("", [], clauseText);
    expect(segments).toEqual([]);
  });

  it("handles citation with empty quoted_text", () => {
    const segments = parseExplanation(
      "Claim [^1].",
      [{ id: 1, quoted_text: "" }],
      clauseText,
    );
    expect(segments[1]).toMatchObject({ kind: "cite", id: 1, quotedText: "" });
  });
});
