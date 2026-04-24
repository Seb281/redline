/**
 * Tests for the SP-10 Arc 3 Task 3.3 library-query builder.
 *
 * The builder reduces a full contract to a compact string that can be
 * embedded by mistral-embed. The pieces under test are:
 *   - the three-part shape (contract type, key terms, top-risk titles),
 *   - risk-tier ordering when selecting clauses for the top-risk slice,
 *   - graceful fallback when the overview is empty.
 */

import { describe, it, expect } from "vitest";
import {
  buildLibraryQueryText,
  formatLibrarySimilarityPercent,
  LIBRARY_QUERY_TOP_RISK_COUNT,
} from "./similar-contracts";
import type { AnalyzedClause, ContractOverview } from "@/types";

function overview(
  partial: Partial<ContractOverview> = {},
): ContractOverview {
  return {
    contract_type: "SaaS Agreement",
    parties: [],
    key_terms: [],
    clause_inventory: [],
    ...partial,
  };
}

function clause(
  partial: Partial<AnalyzedClause>,
): AnalyzedClause {
  return {
    clause_text: "t",
    category: "other",
    title: "Untitled",
    plain_english: "",
    risk_level: "informational",
    risk_explanation: "",
    ...partial,
  } as AnalyzedClause;
}

describe("buildLibraryQueryText", () => {
  it("joins contract type, key terms, and top-risk titles with period separators", () => {
    const text = buildLibraryQueryText(
      overview({
        contract_type: "Lease",
        key_terms: ["12 months", "Amsterdam"],
      }),
      [
        clause({ title: "Termination", risk_level: "high" }),
        clause({ title: "Liability", risk_level: "medium" }),
      ],
    );

    expect(text).toBe(
      "Lease. 12 months, Amsterdam. Termination, Liability",
    );
  });

  it("picks the highest-risk clauses first when slicing to the top-risk count", () => {
    const text = buildLibraryQueryText(
      overview({ contract_type: "DPA", key_terms: [] }),
      [
        clause({ title: "Low-1", risk_level: "low" }),
        clause({ title: "Low-2", risk_level: "low" }),
        clause({ title: "High-1", risk_level: "high" }),
        clause({ title: "Med-1", risk_level: "medium" }),
        clause({ title: "High-2", risk_level: "high" }),
      ],
    );

    // Top 3 by risk should be both "high" entries then the medium one.
    expect(text).toBe("DPA. High-1, High-2, Med-1");
    // Sanity: we never include more than the declared slice.
    const titlesSegment = text.split(". ").pop() ?? "";
    expect(titlesSegment.split(", ").length).toBeLessThanOrEqual(
      LIBRARY_QUERY_TOP_RISK_COUNT,
    );
  });

  it("returns an empty string when overview carries no usable signal", () => {
    const text = buildLibraryQueryText(
      overview({ contract_type: "", key_terms: [] }),
      [],
    );
    expect(text).toBe("");
  });

  it("tolerates whitespace-only contract_type and trims key terms", () => {
    const text = buildLibraryQueryText(
      overview({ contract_type: "  ", key_terms: [" term-a ", ""] }),
      [],
    );
    expect(text).toBe("term-a");
  });
});

describe("formatLibrarySimilarityPercent", () => {
  it("rounds and clamps the cosine similarity into [0,100]", () => {
    expect(formatLibrarySimilarityPercent(0.876)).toBe(88);
    expect(formatLibrarySimilarityPercent(1.5)).toBe(100);
    expect(formatLibrarySimilarityPercent(-0.2)).toBe(0);
  });
});
