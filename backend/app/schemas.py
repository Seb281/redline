"""Pydantic models for all API request/response shapes."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class FileType(str, Enum):
    """Supported document file types."""

    PDF = "pdf"
    DOCX = "docx"


class UploadResponse(BaseModel):
    """Response from the upload endpoint after text extraction.

    ``text_source`` records whether OCR ran during extraction (SP-1.5).
    ``"native"`` = pdfplumber only; ``"ocr"`` = every page OCR'd;
    ``"hybrid"`` = some native, some OCR'd. The frontend uses this to
    surface an on-device OCR note in the analysis footer and to flag
    provenance for transparency.
    """

    filename: str
    file_type: FileType
    page_count: int
    extracted_text: str
    char_count: int
    text_source: Literal["native", "ocr", "hybrid"] = "native"



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


class Party(BaseModel):
    """A party to the contract.

    SP-1.9 — carries the defined term the contract introduces for the
    party (e.g. ``"Provider"``, ``"Tenant"``) in addition to the legal
    name. ``role_label`` is nullable because contracts don't always
    introduce a shorthand; the frontend falls back to a heuristic
    derived from ``contract_type`` in that case.
    """

    name: str
    role_label: str | None = None


class JurisdictionEvidence(BaseModel):
    """SP-1.7 / SP-2 — How Pass 0 determined ``governing_jurisdiction``.

    SP-2 adds ``country`` — an ISO 3166-1 alpha-2 code. The backend
    validates *shape only* (regex, not enum): the frontend Zod schema
    in ``src/lib/analyzer.ts`` is the single source of truth for the
    EU-27 whitelist. This keeps the statute catalog a single-file
    concern and avoids sync machinery between TypeScript and Python.

    Invariants:
      - ``source_type == "unknown"`` ⇒ ``country is None``
      - ``source_type == "unknown"`` ⇔ parent
        ``ContractOverview.governing_jurisdiction is None`` (enforced
        client-side via ``reconcileJurisdiction``).
    """

    source_type: Literal["stated", "inferred", "unknown"]
    source_text: str | None = None
    country: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")

    @model_validator(mode="after")
    def _unknown_requires_null_country(self) -> "JurisdictionEvidence":
        """Reject source_type=unknown paired with a non-null country."""
        if self.source_type == "unknown" and self.country is not None:
            raise ValueError(
                "source_type=unknown requires country=None",
            )
        return self


class ApplicableLawCitation(BaseModel):
    """SP-1.7 / SP-2 — A single statute reference.

    SP-2 relaxes ``code`` from a ``Literal[...]`` enum to an open
    ``str``: the frontend Zod schema in ``src/lib/applicable-law.ts`` is
    the single source of truth for the catalog. Backend is a shape-only
    pass-through for JSONB round-trip — Pass 2 runs client-side behind
    Zod, saved analyses come from the frontend pipeline, and endpoints
    are authenticated + owner-scoped. See the SP-2 design doc for the
    threat-model justification.
    """

    code: str = Field(min_length=1)


class ApplicableLaw(BaseModel):
    """SP-1.7 — Structured legal grounding for a clause.

    Invariants (parity with the frontend Zod schema):
      - ``source_type == "statute_cited"`` requires ``len(citations) >= 1``
      - ``source_type == "general_principle"`` requires ``citations == []``
    """

    observation: str = Field(min_length=1)
    source_type: Literal["statute_cited", "general_principle"]
    citations: list[ApplicableLawCitation] = []

    @model_validator(mode="after")
    def _invariants(self) -> "ApplicableLaw":
        """Reject mismatched source_type/citations combinations."""
        if self.source_type == "statute_cited" and not self.citations:
            raise ValueError("statute_cited requires at least one citation")
        if self.source_type == "general_principle" and self.citations:
            raise ValueError(
                "general_principle requires citations to be empty",
            )
        return self


class ContractOverview(BaseModel):
    """High-level contract metadata extracted in Pass 0."""

    contract_type: str
    parties: list[Party]
    effective_date: str | None = None
    duration: str | None = None
    total_value: str | None = None
    governing_jurisdiction: str | None = None
    jurisdiction_evidence: JurisdictionEvidence | None = None
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
    applicable_law: ApplicableLaw | None = None


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


# --- Auth schemas ---


class LoginRequest(BaseModel):
    """Request body for magic link login."""

    email: str = Field(min_length=3, max_length=254)


class UserResponse(BaseModel):
    """Public user info returned after authentication."""

    id: str
    email: str


class VerifyRequest(BaseModel):
    """Request body for magic link verification."""

    token: str


# --- Persistence schemas ---


ReasoningEffortLabel = Literal["low", "medium", "high"]


class ReasoningEffortPerPass(BaseModel):
    """Reasoning-effort label per pipeline pass (EU AI Act transparency)."""

    overview: ReasoningEffortLabel
    extraction: ReasoningEffortLabel
    risk: ReasoningEffortLabel
    think_hard: ReasoningEffortLabel


# Sentinel `provider` value emitted by the frontend when reconstructing
# an `AnalyzeResponse` from a pre-Phase-5 saved analysis that has no
# stored provenance. Rejected on save so placeholder transparency data
# cannot be persisted as authentic.
LEGACY_PROVENANCE_PROVIDER = "legacy-pre-phase5"


class ProvenanceModel(BaseModel):
    """Per-analysis LLM provenance required for EU AI Act transparency.

    Every field is required. The frontend assembles this after all
    passes complete and forwards it on save.
    """

    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)
    snapshot: str = Field(min_length=1)
    region: str = Field(min_length=1)
    reasoning_effort_per_pass: ReasoningEffortPerPass
    prompt_template_version: str = Field(min_length=1)
    timestamp: str = Field(min_length=1)
    # SP-1.6: client-side redaction. Optional so pre-SP-1.6 payloads
    # deserialize unchanged; ``None`` means "unknown / legacy".
    redaction_location: Literal["client", "server"] | None = None
    # SP-1.5: text extraction source. Optional so pre-SP-1.5 payloads
    # deserialize unchanged; ``None`` means "unknown / legacy".
    text_source: Literal["native", "ocr", "hybrid"] | None = None

    @field_validator("provider")
    @classmethod
    def reject_legacy_placeholder(cls, v: str) -> str:
        """Block the legacy placeholder from round-tripping into the DB."""
        if v == LEGACY_PROVENANCE_PROVIDER:
            raise ValueError(
                "legacy-pre-phase5 provenance placeholder cannot be persisted",
            )
        return v


class SaveAnalysisRequest(BaseModel):
    """Request body for saving an analysis.

    The ``provenance`` block carries per-analysis LLM metadata (provider,
    model, snapshot, region, reasoning effort, prompt template version,
    timestamp). Required end-to-end as of SP-1 Phase 5 — the frontend
    assembles it in every pipeline run and must forward it here.
    """

    filename: str
    file_type: str
    page_count: int | None = None
    char_count: int | None = None
    contract_text: str
    overview: dict
    summary: dict
    clauses: list[dict]
    analysis_mode: str
    provenance: ProvenanceModel


class AnalysisListItem(BaseModel):
    """Summary of a saved analysis for list views."""

    id: str
    filename: str
    file_type: str
    contract_type: str | None = None
    analysis_mode: str
    clause_count: int
    risk_high: int = 0
    risk_medium: int = 0
    risk_low: int = 0
    created_at: str


class SavedAnalysisResponse(BaseModel):
    """Full saved analysis with metadata.

    The ``provenance`` dict carries LLM call metadata for AI Act
    transparency. Stays optional (empty dict default) because rows
    persisted before SP-1 Phase 5 have no stored provenance — the
    router returns ``{}`` for those, and the frontend falls back to a
    ``legacyProvenance()`` placeholder.
    """

    id: str
    filename: str
    file_type: str
    page_count: int | None = None
    char_count: int | None = None
    contract_text: str
    overview: dict
    summary: dict
    clauses: list[dict]
    analysis_mode: str
    created_at: str
    updated_at: str | None = None
    provenance: dict = Field(default_factory=dict)
