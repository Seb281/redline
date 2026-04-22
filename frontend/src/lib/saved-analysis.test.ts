/**
 * SP-10 Arc 1 Phase 5 — `hydrateSavedAnalysis` tests.
 *
 * Locks the `/history/[id]` hydration contract so saved embeddings
 * survive the round-trip onto the `AnalyzeResponse` that the chat
 * panel consumes. A regression here would silently drop the vector
 * branch on every saved analysis and leave retrieval BM25-only
 * without any user-visible signal.
 */

import { describe, it, expect } from "vitest";
import type {
  ClauseEmbedding,
  ContractOverview,
  AnalysisSummary,
  AnalyzedClause,
  AnalysisProvenance,
  SavedAnalysis,
} from "@/types";
import { MISTRAL_EMBED_DIM } from "@/types";
import { hydrateSavedAnalysis } from "./saved-analysis";

const overview: ContractOverview = {
  contract_type: "SaaS",
  parties: [
    { name: "Alice Corp", role_label: null },
    { name: "Bob LLC", role_label: null },
  ],
  effective_date: null,
  duration: null,
  total_value: null,
  governing_jurisdiction: null,
  jurisdiction_evidence: null,
  key_terms: [],
  clause_inventory: [],
};

const summary: AnalysisSummary = {
  total_clauses: 1,
  risk_breakdown: { high: 0, medium: 0, low: 1, informational: 0 },
  top_risks: [],
};

const clauses: AnalyzedClause[] = [
  {
    clause_text: "Lorem ipsum",
    category: "other",
    title: "Sample",
    plain_english: "p",
    risk_level: "low",
    risk_explanation: "r",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    applicable_law: null,
    citations: [],
  },
];

const provenance: AnalysisProvenance = {
  provider: "mistral",
  model: "mistral-small-4",
  snapshot: "mistral-small-2603",
  region: "eu-west-paris",
  reasoning_effort_per_pass: {
    overview: "low",
    extraction: "medium",
    risk: "high",
    think_hard: "high",
  },
  prompt_template_version: "1.1",
  timestamp: "2026-04-22T00:00:00.000Z",
};

function zeroVec(): number[] {
  return new Array(MISTRAL_EMBED_DIM).fill(0);
}

function baseSaved(
  overrides: Partial<SavedAnalysis> = {},
): SavedAnalysis {
  return {
    id: "analysis-1",
    filename: "contract.pdf",
    file_type: "pdf",
    page_count: 3,
    char_count: 8000,
    contract_text: "...",
    overview,
    summary,
    clauses,
    analysis_mode: "fast",
    created_at: "2026-04-22T00:00:00.000Z",
    updated_at: null,
    provenance,
    ...overrides,
  };
}

describe("hydrateSavedAnalysis", () => {
  it("forwards clause_embeddings when present so chat can run the vector branch", () => {
    const embeddings: ClauseEmbedding[] = [
      { clause_index: 0, embedding: zeroVec() },
    ];
    const saved = baseSaved({ clause_embeddings: embeddings });

    const hydrated = hydrateSavedAnalysis(saved);
    expect(hydrated.clause_embeddings).toBe(embeddings);
  });

  it("omits clause_embeddings entirely when the saved row has none", () => {
    const saved = baseSaved({ clause_embeddings: null });
    const hydrated = hydrateSavedAnalysis(saved);
    expect("clause_embeddings" in hydrated).toBe(false);
  });

  it("omits clause_embeddings on pre-SP-10 rows where the key is missing", () => {
    // Simulate the older shape where the backend never attached the key.
    const { clause_embeddings: _drop, ...legacy } = baseSaved();
    void _drop;
    const hydrated = hydrateSavedAnalysis(legacy as SavedAnalysis);
    expect("clause_embeddings" in hydrated).toBe(false);
  });

  it("omits clause_embeddings when the saved row has an empty array", () => {
    // Empty array means "we recorded nothing useful"; the chat route
    // should degrade to BM25-only rather than chasing a dead branch.
    const saved = baseSaved({ clause_embeddings: [] });
    const hydrated = hydrateSavedAnalysis(saved);
    expect("clause_embeddings" in hydrated).toBe(false);
  });

  it("uses the stored provenance when it is present and non-empty", () => {
    const saved = baseSaved();
    const hydrated = hydrateSavedAnalysis(saved);
    expect(hydrated.provenance).toBe(provenance);
  });

  it("falls back to legacyProvenance() on the pre-Phase-5 empty-object sentinel", () => {
    // The SP-1 Phase 5 backfill wrote `{}` into the column for legacy
    // rows. Those must not masquerade as real provenance.
    const saved = baseSaved({
      provenance: {} as unknown as AnalysisProvenance,
    });
    const hydrated = hydrateSavedAnalysis(saved);
    expect(hydrated.provenance.provider).toBe("legacy-pre-phase5");
  });

  it("passes overview, summary, and clauses through by reference", () => {
    const saved = baseSaved();
    const hydrated = hydrateSavedAnalysis(saved);
    expect(hydrated.overview).toBe(overview);
    expect(hydrated.summary).toBe(summary);
    expect(hydrated.clauses).toBe(clauses);
  });
});
