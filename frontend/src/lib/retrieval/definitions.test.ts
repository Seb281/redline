/**
 * SP-10 Arc 2 Task 2.2b — defined-term resolver + depth-1 expansion.
 *
 * Contracts frequently hinge on capitalised defined terms ("the
 * Services", "Confidential Information") introduced in a dedicated
 * definitions clause. A question like "what counts as confidential
 * information?" wants the *definition* clause, not the breach clause
 * that merely cites the term. This module builds a term→clause map
 * and exposes a helper that pulls every defining clause referenced by
 * the current retrieval set.
 *
 * Conservative resolution — only matches terms introduced via one of
 * the canonical patterns (`"Term" means …`, `the "Term"`,
 * `(the "Term")`). No casual capitalisation heuristics (would match
 * "Provider", "Services", every proper noun — too noisy).
 */

import { describe, it, expect } from "vitest";
import type { AnalyzedClause } from "@/types";
import {
  buildDefinitionsMap,
  expandWithDefinitions,
} from "./definitions";

function clause(
  partial: Partial<AnalyzedClause> & { clause_text: string },
): AnalyzedClause {
  return {
    category: "other",
    title: "",
    plain_english: "",
    risk_level: "low",
    risk_explanation: "",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    applicable_law: null,
    citations: [],
    cross_refs: [],
    ...partial,
  };
}

describe("buildDefinitionsMap", () => {
  it("extracts a term introduced via quote-plus-means", () => {
    const clauses = [
      clause({
        title: "Definitions",
        clause_text:
          '"Confidential Information" means any non-public data disclosed by one party to the other.',
      }),
    ];
    const defs = buildDefinitionsMap(clauses);
    expect(defs.get("Confidential Information")).toBe(0);
  });

  it("extracts a term introduced via parenthetical (the \"Term\")", () => {
    const clauses = [
      clause({
        title: "Parties",
        clause_text:
          'ACME Industries GmbH (the "Provider") agrees to deliver Services.',
      }),
    ];
    const defs = buildDefinitionsMap(clauses);
    expect(defs.get("Provider")).toBe(0);
  });

  it("is case-sensitive on matching (defined terms are capitalised)", () => {
    const clauses = [
      clause({
        clause_text:
          '"Services" means the deliverables listed in Schedule A.',
      }),
    ];
    const defs = buildDefinitionsMap(clauses);
    expect(defs.has("Services")).toBe(true);
    expect(defs.has("services")).toBe(false);
  });

  it("does not double-register the same term across multiple clauses", () => {
    // Real contracts sometimes redefine a term informally — the first
    // authoritative definition wins. Later "definitions" are ignored.
    const clauses = [
      clause({
        clause_text:
          '"Term" means the duration of this agreement starting on the Effective Date.',
      }),
      clause({
        clause_text: '"Term" means something else entirely.',
      }),
    ];
    const defs = buildDefinitionsMap(clauses);
    expect(defs.get("Term")).toBe(0);
  });

  it("returns an empty map when no clause introduces a term", () => {
    const defs = buildDefinitionsMap([
      clause({ clause_text: "Plain prose with no defined terms here." }),
    ]);
    expect(defs.size).toBe(0);
  });
});

describe("expandWithDefinitions", () => {
  const clauses = [
    clause({
      title: "Definitions",
      clause_text:
        '"Confidential Information" means any non-public data. "Services" means the deliverables.',
    }),
    clause({
      title: "Confidentiality",
      clause_text:
        "Each party shall protect Confidential Information for five years post-termination.",
    }),
    clause({
      title: "Payment",
      clause_text: "Net 30 days from invoice.",
    }),
  ];

  it("adds the definition clause when a retrieved clause uses a defined term", () => {
    const retrieved = new Set([1]);
    const expanded = expandWithDefinitions(retrieved, clauses);
    expect(expanded).toEqual(new Set([0]));
  });

  it("does not re-add clauses already in the retrieved set", () => {
    const retrieved = new Set([0, 1]);
    const expanded = expandWithDefinitions(retrieved, clauses);
    expect(expanded.has(0)).toBe(false);
    expect(expanded.has(1)).toBe(false);
  });

  it("returns an empty set when no retrieved clause cites a defined term", () => {
    const retrieved = new Set([2]);
    const expanded = expandWithDefinitions(retrieved, clauses);
    expect(expanded.size).toBe(0);
  });

  it("unions defining clauses across multiple retrieved clauses", () => {
    const extraClauses = [
      ...clauses,
      clause({
        title: "Delivery",
        clause_text: "Provider shall deliver the Services as per schedule.",
      }),
    ];
    const retrieved = new Set([1, 3]);
    const expanded = expandWithDefinitions(retrieved, extraClauses);
    expect(expanded).toEqual(new Set([0]));
  });
});
