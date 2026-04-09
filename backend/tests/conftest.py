"""Shared test fixtures for Redline backend tests."""

from io import BytesIO

import pytest
from docx import Document
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.schemas import AnalyzedClause, ClauseCategory, RiskLevel


SAMPLE_CONTRACT_TEXT = (
    "CONSULTING AGREEMENT\n\n"
    "1. NON-COMPETE\n"
    "The Consultant agrees not to work for any competitor "
    "within Europe for a period of 2 years after termination.\n\n"
    "2. GOVERNING LAW\n"
    "This Agreement shall be governed by the laws of the State of Delaware."
)


@pytest.fixture
def sample_pdf_bytes() -> bytes:
    """Generate a minimal PDF with sample contract text."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    y = 720
    for line in SAMPLE_CONTRACT_TEXT.split("\n"):
        c.drawString(72, y, line)
        y -= 18
    c.showPage()
    c.save()
    return buffer.getvalue()


@pytest.fixture
def sample_docx_bytes() -> bytes:
    """Generate a minimal DOCX with sample contract text."""
    doc = Document()
    for paragraph in SAMPLE_CONTRACT_TEXT.split("\n"):
        if paragraph.strip():
            doc.add_paragraph(paragraph)
    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


@pytest.fixture
def empty_pdf_bytes() -> bytes:
    """Generate a PDF with no text content."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.showPage()
    c.save()
    return buffer.getvalue()


MOCK_EXTRACTION_RESPONSE = {
    "clauses": [
        {
            "clause_text": "The Consultant agrees not to work for any competitor within Europe for a period of 2 years after termination.",
            "section_reference": "Section 1",
        },
        {
            "clause_text": "This Agreement shall be governed by the laws of the State of Delaware.",
            "section_reference": "Section 2",
        },
    ]
}

MOCK_ANALYSIS_RESPONSE = {
    "clauses": [
        {
            "clause_text": "The Consultant agrees not to work for any competitor within Europe for a period of 2 years after termination.",
            "category": "non_compete",
            "title": "Non-Compete Restriction",
            "plain_english": "You cannot work for competitors in Europe for 2 years after leaving.",
            "risk_level": "high",
            "risk_explanation": "2-year duration and Europe-wide scope is unusually broad.",
            "negotiation_suggestion": "Request reduction to 6 months and limit to your city.",
        },
        {
            "clause_text": "This Agreement shall be governed by the laws of the State of Delaware.",
            "category": "governing_law",
            "title": "Governing Law",
            "plain_english": "Delaware law applies to this contract.",
            "risk_level": "low",
            "risk_explanation": "Standard governing law clause. Delaware is a common and neutral choice.",
            "negotiation_suggestion": None,
        },
    ]
}

MOCK_SINGLE_ANALYSIS_RESPONSE = {
    "clause_text": "The Consultant agrees not to work for any competitor within Europe for a period of 2 years after termination.",
    "category": "non_compete",
    "title": "Non-Compete Restriction",
    "plain_english": "You cannot work for competitors in Europe for 2 years after leaving.",
    "risk_level": "high",
    "risk_explanation": "2-year duration and Europe-wide scope is unusually broad.",
    "negotiation_suggestion": "Request reduction to 6 months and limit to your city.",
}


@pytest.fixture
def mock_extraction_response():
    """Mock Anthropic API response for clause extraction."""
    return MOCK_EXTRACTION_RESPONSE


@pytest.fixture
def mock_analysis_response():
    """Mock Anthropic API response for batch clause analysis."""
    return MOCK_ANALYSIS_RESPONSE


@pytest.fixture
def sample_analyzed_clauses() -> list[AnalyzedClause]:
    """Pre-built analyzed clauses for testing."""
    return [
        AnalyzedClause(
            clause_text="The Consultant agrees not to work for any competitor within Europe for a period of 2 years after termination.",
            category=ClauseCategory.NON_COMPETE,
            title="Non-Compete Restriction",
            plain_english="You cannot work for competitors in Europe for 2 years after leaving.",
            risk_level=RiskLevel.HIGH,
            risk_explanation="2-year duration and Europe-wide scope is unusually broad.",
            negotiation_suggestion="Request reduction to 6 months and limit to your city.",
        ),
        AnalyzedClause(
            clause_text="This Agreement shall be governed by the laws of the State of Delaware.",
            category=ClauseCategory.GOVERNING_LAW,
            title="Governing Law",
            plain_english="Delaware law applies to this contract.",
            risk_level=RiskLevel.LOW,
            risk_explanation="Standard governing law clause.",
            negotiation_suggestion=None,
        ),
    ]
