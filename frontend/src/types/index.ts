/** Supported document file types. */
export type FileType = "pdf" | "docx";

/** Analysis depth mode — controls model choice and strategy. */
export type AnalysisMode = "fast" | "deep";

/** Response from POST /api/upload. */
export interface UploadResponse {
  filename: string;
  file_type: FileType;
  page_count: number;
  extracted_text: string;
  char_count: number;
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

/** High-level contract metadata extracted in Pass 0. */
export interface ContractOverview {
  contract_type: string;
  parties: string[];
  effective_date: string | null;
  duration: string | null;
  total_value: string | null;
  governing_jurisdiction: string | null;
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
  /** Jurisdiction-specific note when governing law triggers EU-specific rules. */
  jurisdiction_note: string | null;
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

/** Full response from POST /api/analyze. */
export interface AnalyzeResponse {
  overview: ContractOverview;
  summary: AnalysisSummary;
  clauses: AnalyzedClause[];
}
