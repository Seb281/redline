/**
 * SP-10 Arc 3 Task 3.5 — frozen cross-contract golden question set.
 *
 * Intra-doc eval (``GOLDEN_QUESTIONS``) measures the chat retriever
 * operating inside a single analysis. This set measures the
 * cross-contract retriever used by ``/history`` semantic search + the
 * library-comparison panel + the similar-clauses drawer — the query is
 * deliberately under-specified about which contract the answer lives
 * in, forcing the retriever to pick across the user's entire library.
 *
 * Scope:
 *   - 24 questions (mix of **8 easy / 10 medium / 6 hard**) spanning
 *     all 6 Arc 1 fixtures. Easier skew than intra-doc — cross-doc
 *     retrieval has a harder denominator (83 clauses instead of 13-18)
 *     so "easy" questions here are closer to "medium" intra-doc.
 *   - ``expected`` uses ``{ fixture, clause_index }`` tuples because
 *     the merged candidate pool is keyed on both. Multi-hit entries
 *     (e.g. "find confidentiality across the library") score as a
 *     binary hit if *any* expected tuple appears in top-k — partial
 *     recall is a retrieval limitation surfaced in the baseline, not a
 *     graded metric (same rubric as intra-doc).
 *
 * Authorship. Claude Opus 4.7 (``claude-opus-4-7``), same generator as
 * the intra-doc set — different model family from the in-pipeline
 * Mistral so questions don't leak authorship bias into the numbers.
 * ``reviewed_by`` flips to the owner's initials after their review
 * pass; until then, any baseline row sourcing numbers from this set is
 * tagged ``pre-human-review`` in ``baseline.json`` and EVAL.md.
 *
 * DO NOT re-order entries without reviewing impact on EVAL.md — ``id``
 * is the stable handle the harness keys on and the baseline artifact
 * is keyed by ``id`` too.
 */

/** Difficulty tier. Same rubric as intra-doc but shifted harder across the board. */
export type CrossDocTier = "easy" | "medium" | "hard";

/** A single cross-contract expected hit (fixture slug + clause index). */
export interface CrossDocExpectation {
  fixture: string;
  clause_index: number;
}

/** One cross-doc golden entry. See intra-doc ``generate-golden-set.md`` for rationale. */
export interface CrossDocQuestion {
  id: string;
  question: string;
  expected: CrossDocExpectation[];
  tier: CrossDocTier;
  rationale: string;
  reviewed_by: string;
  reviewed_at: string;
}

const GENERATOR = "claude-opus-4-7";
const REVIEWED_AT = "2026-04-23";

/**
 * 24 cross-contract questions, frozen. Re-order or edit only when the
 * fixtures themselves change — clause-index drift invalidates every
 * ``expected`` tuple that points at a moved clause.
 */
