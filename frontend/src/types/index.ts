import type { StatuteCode } from "@/lib/applicable-law";

/** Supported document file types. */
export type FileType = "pdf" | "docx";

/**
 * SP-1.7 — How the model determined governing_jurisdiction at the
 * contract level.
 *
 * - "stated": explicit governing-law clause found; source_text is
 *   the verbatim phrase or clause reference.
 * - "inferred": no clause, but country derivable from party
 *   addresses / language / currency; source_text is the one-line
 *   reason.
 * - "unknown": neither possible; source_text is null AND the
 *   parent governing_jurisdiction is null.
 */
export interface JurisdictionEvidence {
  source_type: "stated" | "inferred" | "unknown";
  source_text: string | null;
}

/**
 * SP-1.7 — A single statutory citation anchored to the
 * {@link STATUTE_CODES} whitelist. The human label is rendered
 * client-side from {@link STATUTE_LABELS}, not round-tripped
 * through the model.
 */
export interface ApplicableLawCitation {
  code: StatuteCode;
}

/**
 * SP-1.7 — Structured legal grounding emitted by Pass 2.
 *
 * Invariants (enforced by Zod / Pydantic):
 *   - source_type "statute_cited" ⇔ citations.length >= 1
 *   - source_type "general_principle" ⇔ citations.length === 0
 */
export interface ApplicableLaw {
  observation: string;
  source_type: "statute_cited" | "general_principle";
  citations: ApplicableLawCitation[];
}

/** Analysis depth mode — controls model choice and strategy. */
export type AnalysisMode = "fast" | "deep";

/** Response from POST /api/upload. */
export interface UploadResponse {
  filename: string;
  file_type: FileType;
  page_count: number;
  extracted_text: string;
  char_count: number;
  /**
   * Where the extracted text came from at parse time (SP-1.5).
   * - "native": pdfplumber only (no OCR)
   * - "ocr":    every page rendered + OCR'd on-device via Tesseract
   * - "hybrid": mix — some pages native, some OCR'd
   *
   * Surfaced in the analysis footer so users can see when on-device
   * OCR ran (reinforces the "no third-party vision model" guarantee).
   */
  text_source: "native" | "ocr" | "hybrid";
}

/** Request body for POST /api/analyze. */
export interface AnalyzeRequest {
  text: string;
  think_hard: boolean;
}

/** A clause identified during the overview pass (title + section ref). */
export interface ClauseInventoryItem {
  title: string;
  section_ref: string | null;
}

/** A party to the contract, optionally with a defined term extracted from the preamble. */
export interface Party {
  name: string;
  role_label: string | null;
}

/** High-level contract metadata extracted in Pass 0. */
export interface ContractOverview {
  contract_type: string;
  parties: Party[];
  effective_date: string | null;
  duration: string | null;
  total_value: string | null;
  governing_jurisdiction: string | null;
  /**
   * SP-1.7 — Structured signal for how the model determined
   * governing_jurisdiction. `null` only on legacy saved rows that
   * predate SP-1.7; fresh Pass 0 output always populates one of the
   * three source types.
   */
  jurisdiction_evidence: JurisdictionEvidence | null;
  key_terms: string[];
  clause_inventory: ClauseInventoryItem[];
}

/** Risk assessment level for a clause. */
export type RiskLevel = "informational" | "low" | "medium" | "high";

/** Classification category for a contract clause. */
export type ClauseCategory =
  | "non_compete"
  | "liability"
  | "termination"
  | "ip_assignment"
  | "confidentiality"
  | "governing_law"
  | "indemnification"
  | "data_protection"
  | "payment_terms"
  | "limitation_of_liability"
  | "force_majeure"
  | "dispute_resolution"
  | "other";

/** A fully analyzed clause with risk assessment. */
export interface AnalyzedClause {
  clause_text: string;
  category: ClauseCategory;
  title: string;
  plain_english: string;
  risk_level: RiskLevel;
  risk_explanation: string;
  negotiation_suggestion: string | null;
  is_unusual: boolean;
  unusual_explanation: string | null;
  /**
   * SP-1.7 — Structured legal grounding for this clause. `null` when
   * no canonical statute from the whitelist applies and there is no
   * jurisdiction-specific general principle worth flagging (the common
   * case for most clauses).
   */
  applicable_law: ApplicableLaw | null;
  /**
   * Optional verbatim citations for claims in `plain_english`.
   * Each entry maps to an inline `[^id]` marker in the narrative.
   * Present only when the analyzer emitted citations; missing on
   * older cached responses and on the backend path.
   */
  citations?: Array<{
    id: number;
    quoted_text: string;
  }>;
}

