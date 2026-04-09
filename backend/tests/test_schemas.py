"""Tests for Pydantic request/response schemas."""

import pytest
from pydantic import ValidationError

from app.schemas import (
    AnalyzedClause,
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisSummary,
    ClauseCategory,
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


def test_risk_breakdown_rejects_negative():
    """RiskBreakdown rejects negative counts."""
    with pytest.raises(ValidationError):
        RiskBreakdown(high=-1, medium=0, low=0)
