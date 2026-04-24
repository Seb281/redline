/**
 * SP-10 Arc 1 Phase 4b — frozen golden question set.
 *
 * 48 questions across 6 frozen fixtures (8 per fixture, mix of
 * 3 easy / 3 medium / 2 hard). Drafted by Claude Opus 4.7 per the
 * methodology in ./generate-golden-set.md and hand-reviewed by the
 * project owner on 2026-04-24 before baseline numbers were promoted
 * off `pre-human-review`.
 *
 * `expected_clause_indices` are positional within the matching
 * fixture's `clauses` array, which is frozen on disk (see
 * ./fixtures/*.json and ./freeze.test.ts). Re-capturing a fixture
 * requires re-reviewing every question that references it, because
 * clause indices can shift silently when the pipeline re-ranks
 * extraction order.
 *
 * DO NOT re-order entries without reviewing impact on EVAL.md — `id`
 * is the stable handle the harness keys on and the baseline artifact
 * is keyed by `id` too.
 */

/** Difficulty tier per methodology rubric. */
export type GoldenTier = "easy" | "medium" | "hard";

/** One golden-set entry. See ./generate-golden-set.md for schema rationale. */
export interface GoldenQuestion {
  /** Stable slug, e.g. "nl-freelance-q1". */
  id: string;
  /** Fixture slug (matches manifest). */
  fixture: string;
  /** Natural-language query handed to the retriever. */
  question: string;
  /** Positional indices into the fixture's `clauses` array. */
  expected_clause_indices: number[];
  tier: GoldenTier;
  /** One-line explanation of why this tier was chosen. */
  rationale: string;
  /** Model id or reviewer initials who last approved this entry. */
  reviewed_by: string;
  /** ISO date of last review. */
  reviewed_at: string;
}

// Human-reviewed by project owner on 2026-04-24; the set was
// originally drafted by claude-opus-4-7 and hand-reviewed clause-by-
// clause before any baseline numbers were promoted off
// `pre-human-review`. The 16 entries covering `fr-commercial-lease`
// and `de-employment` were re-authored by claude-opus-4-7 against
// the freshly frozen fixtures on the same day and hand-reviewed in
// the same sweep. Kept as a constant so single-entry re-reviews can
// override inline without stale-stamping untouched rows.
const REVIEWED_BY = "SG";
const REVIEWED_AT = "2026-04-24";

