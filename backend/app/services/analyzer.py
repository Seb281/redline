"""LLM pipeline orchestration — clause extraction and analysis."""

import asyncio
import json
import os

from anthropic import AsyncAnthropic

from app.prompts.analyze import (
    ANALYSIS_BATCH_TOOL,
    ANALYSIS_BATCH_USER_PROMPT,
    ANALYSIS_SINGLE_TOOL,
    ANALYSIS_SINGLE_USER_PROMPT,
    ANALYSIS_SYSTEM_PROMPT,
)
from app.prompts.extract import (
    EXTRACTION_SYSTEM_PROMPT,
    EXTRACTION_TOOL,
    EXTRACTION_USER_PROMPT,
)
from app.prompts.overview import (
    OVERVIEW_SYSTEM_PROMPT,
    OVERVIEW_TOOL,
    OVERVIEW_USER_PROMPT,
)
from app.schemas import (
    AnalyzedClause,
    AnalyzeResponse,
    AnalysisSummary,
    ContractOverview,
    ExtractedClause,
    RiskBreakdown,
    RiskLevel,
)

client = AsyncAnthropic()
MODEL = os.environ.get("LLM_MODEL", "claude-sonnet-4-20250514")
DEFAULT_TIMEOUT = 60.0
FAN_OUT_TIMEOUT = 30.0


async def extract_overview(text: str) -> ContractOverview:
    """Pass 0: Extract high-level contract metadata."""
    response = await asyncio.wait_for(
        client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=OVERVIEW_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": OVERVIEW_USER_PROMPT.format(contract_text=text),
                }
            ],
            tools=[OVERVIEW_TOOL],
            tool_choice={"type": "tool", "name": "extract_overview"},
        ),
        timeout=DEFAULT_TIMEOUT,
    )
    tool_block = next(b for b in response.content if b.type == "tool_use")
    return ContractOverview(**tool_block.input)


async def extract_clauses(text: str) -> list[ExtractedClause]:
    """Pass 1: Send full contract text, get back structured clause list."""
    response = await asyncio.wait_for(
        client.messages.create(
            model=MODEL,
            max_tokens=8192,
            system=EXTRACTION_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": EXTRACTION_USER_PROMPT.format(contract_text=text),
                }
            ],
            tools=[EXTRACTION_TOOL],
            tool_choice={"type": "tool", "name": "extract_clauses"},
        ),
        timeout=DEFAULT_TIMEOUT,
    )
    tool_block = next(b for b in response.content if b.type == "tool_use")
    return [ExtractedClause(**clause) for clause in tool_block.input["clauses"]]


async def _analyze_batch(clauses: list[ExtractedClause]) -> list[AnalyzedClause]:
    """Pass 2 (default): Analyze all clauses in a single LLM call."""
    clauses_json = json.dumps(
        [clause.model_dump() for clause in clauses], indent=2
    )
    response = await asyncio.wait_for(
        client.messages.create(
            model=MODEL,
            max_tokens=8192,
            system=ANALYSIS_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": ANALYSIS_BATCH_USER_PROMPT.format(
                        clauses_json=clauses_json
                    ),
                }
            ],
            tools=[ANALYSIS_BATCH_TOOL],
            tool_choice={"type": "tool", "name": "analyze_clauses"},
        ),
        timeout=DEFAULT_TIMEOUT,
    )
    tool_block = next(b for b in response.content if b.type == "tool_use")
    return [AnalyzedClause(**clause) for clause in tool_block.input["clauses"]]


async def _analyze_single(clause: ExtractedClause) -> AnalyzedClause:
    """Analyze a single clause (used in fan-out mode)."""
    clause_json = json.dumps(clause.model_dump(), indent=2)
    response = await asyncio.wait_for(
        client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=ANALYSIS_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": ANALYSIS_SINGLE_USER_PROMPT.format(
                        clause_json=clause_json
                    ),
                }
            ],
            tools=[ANALYSIS_SINGLE_TOOL],
            tool_choice={"type": "tool", "name": "analyze_clause"},
        ),
        timeout=FAN_OUT_TIMEOUT,
    )
    tool_block = next(b for b in response.content if b.type == "tool_use")
    return AnalyzedClause(**tool_block.input)


async def _analyze_fan_out(clauses: list[ExtractedClause]) -> list[AnalyzedClause]:
    """Pass 2 (think hard): Analyze each clause individually in parallel."""
    tasks = [_analyze_single(clause) for clause in clauses]
    return list(await asyncio.gather(*tasks))


def build_summary(clauses: list[AnalyzedClause]) -> AnalysisSummary:
    """Build summary statistics from analyzed clauses."""
    breakdown = RiskBreakdown(
        high=sum(1 for c in clauses if c.risk_level == RiskLevel.HIGH),
        medium=sum(1 for c in clauses if c.risk_level == RiskLevel.MEDIUM),
        low=sum(1 for c in clauses if c.risk_level == RiskLevel.LOW),
    )
    top_risks = [
        f"{c.title}: {c.risk_explanation}"
        for c in clauses
        if c.risk_level == RiskLevel.HIGH
    ]
    return AnalysisSummary(
        total_clauses=len(clauses),
        risk_breakdown=breakdown,
        top_risks=top_risks,
    )


async def analyze_contract(text: str, think_hard: bool = False) -> AnalyzeResponse:
    """Full pipeline: overview, extract clauses, analyze them, build summary."""
    overview = await extract_overview(text)
    extracted = await extract_clauses(text)

    if think_hard:
        analyzed = await _analyze_fan_out(extracted)
    else:
        analyzed = await _analyze_batch(extracted)

    summary = build_summary(analyzed)
    return AnalyzeResponse(overview=overview, summary=summary, clauses=analyzed)
