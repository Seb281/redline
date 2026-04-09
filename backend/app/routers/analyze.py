"""Analyze endpoint — runs LLM pipeline on extracted contract text."""

from fastapi import APIRouter, HTTPException

from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.analyzer import analyze_contract

router = APIRouter()


@router.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """Run clause extraction and risk analysis on contract text."""
    if not request.text.strip():
        raise HTTPException(status_code=422, detail="Contract text is empty.")

    return await analyze_contract(request.text, think_hard=request.think_hard)