export const CROSS_DOC_QUESTIONS: readonly CrossDocQuestion[] = [
  // ---------------------------------------------------------------
  // Easy tier — a single contract uniquely owns the topic, and the
  // query phrases the topic explicitly. Cross-doc "easy" still has to
  // beat the 83-clause denominator, so even these are non-trivial.
  // ---------------------------------------------------------------
  {
    id: "xd-e1",
    question: "Which of my contracts has a five-year non-compete clause?",
    expected: [{ fixture: "it-employment", clause_index: 9 }],
    tier: "easy",
    rationale: "Only it-employment has a five-year duration on non-compete — direct lexical + semantic match.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e2",
    question: "Which contract grants exclusive distribution rights to one party?",
    expected: [{ fixture: "pl-distribution", clause_index: 0 }],
    tier: "easy",
    rationale: "Distribution agreement is the only one that mentions exclusive distribution; unique lexical anchor.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e3",
    question: "Which contract uses binding arbitration as the dispute mechanism?",
    expected: [{ fixture: "nl-freelance", clause_index: 9 }],
    tier: "easy",
    rationale: "Only nl-freelance specifies binding arbitration; the others go to jurisdiction/dispute resolution differently.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e4",
    question: "Where in my library is a force majeure clause?",
    expected: [{ fixture: "nl-freelance", clause_index: 11 }],
    tier: "easy",
    rationale: "Only nl-freelance has an explicit force majeure clause in the frozen corpus.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e5",
    question: "Which contract regulates subprocessors for data processing?",
    expected: [{ fixture: "de-saas-dpa", clause_index: 12 }],
    tier: "easy",
    rationale: "Subprocessor authorization is DPA-specific; unique to de-saas-dpa in the corpus.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e6",
    question: "Which contract has a monthly sales reporting obligation?",
    expected: [{ fixture: "pl-distribution", clause_index: 7 }],
    tier: "easy",
    rationale: "Sales reporting is distribution-specific; unique to pl-distribution.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e7",
    question: "Where in my library is cross-border data transfer addressed?",
    expected: [{ fixture: "de-saas-dpa", clause_index: 13 }],
    tier: "easy",
    rationale: "Third-country data transfer safeguards live in the DPA; unique lexical anchor on 'third countries'.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e8",
    question: "Which contract has an annual purchase minimum commitment?",
    expected: [{ fixture: "pl-distribution", clause_index: 2 }],
    tier: "easy",
    rationale: "Annual purchase minimum is distribution-specific; unique to pl-distribution.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },

  // ---------------------------------------------------------------
  // Medium tier — more than one fixture plausibly matches, or the
  // query is phrased generally and the retriever has to pick the
  // right one based on semantics rather than a single unique keyword.
  // ---------------------------------------------------------------
  {
    id: "xd-m1",
    question: "Which contract lets the provider raise fees unilaterally?",
    expected: [{ fixture: "es-saas-services", clause_index: 3 }],
    tier: "medium",
    rationale: "Multiple contracts discuss payment terms; only es-saas-services has the one-sided fee adjustment.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m2",
    question: "Compare how my contracts handle intellectual property assignment.",
    expected: [
      { fixture: "nl-freelance", clause_index: 3 },
      { fixture: "fr-employment", clause_index: 7 },
      { fixture: "it-employment", clause_index: 6 },
    ],
    tier: "medium",
    rationale: "Three contracts have explicit IP assignment clauses; any one in top-5 counts as a hit.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m3",
    question: "Where do my contracts impose contractual penalties for breach?",
    expected: [
      { fixture: "pl-distribution", clause_index: 6 },
      { fixture: "it-employment", clause_index: 10 },
    ],
    tier: "medium",
    rationale: "Contractual penalty clauses live in civil-law jurisdictions (PL + IT); any in top-5 counts.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m4",
    question: "Where is confidentiality addressed across my library?",
    expected: [
      { fixture: "nl-freelance", clause_index: 4 },
      { fixture: "fr-employment", clause_index: 8 },
      { fixture: "de-saas-dpa", clause_index: 6 },
    ],
    tier: "medium",
    rationale: "Three contracts have explicit confidentiality clauses; broad lexical match, retriever must surface at least one.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m5",
    question: "Which of my contracts is governed by Polish law?",
    expected: [{ fixture: "pl-distribution", clause_index: 12 }],
    tier: "medium",
    rationale: "Governing-law clauses are lexically similar across fixtures; retriever must pick PL.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m6",
    question: "Which contracts grant a right to audit the other party?",
    expected: [
      { fixture: "es-saas-services", clause_index: 7 },
      { fixture: "de-saas-dpa", clause_index: 16 },
    ],
    tier: "medium",
    rationale: "Audit rights appear in two fixtures; any in top-5 counts.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m7",
    question: "Where do my contracts address data breach notification?",
    expected: [{ fixture: "de-saas-dpa", clause_index: 15 }],
    tier: "medium",
    rationale: "Breach notification is DPA-unique but the phrase 'breach' also hits general penalty/liability clauses; retriever must stay topical.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m8",
    question: "Find provisions about severance pay.",
    expected: [{ fixture: "fr-employment", clause_index: 10 }],
    tier: "medium",
    rationale: "FR employment uniquely mentions severance; IT employment's termination clause is adjacent but distinct.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m9",
    question: "Which contracts have a probationary period?",
    expected: [
      { fixture: "fr-employment", clause_index: 2 },
      { fixture: "it-employment", clause_index: 1 },
    ],
    tier: "medium",
    rationale: "Both employment contracts have probation; either in top-5 counts.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m10",
    question: "Where are service credits or SLA remedies discussed?",
    expected: [
      { fixture: "de-saas-dpa", clause_index: 3 },
      { fixture: "es-saas-services", clause_index: 4 },
    ],
    tier: "medium",
    rationale: "Two SaaS contracts cover SLA mechanics; retriever should prefer these over generic liability clauses.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },

  // ---------------------------------------------------------------
  // Hard tier — query is semantically nuanced (aggregation, comparison,
  // "most/broadest/longest") or lexically distant from the target
  // clause. These are the ones that separate a cosine-only retriever
  // from one that actually understands the corpus.
  // ---------------------------------------------------------------
  {
    id: "xd-h1",
    question: "Which contract places the broadest post-termination restrictions on the counterparty?",
    expected: [
      { fixture: "it-employment", clause_index: 9 },
      { fixture: "nl-freelance", clause_index: 5 },
    ],
    tier: "hard",
    rationale: "Aggregation query — requires reasoning about non-compete scope + duration; lexically distant.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-h2",
    question: "Which contract has an unusually one-sided indemnification obligation?",
    expected: [{ fixture: "nl-freelance", clause_index: 6 }],
    tier: "hard",
    rationale: "Target clause's title includes 'one-sided' but most retrievers latch on 'indemnification' which is fixture-rare; good semantic test.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-h3",
    question: "Which contract waives the counterparty's right to compensation on termination?",
    expected: [
      { fixture: "pl-distribution", clause_index: 9 },
      { fixture: "pl-distribution", clause_index: 10 },
    ],
    tier: "hard",
    rationale: "Two pl-distribution clauses combine — no-compensation + waiver. Lexically lean; easy to be fooled by generic termination clauses.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-h4",
    question: "Where is liability capped most aggressively against the weaker party?",
    expected: [
      { fixture: "nl-freelance", clause_index: 7 },
      { fixture: "es-saas-services", clause_index: 5 },
    ],
    tier: "hard",
    rationale: "Comparative query; target clauses don't use the word 'aggressive' — retriever must generalise from 'limitation of liability'.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-h5",
    question: "Which clause makes data processing instructions binding on the processor?",
    expected: [{ fixture: "de-saas-dpa", clause_index: 10 }],
    tier: "hard",
    rationale: "Term-of-art phrasing; the target uses 'instructions' + 'binding' in legal-register German/English that doesn't lexically match the casual phrasing.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-h6",
    question: "Which clause in my library most clearly excludes the counterparty's remedies?",
    expected: [
      { fixture: "es-saas-services", clause_index: 6 },
      { fixture: "pl-distribution", clause_index: 10 },
    ],
    tier: "hard",
    rationale: "Aggregation query; the 'exclusive remedy' (ES) and 'waiver of rights' (PL) both match semantically but use different lexical anchors.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
];

/**
 * Freeze guard — the baseline + cache files are keyed on this count.
 * If the array above grows or shrinks, re-freeze + re-pin the
 * baseline before committing.
 */
export const CROSS_DOC_QUESTION_COUNT = CROSS_DOC_QUESTIONS.length;
