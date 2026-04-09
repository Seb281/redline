/** Supported document file types. */
export type FileType = "pdf" | "docx";

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

/** Risk assessment level for a clause. */
export type RiskLevel = "low" | "medium" | "high";

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
}

/** Count of clauses by risk level. */
export interface RiskBreakdown {
  high: number;
  medium: number;
  low: number;
}

/** Summary statistics for the full contract analysis. */
export interface AnalysisSummary {
  total_clauses: number;
  risk_breakdown: RiskBreakdown;
  top_risks: string[];
}

/** Full response from POST /api/analyze. */
export interface AnalyzeResponse {
  summary: AnalysisSummary;
  clauses: AnalyzedClause[];
}