export const GOLDEN_QUESTIONS: readonly GoldenQuestion[] = [
  // ---------------------------------------------------------------
  // NL freelance services (13 clauses)
  // ---------------------------------------------------------------
  {
    id: "nl-freelance-q1",
    fixture: "nl-freelance",
    question: "What are the payment terms for invoices under this agreement?",
    expected_clause_indices: [1],
    tier: "easy",
    rationale:
      "Keyword overlap on 'payment'/'invoices' with clause title and plain_english.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "nl-freelance-q2",
    fixture: "nl-freelance",
    question: "How long does the confidentiality obligation last after termination?",
    expected_clause_indices: [4],
    tier: "easy",
    rationale: "Direct keyword match on 'confidentiality' + 'termination'.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "nl-freelance-q3",
    fixture: "nl-freelance",
    question: "Which country's law governs this agreement?",
    expected_clause_indices: [10],
    tier: "easy",
    rationale: "Clause titled 'Choice of law' — strong keyword match on 'law/governs'.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "nl-freelance-q4",
    fixture: "nl-freelance",
    question: "Who owns the code I write for the client?",
    expected_clause_indices: [3],
    tier: "medium",
    rationale:
      "Clause uses 'Work Product' + 'assigns all right, title and interest'; query uses 'owns' + 'code' — semantic mapping required.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "nl-freelance-q5",
    fixture: "nl-freelance",
    question: "Am I restricted from working for a rival firm after leaving?",
    expected_clause_indices: [5],
    tier: "medium",
    rationale:
      "Target clause uses 'non-compete'/'competes with'; query uses 'restricted'/'rival firm' — paraphrase required.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "nl-freelance-q6",
    fixture: "nl-freelance",
    question: "If an earthquake prevents me from finishing the work, am I still liable?",
    expected_clause_indices: [11],
    tier: "medium",
    rationale:
      "Force majeure clause lists 'acts of God, natural disasters, war'; 'earthquake'/'liable' paraphrases force the semantic branch.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "nl-freelance-q7",
    fixture: "nl-freelance",
    question: "Which of my obligations survive termination of the contract?",
    expected_clause_indices: [3, 4, 5],
    tier: "hard",
    rationale:
      "Three independent clauses survive termination (IP assignment perpetual, confidentiality 7 yrs post-term, non-compete 18 mo post-term).",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "nl-freelance-q8",
    fixture: "nl-freelance",
    question:
      "If my work triggers a third-party claim against the client, but the client's work triggers one against me, is liability symmetric?",
    expected_clause_indices: [6, 7],
    tier: "hard",
    rationale:
      "Requires joining the one-sided indemnification (clause 6) with the asymmetric liability cap (clause 7) that only protects Company, not Contractor.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },

  // ---------------------------------------------------------------
  // FR commercial lease (15 clauses) — re-authored 2026-04-24
  // after fixture swap and hand-reviewed in the same sweep.
  // ---------------------------------------------------------------
  {
    id: "fr-commercial-lease-q1",
    fixture: "fr-commercial-lease",
    question: "How long is the lease agreement?",
    expected_clause_indices: [1],
    tier: "easy",
    rationale:
      "Clause 1 titled 'Durée et résiliation triennale' with plain_english '9 ans' — direct keyword overlap on 'lease'/'durée'.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-commercial-lease-q2",
    fixture: "fr-commercial-lease",
    question: "What is the annual rent?",
    expected_clause_indices: [3],
    tier: "easy",
    rationale:
      "Clause 3 'Loyer et indexation' — plain_english explicitly says '48 000 €'; strong keyword hit on rent/loyer.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-commercial-lease-q3",
    fixture: "fr-commercial-lease",
    question: "How big is the leased property and where is it located?",
    expected_clause_indices: [0],
    tier: "easy",
    rationale:
      "Clause 0 'Description des locaux loués' — direct semantic match on size + location.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-commercial-lease-q4",
    fixture: "fr-commercial-lease",
    question: "Am I allowed to sublet the premises to another business?",
    expected_clause_indices: [6],
    tier: "medium",
    rationale:
      "Clause 6 'Cession et sous-location' — French clause text uses 'sous-location'; English query phrases as 'sublet'.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-commercial-lease-q5",
    fixture: "fr-commercial-lease",
    question:
      "When the lease ends, can I keep or be paid for the improvements I made to the premises?",
    expected_clause_indices: [10],
    tier: "medium",
    rationale:
      "Clause 10 'Restitution des locaux' — French clause says 'améliorations ... deviennent la propriété du Bailleur sans indemnité'. Query paraphrases as 'improvements I made' / 'keep or be paid for'; medium-tier because the answer (no, without compensation) requires reading the clause carefully rather than latching on a single keyword.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-commercial-lease-q6",
    fixture: "fr-commercial-lease",
    question: "Who is responsible for major building repairs?",
    expected_clause_indices: [5],
    tier: "medium",
    rationale:
      "Clause 5 'Charges et réparations' transfers grosses réparations (including art. 606) to the Preneur; 'major building repairs' is a paraphrase.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-commercial-lease-q7",
    fixture: "fr-commercial-lease",
    question:
      "What happens if I miss a rent payment — what can the landlord do and what do I owe?",
    expected_clause_indices: [7, 8],
    tier: "hard",
    rationale:
      "Joint read: clause 7 'Résiliation pour non-paiement' triggers the lease termination via clause résolutoire, and clause 8 'Intérêts de retard et clause pénale' fixes the 15% penalty plus interest. Answer requires both. Any in top-5 counts.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-commercial-lease-q8",
    fixture: "fr-commercial-lease",
    question:
      "If the landlord evicts me after a breach notice, am I entitled to eviction compensation for the lost business goodwill?",
    expected_clause_indices: [9],
    tier: "hard",
    rationale:
      "Clause 9 'Résiliation pour manquement' explicitly excludes indemnité d'éviction under L.145-14 — a term of art the retriever must bridge from the query's 'eviction compensation for lost goodwill'. Single-index hard: the implicit legal reasoning (L.145-14 waiver) is the difficulty.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },

  // ---------------------------------------------------------------
  // DE employment (16 clauses) — re-authored 2026-04-24 after
  // fixture swap and hand-reviewed in the same sweep.
  // ---------------------------------------------------------------
  {
    id: "de-employment-q1",
    fixture: "de-employment",
    question: "What is the annual gross salary?",
    expected_clause_indices: [3],
    tier: "easy",
    rationale:
      "Clause 3 'Salary and Payment Terms' — plain_english explicitly uses 'annual gross salary of 85,000 euros'. Strong keyword hit.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-employment-q2",
    fixture: "de-employment",
    question: "How long is the probation period?",
    expected_clause_indices: [1],
    tier: "easy",
    rationale:
      "Clause 1 'Probation Period Terms' — direct keyword match; plain_english says 'six months'.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-employment-q3",
    fixture: "de-employment",
    question: "How many vacation days am I entitled to each year?",
    expected_clause_indices: [4],
    tier: "easy",
    rationale:
      "Clause 4 'Annual Leave Entitlement' — plain_english '25 days'. Lexical match on 'vacation'/'leave'.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-employment-q4",
    fixture: "de-employment",
    question: "Will I be paid extra if I work beyond my normal hours?",
    expected_clause_indices: [5],
    tier: "medium",
    rationale:
      "Clause 5 'Overtime Compensation Exclusion' — German clause text uses 'Überstunden/Mehrarbeit ... abgegolten'. Query phrases it as 'paid extra'/'beyond normal hours'; the retriever has to bridge.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-employment-q5",
    fixture: "de-employment",
    question: "Can I take on a second job while working here?",
    expected_clause_indices: [7],
    tier: "medium",
    rationale:
      "Clause 7 'Side Employment Restrictions' — German 'Nebentätigkeiten' mapped to 'second job'. Paraphrase, not a direct keyword match.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-employment-q6",
    fixture: "de-employment",
    question: "Who owns a side project I build at home on my own time?",
    expected_clause_indices: [11],
    tier: "medium",
    rationale:
      "Clause 11 'Intellectual Property Assignment' — clause text says 'in der Freizeit entstehen ... vollständig ... auf die Arbeitgeberin' and query uses 'side project at home'. Retriever must connect free-time inventions to IP clause.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-employment-q7",
    fixture: "de-employment",
    question:
      "If I leave the company and accept a role at a competitor in Spain three months later, what must I not do and what will I receive in return?",
    expected_clause_indices: [10],
    tier: "hard",
    rationale:
      "Requires joint reasoning over clause 10 'Post-Employment Non-Compete' — 12-month EU-wide ban + 25% Karenzentschädigung as the quid pro quo. The query's 'what will I receive in return' anchors on the compensation half.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-employment-q8",
    fixture: "de-employment",
    question:
      "If I accidentally share a confidential document with a friend after leaving the company, what amount am I contractually liable to pay?",
    expected_clause_indices: [8, 12],
    tier: "hard",
    rationale:
      "Joint read: clause 8 'Confidentiality Obligations' extends the duty five years post-termination; clause 12 'Penalty for Breach' fixes the liquidated damages at three months' gross salary. Any in top-5 counts.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },

  // ---------------------------------------------------------------
  // ES SaaS services (12 clauses)
  // ---------------------------------------------------------------
  {
    id: "es-saas-services-q1",
    fixture: "es-saas-services",
    question: "How long is the initial contract duration?",
    expected_clause_indices: [1],
    tier: "easy",
    rationale: "Clause title 'Contract Duration and Termination' — direct match.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "es-saas-services-q2",
    fixture: "es-saas-services",
    question: "What is the monthly fee I must pay?",
    expected_clause_indices: [2],
    tier: "easy",
    rationale: "Clause title 'Monthly Payment Terms' — strong keyword overlap.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "es-saas-services-q3",
    fixture: "es-saas-services",
    question: "Which courts have jurisdiction over disputes?",
    expected_clause_indices: [10],
    tier: "easy",
    rationale:
      "Clause titled 'Governing Law and Jurisdiction' — 'courts'/'jurisdiction' keywords match.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "es-saas-services-q4",
    fixture: "es-saas-services",
    question: "Can the provider raise the price without my approval?",
    expected_clause_indices: [3],
    tier: "medium",
    rationale:
      "'Unilateral Fee Adjustment' clause; query paraphrases 'raise the price' + 'without my approval' — neither phrase appears verbatim.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "es-saas-services-q5",
    fixture: "es-saas-services",
    question: "What availability does the platform promise each month?",
    expected_clause_indices: [4],
    tier: "medium",
    rationale:
      "SLA clause uses 'disponibilidad mensual 99%'; 'availability'/'each month' paraphrases Spanish text.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "es-saas-services-q6",
    fixture: "es-saas-services",
    question: "Can the provider inspect how my staff uses the platform?",
    expected_clause_indices: [7],
    tier: "medium",
    rationale:
      "'Audit Rights' clause uses 'auditar el uso'; 'inspect' + 'my staff' is paraphrase.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "es-saas-services-q7",
    fixture: "es-saas-services",
    question:
      "The provider has missed the SLA for four consecutive months. Can I terminate, or am I limited to service credits?",
    expected_clause_indices: [4, 6],
    tier: "hard",
    rationale:
      "Joint read of SLA clause + exclusive-remedy clause (credits only, contract-termination waiver).",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "es-saas-services-q8",
    fixture: "es-saas-services",
    question:
      "What's the maximum I can recover if the provider's negligence leaks my customer list?",
    expected_clause_indices: [5, 6],
    tier: "hard",
    rationale:
      "Combines liability cap (3 months fees) with the exclusive-remedy waiver — straight liability cap alone would underspecify.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },

  // ---------------------------------------------------------------
  // IT employment (13 clauses)
  // ---------------------------------------------------------------
  {
    id: "it-employment-q1",
    fixture: "it-employment",
    question: "How long is the probation period?",
    expected_clause_indices: [1],
    tier: "easy",
    rationale: "Clause title 'Six-Month Probation Period' — direct keyword match.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "it-employment-q2",
    fixture: "it-employment",
    question: "How many hours per week is the employee expected to work?",
    expected_clause_indices: [2],
    tier: "easy",
    rationale:
      "Clause title 'Weekly Work Hours' + plain_english '40 hours per week' — strong overlap.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "it-employment-q3",
    fixture: "it-employment",
    question: "What is the annual salary?",
    expected_clause_indices: [3],
    tier: "easy",
    rationale: "Clause title 'Annual Salary' — direct match.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "it-employment-q4",
    fixture: "it-employment",
    question: "Will I be paid extra for hours beyond the standard week?",
    expected_clause_indices: [2],
    tier: "medium",
    rationale:
      "Clause text is Italian ('senza diritto ad alcuna maggiorazione'); 'paid extra'/'beyond the standard week' paraphrases.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "it-employment-q5",
    fixture: "it-employment",
    question: "Can my employer reassign me to a different role or city?",
    expected_clause_indices: [8],
    tier: "medium",
    rationale:
      "'Job Duties and Transfer' clause is in Italian; 'reassign'/'different role or city' paraphrases 'modificare mansioni' + 'trasferimento'.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "it-employment-q6",
    fixture: "it-employment",
    question: "Am I restricted from working in my field after leaving?",
    expected_clause_indices: [9],
    tier: "medium",
    rationale:
      "Non-compete clause uses Italian 'non svolgere ... attività'; 'restricted'/'my field' paraphrase.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "it-employment-q7",
    fixture: "it-employment",
    question:
      "If I quit during the first week without notice, and again after probation without notice, what's the difference in consequences?",
    expected_clause_indices: [1, 10],
    tier: "hard",
    rationale:
      "Requires joining probation clause (either party can terminate without notice during probation) with dispute/penalty clause (3-month salary penalty applies post-probation).",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "it-employment-q8",
    fixture: "it-employment",
    question:
      "If I accidentally damage company equipment through gross negligence, who covers the cost?",
    expected_clause_indices: [7],
    tier: "hard",
    rationale:
      "Liability clause assigns employee full responsibility even for gross negligence or willful misconduct — implicit read of unfair risk shifting.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },

  // ---------------------------------------------------------------
  // PL distribution (14 clauses)
  // ---------------------------------------------------------------
  {
    id: "pl-distribution-q1",
    fixture: "pl-distribution",
    question: "How long is the initial term of the agreement?",
    expected_clause_indices: [1],
    tier: "easy",
    rationale:
      "Clause title 'Five-year term with renewal' — direct keyword overlap on 'term'/'years'.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "pl-distribution-q2",
    fixture: "pl-distribution",
    question: "What is the annual purchase minimum I must meet?",
    expected_clause_indices: [2],
    tier: "easy",
    rationale:
      "Clause title 'Annual purchase minimum' — direct match on every noun.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "pl-distribution-q3",
    fixture: "pl-distribution",
    question: "Which country's law governs the agreement?",
    expected_clause_indices: [12],
    tier: "easy",
    rationale: "Clause titled 'Polish law and jurisdiction' — direct match.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "pl-distribution-q4",
    fixture: "pl-distribution",
    question: "Can the supplier raise prices without my consent?",
    expected_clause_indices: [3],
    tier: "medium",
    rationale:
      "Pricing clause is in Polish ('jednostronnej zmiany cennika'); 'raise prices'/'without consent' paraphrases.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "pl-distribution-q5",
    fixture: "pl-distribution",
    question: "Am I owed any compensation when the distribution agreement ends?",
    expected_clause_indices: [9],
    tier: "medium",
    rationale:
      "Clause text in Polish uses 'odszkodowanie/rekompensata'; 'owed compensation' paraphrases.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "pl-distribution-q6",
    fixture: "pl-distribution",
    question: "Am I allowed to sell a rival brand during the agreement?",
    expected_clause_indices: [4],
    tier: "medium",
    rationale:
      "Non-compete portion of the distribution-obligations clause; 'rival brand' paraphrases 'konkurencyjnych produktów'.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "pl-distribution-q7",
    fixture: "pl-distribution",
    question:
      "I sold products outside my territory — what is the financial penalty, and can I ask a court to reduce it?",
    expected_clause_indices: [6, 10],
    tier: "hard",
    rationale:
      "Combines contractual-penalty clause (€50k per territorial breach) with the waiver-of-rights clause (distributor waived right to ask a court to reduce penalties).",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "pl-distribution-q8",
    fixture: "pl-distribution",
    question:
      "If my company's ownership changes through an acquisition, can the supplier terminate the agreement?",
    expected_clause_indices: [8],
    tier: "hard",
    rationale:
      "Supplier's-termination-rights clause treats ownership changes as immediate-termination trigger — requires reading the enumerated list, not just the clause title.",
    reviewed_by: REVIEWED_BY,
    reviewed_at: REVIEWED_AT,
  },
];

/** Every fixture slug referenced by at least one golden question. */
export const GOLDEN_FIXTURE_SLUGS: readonly string[] = Array.from(
  new Set(GOLDEN_QUESTIONS.map((q) => q.fixture)),
);
