"""Tests for the analyzer service with mocked Anthropic API."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas import AnalyzeResponse, ContractOverview, ExtractedClause, RiskLevel
from app.services.analyzer import (
    analyze_contract,
    build_summary,
    extract_clauses,
    extract_overview,
)
from tests.conftest import (
    MOCK_ANALYSIS_RESPONSE,
    MOCK_EXTRACTION_RESPONSE,
    MOCK_OVERVIEW_RESPONSE,
    MOCK_SINGLE_ANALYSIS_RESPONSE,
)


def _make_tool_response(tool_name: str, tool_input: dict) -> SimpleNamespace:
    """Build a mock Anthropic response with a tool_use content block."""
    return SimpleNamespace(
        content=[
            SimpleNamespace(type="tool_use", name=tool_name, input=tool_input)
        ]
    )


@pytest.mark.asyncio
@patch("app.services.analyzer.client")
async def test_extract_overview(mock_client):
    """extract_overview returns parsed ContractOverview from LLM response."""
    mock_client.messages.create = AsyncMock(
        return_value=_make_tool_response("extract_overview", MOCK_OVERVIEW_RESPONSE)
    )
    result = await extract_overview("Some contract text")
    assert isinstance(result, ContractOverview)
    assert result.contract_type == "Consulting Agreement"
    assert len(result.parties) == 2
    assert len(result.key_terms) == 2


@pytest.mark.asyncio
@patch("app.services.analyzer.client")
async def test_extract_clauses(mock_client):
    """extract_clauses returns parsed ExtractedClause list from LLM response."""
    mock_client.messages.create = AsyncMock(
        return_value=_make_tool_response("extract_clauses", MOCK_EXTRACTION_RESPONSE)
    )
    result = await extract_clauses("Some contract text")
    assert len(result) == 2
    assert isinstance(result[0], ExtractedClause)
    assert "competitor" in result[0].clause_text.lower()


@pytest.mark.asyncio
@patch("app.services.analyzer.client")
async def test_analyze_contract_default_mode(mock_client):
    """analyze_contract in default mode returns a valid AnalyzeResponse."""
    mock_client.messages.create = AsyncMock(
        side_effect=[
            _make_tool_response("extract_overview", MOCK_OVERVIEW_RESPONSE),
            _make_tool_response("extract_clauses", MOCK_EXTRACTION_RESPONSE),
            _make_tool_response("analyze_clauses", MOCK_ANALYSIS_RESPONSE),
        ]
    )
    result = await analyze_contract("Some contract text", think_hard=False)
    assert isinstance(result, AnalyzeResponse)
    assert result.overview.contract_type == "Consulting Agreement"
    assert result.summary.total_clauses == 2
    assert result.summary.risk_breakdown.high == 1
    assert result.summary.risk_breakdown.low == 1
    assert len(result.clauses) == 2
    assert result.clauses[0].is_unusual is True
    assert result.clauses[1].is_unusual is False


@pytest.mark.asyncio
@patch("app.services.analyzer.client")
async def test_analyze_contract_think_hard_mode(mock_client):
    """analyze_contract in think_hard mode fans out to per-clause calls."""
    mock_client.messages.create = AsyncMock(
        side_effect=[
            _make_tool_response("extract_overview", MOCK_OVERVIEW_RESPONSE),
            _make_tool_response("extract_clauses", MOCK_EXTRACTION_RESPONSE),
            _make_tool_response("analyze_clause", MOCK_SINGLE_ANALYSIS_RESPONSE),
            _make_tool_response("analyze_clause", {
                "clause_text": "This Agreement shall be governed by the laws of the State of Delaware.",
                "category": "governing_law",
                "title": "Governing Law",
                "plain_english": "Delaware law applies.",
                "risk_level": "low",
                "risk_explanation": "Standard clause.",
                "negotiation_suggestion": None,
                "is_unusual": False,
                "unusual_explanation": None,
            }),
        ]
    )
    result = await analyze_contract("Some contract text", think_hard=True)
    assert isinstance(result, AnalyzeResponse)
    assert result.overview.contract_type == "Consulting Agreement"
    assert result.summary.total_clauses == 2
    assert mock_client.messages.create.call_count == 4  # 1 overview + 1 extract + 2 analyze


def test_build_summary(sample_analyzed_clauses):
    """build_summary produces correct risk breakdown and top risks."""
    summary = build_summary(sample_analyzed_clauses)
    assert summary.total_clauses == 2
    assert summary.risk_breakdown.high == 1
    assert summary.risk_breakdown.medium == 0
    assert summary.risk_breakdown.low == 1
    assert len(summary.top_risks) == 1
    assert "Non-Compete" in summary.top_risks[0]
