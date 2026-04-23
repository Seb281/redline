/**
 * SP-10 Arc 2 Task 2.2b — clause→clause graph build + depth-1 traversal.
 *
 * Pass 2 cross_refs are strings ("Section 4.2", "Schedule B",
 * "the Confidentiality Clause"). The graph layer resolves those strings
 * to clause indices so retrieval can widen a hit-set with the clauses
 * it *actually points at* — a clause that says "subject to Section 7"
 * is incomplete context for a chat question until Section 7 comes
 * along with it.
 *
 * Resolution is conservative: we only match a ref to a clause when the
 * canonical form of the ref appears inside the target clause's title
 * or in its section_reference-shaped prefix. No fuzzy matching —
 * retrieval precision matters more than recall here (wrong edges poison
 * the graph, missing edges just underfill context).
 */

import { describe, it, expect } from "vitest";
import type { AnalyzedClause } from "@/types";
import { buildCrossRefGraph, depthOneNeighbours } from "./cross-refs";

/** Minimal clause factory — retrieval graph only reads a few fields. */
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

describe("buildCrossRefGraph", () => {
  it("returns an empty graph when no clauses carry cross_refs", () => {
    const graph = buildCrossRefGraph([
      clause({ clause_text: "No references here." }),
      clause({ clause_text: "Still nothing." }),
    ]);
    expect(graph.size).toBe(0);
  });

  it("resolves numbered Section refs that appear in another clause's title", () => {
    const clauses = [
      clause({
        title: "Scope of Services",
        clause_text: "Provider shall deliver as per Section 4.2.",
        cross_refs: ["Section 4.2"],
      }),
      clause({
        title: "Section 4.2 — Service Levels",
        clause_text: "99.9% uptime SLA applies.",
      }),
    ];
    const graph = buildCrossRefGraph(clauses);
    expect(graph.get(0)).toEqual(new Set([1]));
  });

  it("does not include self-edges when a clause cites its own label", () => {
    const clauses = [
      clause({
        title: "Section 3 — Termination",
        clause_text: "Section 3 applies. See also Section 5.",
        cross_refs: ["Section 3", "Section 5"],
      }),
      clause({
        title: "Section 5 — Survival",
        clause_text: "Certain obligations persist.",
      }),
    ];
    const graph = buildCrossRefGraph(clauses);
    expect(graph.get(0)).toEqual(new Set([1]));
  });

  it("ignores cross_refs that cannot be resolved to any clause", () => {
    const clauses = [
      clause({
        title: "Scope",
        clause_text: "See Section 99.",
        cross_refs: ["Section 99"],
      }),
      clause({
        title: "Payment",
        clause_text: "Net 30.",
      }),
    ];
    const graph = buildCrossRefGraph(clauses);
    expect(graph.size).toBe(0);
  });

  it("is case-insensitive on section-label matching", () => {
    const clauses = [
      clause({
        title: "Scope",
        clause_text: "See section 4.",
        cross_refs: ["Section 4"],
      }),
      clause({
        title: "SECTION 4 — Deliverables",
        clause_text: "Deliverables listed here.",
      }),
    ];
    const graph = buildCrossRefGraph(clauses);
    expect(graph.get(0)).toEqual(new Set([1]));
  });

  it("multiple refs from one clause produce multiple edges", () => {
    const clauses = [
      clause({
        title: "Master Clause",
        clause_text: "Refer to Section 2 and Schedule A.",
        cross_refs: ["Section 2", "Schedule A"],
      }),
      clause({
        title: "Section 2 — Price",
        clause_text: "100 EUR per unit.",
      }),
      clause({
        title: "Schedule A — Deliverables",
        clause_text: "Items 1–3.",
      }),
    ];
    const graph = buildCrossRefGraph(clauses);
    expect(graph.get(0)).toEqual(new Set([1, 2]));
  });
});

describe("depthOneNeighbours", () => {
  // Reusable fixture — three clauses, 0 → {1}, 1 → {2}. Depth-1 from
  // {0} must return {1}, not {2}; transitive closure is out of scope.
  const clauses = [
    clause({
      title: "Scope",
      clause_text: "See Section 2.",
      cross_refs: ["Section 2"],
    }),
    clause({
      title: "Section 2 — Price",
      clause_text: "100 EUR. See Section 3.",
      cross_refs: ["Section 3"],
    }),
    clause({
      title: "Section 3 — Payment Timeline",
      clause_text: "Net 30.",
    }),
  ];
  const graph = buildCrossRefGraph(clauses);

  it("returns direct neighbours only, not transitive closure", () => {
    const seeds = new Set([0]);
    const neighbours = depthOneNeighbours(seeds, graph);
    expect(neighbours).toEqual(new Set([1]));
  });

  it("unions neighbours across multiple seeds, excluding the seeds themselves", () => {
    // Seed 0 → {1}; seed 1 → {2}. 1 is a seed so it's filtered out of
    // the result — only 2 survives. This matches the "no self-loops"
    // intuition: a retrieved-set widening should never re-include
    // already-retrieved clauses in the "neighbours" bucket.
    const seeds = new Set([0, 1]);
    const neighbours = depthOneNeighbours(seeds, graph);
    expect(neighbours).toEqual(new Set([2]));
  });

  it("excludes seeds themselves from the neighbour set", () => {
    const seeds = new Set([0, 1]);
    const neighbours = depthOneNeighbours(seeds, graph);
    expect(neighbours.has(0)).toBe(false);
    expect(neighbours.has(1)).toBe(false);
  });

  it("is an empty set when no seed has outbound edges", () => {
    const seeds = new Set([2]);
    const neighbours = depthOneNeighbours(seeds, graph);
    expect(neighbours.size).toBe(0);
  });
});
