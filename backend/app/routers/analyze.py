"""Analyze endpoint — runs LLM pipeline on extracted contract text."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.analyzer import analyze_contract

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """Run clause extraction and risk analysis on contract text."""
    if not request.text.strip():
        raise HTTPException(status_code=422, detail="Contract text is empty.")

    try:
        return await analyze_contract(request.text, think_hard=request.think_hard)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Analysis timed out. Try a shorter contract or disable Think Hard mode.")
    except ValueError as exc:
        logger.error("Analysis pipeline error: %s", exc)
        raise HTTPException(status_code=502, detail="Analysis failed — the LLM returned an unexpected response.")
    except Exception as exc:
        logger.exception("Unexpected error during analysis")
        raise HTTPException(status_code=500, detail="An unexpected error occurred during analysis.")