/** Count of clauses by risk level. */
export interface RiskBreakdown {
  high: number;
  medium: number;
  low: number;
  informational: number;
}

/** Summary statistics for the full contract analysis. */
export interface AnalysisSummary {
  total_clauses: number;
  risk_breakdown: RiskBreakdown;
  top_risks: string[];
}

/** Reasoning effort label per pipeline pass. */
export type ReasoningEffortLabel = "low" | "medium" | "high";

/** Per-analysis provenance metadata for EU AI Act transparency + auditability. */
export interface AnalysisProvenance {
  /** Provider name as configured at runtime, e.g. "mistral" or "openai". */
  provider: string;
  /** Logical model identifier, e.g. "mistral-small-4". */
  model: string;
  /** Versioned model snapshot (revision/date) for deterministic logging. */
  snapshot: string;
  /** Hosting region where the call resolved. */
  region: string;
  /** Reasoning effort applied to each pipeline pass. */
  reasoning_effort_per_pass: {
    overview: ReasoningEffortLabel;
    extraction: ReasoningEffortLabel;
    risk: ReasoningEffortLabel;
    think_hard: ReasoningEffortLabel;
  };
  /** Prompt-template version string (bumped manually when prompts change). */
  prompt_template_version: string;
  /** ISO timestamp of when the analysis was assembled. */
  timestamp: string;
  /**
   * Where the PII token map lives during analysis. "client" as of
   * SP-1.6 (moved out of /api/analyze/stream). "server" is the legacy
   * SP-1 behavior and still the chat-route default. Optional so
   * pre-SP-1.6 saved analyses deserialize unchanged.
   */
  redaction_location?: "client" | "server";
  /**
   * Whether OCR ran during parse (SP-1.5). Optional so pre-SP-1.5
   * saved analyses deserialize unchanged (rendered as absent in the
   * footer note). "native" = pdfplumber only, "ocr" = every page
   * OCR'd, "hybrid" = mix.
   */
  text_source?: "native" | "ocr" | "hybrid";
}

/** Full response from POST /api/analyze. */
export interface AnalyzeResponse {
  overview: ContractOverview;
  summary: AnalysisSummary;
  clauses: AnalyzedClause[];
  /**
   * Required — assembled by the analysis pipeline after every pass
   * finishes. Carries the AI Act transparency block (provider, model,
   * reasoning-effort policy per pass, prompt-template version, ISO
   * timestamp).
   */
  provenance: AnalysisProvenance;
}

/** User info returned by auth endpoints. */
export interface AuthUser {
  id: string;
  email: string;
}

/** Summary of a saved analysis for list views. */
export interface AnalysisListItem {
  id: string;
  filename: string;
  file_type: string;
  contract_type: string | null;
  analysis_mode: string;
  clause_count: number;
  risk_high: number;
  risk_medium: number;
  risk_low: number;
  created_at: string;
}

/** Payload for saving an analysis to the backend. */
export interface SaveAnalysisPayload {
  filename: string;
  file_type: string;
  page_count: number | null;
  char_count: number | null;
  contract_text: string;
  overview: ContractOverview;
  summary: AnalysisSummary;
  clauses: AnalyzedClause[];
  analysis_mode: string;
  /** Required — pipeline attaches this to every freshly-run analysis. */
  provenance: AnalysisProvenance;
}

/** Full saved analysis returned by GET /api/analyses/{id}. */
export interface SavedAnalysis {
  id: string;
  filename: string;
  file_type: string;
  page_count: number | null;
  char_count: number | null;
  contract_text: string;
  overview: ContractOverview;
  summary: AnalysisSummary;
  clauses: AnalyzedClause[];
  analysis_mode: string;
  created_at: string;
  updated_at: string | null;
  /** Missing on analyses saved before SP-1 Phase 5 rolled out. */
  provenance?: AnalysisProvenance;
}
