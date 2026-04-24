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
 * Hand-reviewed by the project owner on 2026-04-24 before baseline
 * numbers were promoted off ``pre-human-review``.
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

// Human-reviewed by project owner on 2026-04-24; the set was
// originally drafted by claude-opus-4-7 and hand-reviewed entry-by-
// entry before the `cross_doc` baseline row was promoted off
// `pre-human-review`. On the same day, 10 entries were re-targeted
// or re-authored by claude-opus-4-7 after the `fr-employment` →
// `fr-commercial-lease` and `de-saas-dpa` → `de-employment` fixture
// swap destroyed their old clause_index anchors (subprocessors, SLA
// credits, severance, data-breach notification, etc. — repurposed
// to unique anchors in the new corpus), and the re-authored entries
// were hand-reviewed in the same sweep before the baseline row was
// re-pinned. Single-entry re-reviews can override inline.
const REVIEWED_BY = "SG";
const REVIEWED_AT = "2026-04-24";

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
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e2",
    question: "Which contract grants exclusive distribution rights to one party?",
    expected: [{ fixture: "pl-distribution", clause_index: 0 }],
    tier: "easy",
    rationale: "Distribution agreement is the only one that mentions exclusive distribution; unique lexical anchor.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e3",
    question: "Which contract uses binding arbitration as the dispute mechanism?",
    expected: [{ fixture: "nl-freelance", clause_index: 9 }],
    tier: "easy",
    rationale: "Only nl-freelance specifies binding arbitration; the others go to jurisdiction/dispute resolution differently.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e4",
    question: "Where in my library is a force majeure clause?",
    expected: [{ fixture: "nl-freelance", clause_index: 11 }],
    tier: "easy",
    rationale: "Only nl-freelance has an explicit force majeure clause in the frozen corpus.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e5",
    question: "Which contract rolls all overtime pay into the base salary?",
    expected: [{ fixture: "de-employment", clause_index: 5 }],
    tier: "easy",
    rationale:
      "Re-authored 2026-04-24 after fixture swap. Overtime flat-rate is unique to de-employment §6 — strong lexical anchor on 'overtime'.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e6",
    question: "Which contract has a monthly sales reporting obligation?",
    expected: [{ fixture: "pl-distribution", clause_index: 7 }],
    tier: "easy",
    rationale: "Sales reporting is distribution-specific; unique to pl-distribution.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e7",
    question: "Which of my contracts covers a restaurant premises lease?",
    expected: [{ fixture: "fr-commercial-lease", clause_index: 0 }],
    tier: "easy",
    rationale:
      "Re-authored 2026-04-24 after fixture swap. Restaurant activity + lease designation are unique to fr-commercial-lease §1 (Description des locaux).",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-e8",
    question: "Which contract has an annual purchase minimum commitment?",
    expected: [{ fixture: "pl-distribution", clause_index: 2 }],
    tier: "easy",
    rationale: "Annual purchase minimum is distribution-specific; unique to pl-distribution.",
    reviewed_by: REVIEWED_BY,
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
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m2",
    question: "Compare how my contracts handle intellectual property assignment.",
    expected: [
      { fixture: "nl-freelance", clause_index: 3 },
      { fixture: "de-employment", clause_index: 11 },
      { fixture: "it-employment", clause_index: 6 },
    ],
    tier: "medium",
    rationale:
      "Re-targeted 2026-04-24 — fr-commercial-lease has no IP clause; de-employment §12 assigns all inventions (incl. free-time) to the employer. Three fixtures still host explicit IP assignment clauses; any in top-5 counts.",
    reviewed_by: REVIEWED_BY,
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
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m4",
    question: "Where is confidentiality addressed across my library?",
    expected: [
      { fixture: "nl-freelance", clause_index: 4 },
      { fixture: "de-employment", clause_index: 8 },
    ],
    tier: "medium",
    rationale:
      "Re-targeted 2026-04-24 — fr-commercial-lease has no confidentiality clause (it-employment also does not surface one in its frozen clause set). Two fixtures host confidentiality clauses; any in top-5 counts.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m5",
    question: "Which of my contracts is governed by Polish law?",
    expected: [{ fixture: "pl-distribution", clause_index: 12 }],
    tier: "medium",
    rationale: "Governing-law clauses are lexically similar across fixtures; retriever must pick PL.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m6",
    question: "Which contracts grant a right to audit the other party?",
    expected: [{ fixture: "es-saas-services", clause_index: 7 }],
    tier: "medium",
    rationale:
      "Re-targeted 2026-04-24 — the new de-employment fixture has no audit rights; es-saas-services remains the only audit-rights anchor in the corpus.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m7",
    question: "Which contract charges a flat percentage penalty on overdue payments?",
    expected: [{ fixture: "fr-commercial-lease", clause_index: 8 }],
    tier: "medium",
    rationale:
      "Re-authored 2026-04-24 after fixture swap (the old DE SaaS+DPA breach-notification clause is gone). fr-commercial-lease §9 fixes a 15% clause pénale on arrears; retriever must distinguish from general payment-terms clauses in other fixtures.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m8",
    question: "Which contract transfers major building repairs to the non-owner party?",
    expected: [{ fixture: "fr-commercial-lease", clause_index: 5 }],
    tier: "medium",
    rationale:
      "Re-authored 2026-04-24 after fixture swap (severance is no longer in the corpus). fr-commercial-lease §6 transfers gros entretien (art. 606 Code civil) onto the Preneur — query phrases it as 'major building repairs'.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m9",
    question: "Which contracts have a probationary period?",
    expected: [
      { fixture: "de-employment", clause_index: 1 },
      { fixture: "it-employment", clause_index: 1 },
    ],
    tier: "medium",
    rationale:
      "Re-targeted 2026-04-24 — fr-commercial-lease has no probation; the two employment contracts (DE + IT) both carry one. Any in top-5 counts.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-m10",
    question: "Where are service credits or SLA remedies discussed?",
    expected: [{ fixture: "es-saas-services", clause_index: 4 }],
    tier: "medium",
    rationale:
      "Re-targeted 2026-04-24 — the old de-saas-dpa SLA clause is gone; es-saas-services remains the only fixture covering service credits / SLA remedies.",
    reviewed_by: REVIEWED_BY,
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
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-h2",
    question: "Which contract has an unusually one-sided indemnification obligation?",
    expected: [{ fixture: "nl-freelance", clause_index: 6 }],
    tier: "hard",
    rationale: "Target clause's title includes 'one-sided' but most retrievers latch on 'indemnification' which is fixture-rare; good semantic test.",
    reviewed_by: REVIEWED_BY,
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
    reviewed_by: REVIEWED_BY,
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
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "xd-h5",
    question:
      "Which clause makes the employer the owner of work an employee creates outside working hours?",
    expected: [{ fixture: "de-employment", clause_index: 11 }],
    tier: "hard",
    rationale:
      "Re-authored 2026-04-24 after fixture swap. de-employment §12 sweeps both Diensterfindungen and freie Erfindungen to the employer; the query's 'outside working hours' is the semantic hook and lexically distant from the clause's 'Freizeit'.",
    reviewed_by: REVIEWED_BY,
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
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
];

/**
 * Freeze guard — the baseline + cache files are keyed on this count.
 * If the array above grows or shrinks, re-freeze + re-pin the
 * baseline before committing.
 */
export const CROSS_DOC_QUESTION_COUNT = CROSS_DOC_QUESTIONS.length;
