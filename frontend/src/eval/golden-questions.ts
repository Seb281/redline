/**
 * SP-10 Arc 1 Phase 4b — frozen golden question set.
 *
 * 48 questions across 6 frozen fixtures (8 per fixture, mix of
 * 3 easy / 3 medium / 2 hard). Authored by Claude Opus 4.7 per the
 * methodology in ./generate-golden-set.md and pending hand-review by
 * the project owner. Any EVAL.md number sourced from this set before
 * `reviewed_by` moves off the generator-model tag is marked
 * `pre-human-review` in the baseline artifact.
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

const GENERATOR = "claude-opus-4-7";
const REVIEWED_AT = "2026-04-22";

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
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "nl-freelance-q2",
    fixture: "nl-freelance",
    question: "How long does the confidentiality obligation last after termination?",
    expected_clause_indices: [4],
    tier: "easy",
    rationale: "Direct keyword match on 'confidentiality' + 'termination'.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "nl-freelance-q3",
    fixture: "nl-freelance",
    question: "Which country's law governs this agreement?",
    expected_clause_indices: [10],
    tier: "easy",
    rationale: "Clause titled 'Choice of law' — strong keyword match on 'law/governs'.",
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },

  // ---------------------------------------------------------------
  // FR employment (13 clauses)
  // ---------------------------------------------------------------
  {
    id: "fr-employment-q1",
    fixture: "fr-employment",
    question: "What is the probation period duration?",
    expected_clause_indices: [2],
    tier: "easy",
    rationale: "Clause title 'Probationary period' — direct keyword overlap.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-employment-q2",
    fixture: "fr-employment",
    question: "What is the annual gross salary?",
    expected_clause_indices: [4],
    tier: "easy",
    rationale:
      "plain_english explicitly uses 'annual gross salary'; strong BM25 hit.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-employment-q3",
    fixture: "fr-employment",
    question: "Where will the employee work?",
    expected_clause_indices: [5],
    tier: "easy",
    rationale: "Clause titled 'Work location' — direct keyword match.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-employment-q4",
    fixture: "fr-employment",
    question: "Will I be compensated for extra hours worked beyond my regular schedule?",
    expected_clause_indices: [3],
    tier: "medium",
    rationale:
      "Clause text is French ('heures supplémentaires'); query uses 'extra hours'/'regular schedule' paraphrase.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-employment-q5",
    fixture: "fr-employment",
    question: "Am I allowed to join a rival company after my contract ends?",
    expected_clause_indices: [6],
    tier: "medium",
    rationale:
      "Non-compete clause uses 'activité professionnelle ... concurrente'; query phrases it as 'rival company'.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-employment-q6",
    fixture: "fr-employment",
    question: "Who owns the inventions I create at work?",
    expected_clause_indices: [7],
    tier: "medium",
    rationale:
      "IP clause is in French ('invention ... appartiendra ... employeur'); 'owns'/'at work' paraphrase.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-employment-q7",
    fixture: "fr-employment",
    question:
      "If I resign 18 months after starting, what must I repay, and how much notice must I give?",
    expected_clause_indices: [10, 11],
    tier: "hard",
    rationale:
      "Joint read of termination-notice clause (3-month notice) and training-retention clause (repay training cost +30% if leaving within 3 years).",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "fr-employment-q8",
    fixture: "fr-employment",
    question:
      "My employer wants to transfer me to an office 150 km from Paris — am I obligated to accept, and what if I refuse and am fired?",
    expected_clause_indices: [5, 10],
    tier: "hard",
    rationale:
      "Needs work-location clause (Île-de-France relocation without consent, outside requires agreement) + termination clause (severance if fired without cause).",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },

  // ---------------------------------------------------------------
  // DE SaaS + DPA (18 clauses)
  // ---------------------------------------------------------------
  {
    id: "de-saas-dpa-q1",
    fixture: "de-saas-dpa",
    question: "What is the monthly fee?",
    expected_clause_indices: [2],
    tier: "easy",
    rationale: "Clause titled 'Payment Terms and Late Fees' — direct match.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-saas-dpa-q2",
    fixture: "de-saas-dpa",
    question: "What is the minimum contract term?",
    expected_clause_indices: [1],
    tier: "easy",
    rationale:
      "Clause title + plain_english 'minimum term of 36 months' — direct overlap.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-saas-dpa-q3",
    fixture: "de-saas-dpa",
    question: "Which country's law governs this contract?",
    expected_clause_indices: [7],
    tier: "easy",
    rationale: "Clause titled 'Governing Law and Jurisdiction' — direct match.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-saas-dpa-q4",
    fixture: "de-saas-dpa",
    question: "What uptime does the provider guarantee?",
    expected_clause_indices: [3],
    tier: "medium",
    rationale:
      "Clause text is German ('Verfügbarkeit'); plain_english does say 'availability' — 'uptime' is a true synonym not present anywhere.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-saas-dpa-q5",
    fixture: "de-saas-dpa",
    question: "How quickly am I informed of a security incident affecting my data?",
    expected_clause_indices: [15],
    tier: "medium",
    rationale:
      "Target clause is 'Data Breach Notification' (24h); 'security incident' is a paraphrase.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-saas-dpa-q6",
    fixture: "de-saas-dpa",
    question: "Can third-party vendors process my data on the provider's behalf?",
    expected_clause_indices: [12],
    tier: "medium",
    rationale:
      "Subprocessor clause — 'third-party vendors'/'process on behalf' is a paraphrase of 'Unterauftragsverarbeiter'.",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-saas-dpa-q7",
    fixture: "de-saas-dpa",
    question:
      "If my data ends up on US-based servers, what legal safeguards are in place?",
    expected_clause_indices: [13, 11],
    tier: "hard",
    rationale:
      "Answer needs the third-country-transfer clause (SCCs + additional measures) together with the TOM clause (encryption details that form the 'additional measures').",
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "de-saas-dpa-q8",
    fixture: "de-saas-dpa",
    question:
      "I received the hardware onboarding pack on Monday. If I find a defect on Friday, can I still claim under warranty?",
    expected_clause_indices: [5],
    tier: "hard",
    rationale:
      "Requires temporal reasoning against the 48-hour inspection deadline — Friday is past the window, so warranty rights are forfeited.",
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "es-saas-services-q2",
    fixture: "es-saas-services",
    question: "What is the monthly fee I must pay?",
    expected_clause_indices: [2],
    tier: "easy",
    rationale: "Clause title 'Monthly Payment Terms' — strong keyword overlap.",
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "it-employment-q3",
    fixture: "it-employment",
    question: "What is the annual salary?",
    expected_clause_indices: [3],
    tier: "easy",
    rationale: "Clause title 'Annual Salary' — direct match.",
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
  {
    id: "pl-distribution-q3",
    fixture: "pl-distribution",
    question: "Which country's law governs the agreement?",
    expected_clause_indices: [12],
    tier: "easy",
    rationale: "Clause titled 'Polish law and jurisdiction' — direct match.",
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
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
    reviewed_by: GENERATOR,
    reviewed_at: REVIEWED_AT,
  },
];

/** Every fixture slug referenced by at least one golden question. */
export const GOLDEN_FIXTURE_SLUGS: readonly string[] = Array.from(
  new Set(GOLDEN_QUESTIONS.map((q) => q.fixture)),
);
