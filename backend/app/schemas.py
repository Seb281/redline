"""Pydantic models for all API request/response shapes."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class FileType(str, Enum):
    """Supported document file types."""

    PDF = "pdf"
    DOCX = "docx"


class UploadResponse(BaseModel):
    """Response from the upload endpoint after text extraction."""

    filename: str
    file_type: FileType
    page_count: int
    extracted_text: str
    char_count: int



class RiskLevel(str, Enum):
    """Risk assessment level for a clause."""

    INFORMATIONAL = "informational"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ClauseCategory(str, Enum):
    """Classification category for a contract clause."""

    NON_COMPETE = "non_compete"
    LIABILITY = "liability"
    TERMINATION = "termination"
    IP_ASSIGNMENT = "ip_assignment"
    CONFIDENTIALITY = "confidentiality"
    GOVERNING_LAW = "governing_law"
    INDEMNIFICATION = "indemnification"
    DATA_PROTECTION = "data_protection"
    PAYMENT_TERMS = "payment_terms"
    LIMITATION_OF_LIABILITY = "limitation_of_liability"
    FORCE_MAJEURE = "force_majeure"
    DISPUTE_RESOLUTION = "dispute_resolution"
    OTHER = "other"


class ExtractedClause(BaseModel):
    """A single clause extracted from a contract (Pass 1 output)."""

    clause_text: str
    section_reference: str | None = None


class ClauseInventoryItem(BaseModel):
    """A clause identified during the overview pass (title + section ref)."""

    title: str
    section_ref: str | None = None


class ContractOverview(BaseModel):
    """High-level contract metadata extracted in Pass 0."""

    contract_type: str
    parties: list[str]
    effective_date: str | None = None
    duration: str | None = None
    total_value: str | None = None
    governing_jurisdiction: str | None = None
    key_terms: list[str]
    clause_inventory: list[ClauseInventoryItem] = []


class AnalyzedClause(BaseModel):
    """A fully analyzed clause with risk assessment (Pass 2 output)."""

    clause_text: str
    category: ClauseCategory
    title: str
    plain_english: str
    risk_level: RiskLevel
    risk_explanation: str
    negotiation_suggestion: str | None = None
    is_unusual: bool = False
    unusual_explanation: str | None = None


class RiskBreakdown(BaseModel):
    """Count of clauses by risk level."""

    high: int = Field(ge=0)
    medium: int = Field(ge=0)
    low: int = Field(ge=0)
    informational: int = Field(ge=0, default=0)


class AnalysisSummary(BaseModel):
    """Summary statistics for the full contract analysis."""

    total_clauses: int
    risk_breakdown: RiskBreakdown
    top_risks: list[str]


class AnalyzeResponse(BaseModel):
    """Full response from the analyze endpoint."""

    overview: ContractOverview
    summary: AnalysisSummary
    clauses: list[AnalyzedClause]
