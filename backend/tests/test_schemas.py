"""Tests for Pydantic request/response schemas."""

import pytest
from pydantic import ValidationError

from app.schemas import (
    AnalyzedClause,
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisSummary,
    ClauseCategory,
    ContractOverview,
    ExtractedClause,
    RiskBreakdown,
    RiskLevel,
    UploadResponse,
)


def test_upload_response_valid():
    """UploadResponse accepts valid data."""
    data = UploadResponse(
        filename="test.pdf",
        file_type="pdf",
        page_count=3,
        extracted_text="Some contract text here that is long enough.",
        char_count=45,
    )
    assert data.filename == "test.pdf"
    assert data.file_type == "pdf"


def test_upload_response_rejects_invalid_file_type():
    """UploadResponse rejects unsupported file types."""
    with pytest.raises(ValidationError):
        UploadResponse(
            filename="test.txt",
            file_type="txt",
            page_count=1,
            extracted_text="text",
            char_count=4,
        )


def test_analyze_request_defaults():
    """AnalyzeRequest defaults think_hard to False."""
    req = AnalyzeRequest(text="Some contract text")
    assert req.think_hard is False


def test_extracted_clause_optional_section():
    """ExtractedClause allows missing section_reference."""
    clause = ExtractedClause(clause_text="The consultant agrees...")
    assert clause.section_reference is None


def test_analyzed_clause_valid():
    """AnalyzedClause accepts a fully populated clause."""
    clause = AnalyzedClause(
        clause_text="The consultant agrees not to compete...",
        category=ClauseCategory.NON_COMPETE,
        title="Non-Compete Restriction",
        plain_english="You cannot work for competitors for 2 years.",
        risk_level=RiskLevel.HIGH,
        risk_explanation="2-year duration is unusually broad.",
        negotiation_suggestion="Request reduction to 6 months.",
    )
    assert clause.risk_level == RiskLevel.HIGH
    assert clause.negotiation_suggestion is not None


def test_analyzed_clause_low_risk_no_suggestion():
    """Low-risk clauses can omit negotiation_suggestion."""
    clause = AnalyzedClause(
        clause_text="This agreement is governed by Delaware law.",
        category=ClauseCategory.GOVERNING_LAW,
        title="Governing Law",
        plain_english="Delaware law applies.",
        risk_level=RiskLevel.LOW,
        risk_explanation="Standard governing law clause.",
        negotiation_suggestion=None,
    )
    assert clause.negotiation_suggestion is None


def test_analyze_response_complete():
    """AnalyzeResponse accepts a full report structure."""
    response = AnalyzeResponse(
        overview=ContractOverview(
            contract_type="Consulting Agreement",
            parties=["Acme Corp", "Consultant"],
            effective_date=None,
            duration=None,
            total_value=None,
            governing_jurisdiction="Delaware",
            key_terms=["Non-compete", "Governing law"],
        ),
        summary=AnalysisSummary(
            total_clauses=2,
            risk_breakdown=RiskBreakdown(high=1, medium=0, low=1),
            top_risks=["Non-compete is unusually broad"],
        ),
        clauses=[
            AnalyzedClause(
                clause_text="Non-compete clause text",
                category=ClauseCategory.NON_COMPETE,
                title="Non-Compete",
                plain_english="You cannot compete.",
                risk_level=RiskLevel.HIGH,
                risk_explanation="Too broad.",
                negotiation_suggestion="Negotiate down.",
            ),
            AnalyzedClause(
                clause_text="Governing law clause text",
                category=ClauseCategory.GOVERNING_LAW,
                title="Governing Law",
                plain_english="Delaware law.",
                risk_level=RiskLevel.LOW,
                risk_explanation="Standard.",
                negotiation_suggestion=None,
            ),
        ],
    )
    assert response.summary.total_clauses == 2
    assert len(response.clauses) == 2
    assert response.overview.contract_type == "Consulting Agreement"


def test_risk_breakdown_rejects_negative():
    """RiskBreakdown rejects negative counts."""
    with pytest.raises(ValidationError):
        RiskBreakdown(high=-1, medium=0, low=0)


def test_contract_overview_valid():
    """ContractOverview accepts fully populated data."""
    overview = ContractOverview(
        contract_type="Freelance Services Agreement",
        parties=["Acme Corp", "Jane Doe"],
        effective_date="2026-01-15",
        duration="12 months",
        total_value="$120,000",
        governing_jurisdiction="State of California",
        key_terms=[
            "Non-compete clause for 2 years",
            "IP assignment of all deliverables",
            "Net-60 payment terms",
        ],
    )
    assert overview.contract_type == "Freelance Services Agreement"
    assert len(overview.parties) == 2
    assert len(overview.key_terms) == 3


def test_contract_overview_nullable_fields():
    """ContractOverview allows null optional fields."""
    overview = ContractOverview(
        contract_type="NDA",
        parties=["Company A", "Company B"],
        effective_date=None,
        duration=None,
        total_value=None,
        governing_jurisdiction=None,
        key_terms=["Mutual confidentiality obligations"],
    )
    assert overview.effective_date is None
    assert overview.total_value is None


def test_analyzed_clause_with_unusual_fields():
    """AnalyzedClause accepts is_unusual and unusual_explanation."""
    clause = AnalyzedClause(
        clause_text="The consultant assigns all IP including pre-existing work.",
        category=ClauseCategory.IP_ASSIGNMENT,
        title="Broad IP Assignment",
        plain_english="You give up all IP, even work you did before this contract.",
        risk_level=RiskLevel.HIGH,
        risk_explanation="Covers pre-existing IP which is unusually aggressive.",
        negotiation_suggestion="Limit to deliverables created during engagement.",
        is_unusual=True,
        unusual_explanation="Most IP clauses only cover work created during the engagement, not pre-existing IP.",
    )
    assert clause.is_unusual is True
    assert clause.unusual_explanation is not None


def test_analyzed_clause_unusual_defaults_to_false():
    """AnalyzedClause defaults is_unusual to False for backward compatibility."""
    clause = AnalyzedClause(
        clause_text="Delaware law applies.",
        category=ClauseCategory.GOVERNING_LAW,
        title="Governing Law",
        plain_english="Delaware law applies.",
        risk_level=RiskLevel.LOW,
        risk_explanation="Standard clause.",
        negotiation_suggestion=None,
    )
    assert clause.is_unusual is False
    assert clause.unusual_explanation is None


def test_analyze_response_with_overview():
    """AnalyzeResponse includes the contract overview."""
    response = AnalyzeResponse(
        overview=ContractOverview(
            contract_type="Services Agreement",
            parties=["Acme Corp", "Jane Doe"],
            effective_date="2026-01-15",
            duration="12 months",
            total_value="$120,000",
            governing_jurisdiction="State of Delaware",
            key_terms=["Non-compete", "IP assignment"],
        ),
        summary=AnalysisSummary(
            total_clauses=1,
            risk_breakdown=RiskBreakdown(high=0, medium=0, low=1),
            top_risks=[],
        ),
        clauses=[
            AnalyzedClause(
                clause_text="Delaware law applies.",
                category=ClauseCategory.GOVERNING_LAW,
                title="Governing Law",
                plain_english="Delaware law applies.",
                risk_level=RiskLevel.LOW,
                risk_explanation="Standard.",
                negotiation_suggestion=None,
            ),
        ],
    )
    assert response.overview.contract_type == "Services Agreement"
    assert len(response.overview.parties) == 2
