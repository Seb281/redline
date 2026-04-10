"""Tests for the export endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _sample_request_body() -> dict:
    """Build a valid request body matching AnalyzeResponse shape."""
    return {
        "overview": {
            "contract_type": "Consulting Agreement",
            "parties": ["Company", "Consultant"],
            "effective_date": None,
            "duration": None,
            "total_value": None,
            "governing_jurisdiction": None,
            "key_terms": ["Non-compete"],
        },
        "summary": {
            "total_clauses": 1,
            "risk_breakdown": {"high": 1, "medium": 0, "low": 0},
            "top_risks": ["Non-compete is broad"],
        },
        "clauses": [
            {
                "clause_text": "You shall not compete.",
                "category": "non_compete",
                "title": "Non-Compete",
                "plain_english": "You cannot work for competitors.",
                "risk_level": "high",
                "risk_explanation": "Too broad.",
                "negotiation_suggestion": "Narrow the scope.",
                "is_unusual": True,
                "unusual_explanation": "Unusually broad geographic scope.",
            }
        ],
    }


def test_export_pdf_returns_pdf():
    """POST /api/export/pdf returns a PDF binary response."""
    response = client.post("/api/export/pdf", json=_sample_request_body())
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content[:5] == b"%PDF-"


def test_export_pdf_invalid_body():
    """POST /api/export/pdf with invalid body returns 422."""
    response = client.post("/api/export/pdf", json={"bad": "data"})
    assert response.status_code == 422
