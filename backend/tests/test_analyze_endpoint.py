"""Tests for the analyze endpoint."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import MOCK_ANALYSIS_RESPONSE, MOCK_EXTRACTION_RESPONSE

client = TestClient(app)


def _make_tool_response(tool_name: str, tool_input: dict) -> SimpleNamespace:
    """Build a mock Anthropic response with a tool_use content block."""
    return SimpleNamespace(
        content=[
            SimpleNamespace(type="tool_use", name=tool_name, input=tool_input)
        ]
    )


@patch("app.services.analyzer.client")
def test_analyze_returns_report(mock_client):
    """POST /api/analyze returns a structured analysis report."""
    mock_client.messages.create = AsyncMock(
        side_effect=[
            _make_tool_response("extract_clauses", MOCK_EXTRACTION_RESPONSE),
            _make_tool_response("analyze_clauses", MOCK_ANALYSIS_RESPONSE),
        ]
    )
    response = client.post(
        "/api/analyze",
        json={"text": "Full contract text here...", "think_hard": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "clauses" in data
    assert data["summary"]["total_clauses"] == 2
    assert len(data["clauses"]) == 2


@patch("app.services.analyzer.client")
def test_analyze_think_hard(mock_client):
    """POST /api/analyze with think_hard=true uses fan-out mode."""
    mock_client.messages.create = AsyncMock(
        side_effect=[
            _make_tool_response("extract_clauses", MOCK_EXTRACTION_RESPONSE),
            _make_tool_response("analyze_clause", MOCK_ANALYSIS_RESPONSE["clauses"][0]),
            _make_tool_response("analyze_clause", MOCK_ANALYSIS_RESPONSE["clauses"][1]),
        ]
    )
    response = client.post(
        "/api/analyze",
        json={"text": "Full contract text here...", "think_hard": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["total_clauses"] == 2


def test_analyze_empty_text():
    """POST /api/analyze with empty text returns 422."""
    response = client.post(
        "/api/analyze",
        json={"text": "", "think_hard": False},
    )
    assert response.status_code == 422
