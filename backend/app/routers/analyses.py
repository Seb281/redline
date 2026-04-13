"""CRUD endpoints for saved contract analyses."""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from app.db import get_db
from app.middleware import get_current_user
from app.schemas import AnalysisListItem, SaveAnalysisRequest, SavedAnalysisResponse

router = APIRouter(prefix="/api/analyses", tags=["analyses"])


@router.post("", status_code=201)
async def save_analysis(body: SaveAnalysisRequest, request: Request) -> dict:
    """Save a completed analysis for the authenticated user.

    Serialises overview, summary, and clauses as JSONB. Returns the
    generated analysis id.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    await db.execute(
        """
        INSERT INTO analyses
            (id, user_id, filename, file_type, page_count, char_count,
             contract_text, overview, summary, clauses, analysis_mode, created_at)
        VALUES
            (:id, :user_id, :filename, :file_type, :page_count, :char_count,
             :contract_text, :overview, :summary, :clauses, :analysis_mode, :created_at)
        """,
        {
            "id": analysis_id,
            "user_id": user["id"],
            "filename": body.filename,
            "file_type": body.file_type,
            "page_count": body.page_count,
            "char_count": body.char_count,
            "contract_text": body.contract_text,
            "overview": json.dumps(body.overview),
            "summary": json.dumps(body.summary),
            "clauses": json.dumps(body.clauses),
            "analysis_mode": body.analysis_mode,
            "created_at": now,
        },
    )

    return {"id": analysis_id}


@router.get("")
async def list_analyses(request: Request) -> list[AnalysisListItem]:
    """Return all analyses belonging to the authenticated user.

    Results are ordered by creation date (newest first). Risk counts and
    clause totals are computed from the stored clauses JSON.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    rows = await db.fetch_all(
        """
        SELECT id, filename, file_type, overview, clauses, analysis_mode, created_at
        FROM analyses
        WHERE user_id = :user_id
        ORDER BY created_at DESC
        """,
        {"user_id": user["id"]},
    )

    items: list[AnalysisListItem] = []
    for row in rows:
        overview = row["overview"]
        if isinstance(overview, str):
            overview = json.loads(overview)

        clauses = row["clauses"]
        if isinstance(clauses, str):
            clauses = json.loads(clauses)

        risk_high = sum(1 for c in clauses if c.get("risk_level") == "high")
        risk_medium = sum(1 for c in clauses if c.get("risk_level") == "medium")
        risk_low = sum(1 for c in clauses if c.get("risk_level") == "low")

        created_at = row["created_at"]
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()

        items.append(
            AnalysisListItem(
                id=str(row["id"]),
                filename=row["filename"],
                file_type=row["file_type"],
                contract_type=overview.get("contract_type"),
                analysis_mode=row["analysis_mode"],
                clause_count=len(clauses),
                risk_high=risk_high,
                risk_medium=risk_medium,
                risk_low=risk_low,
                created_at=created_at,
            )
        )

    return items


@router.get("/{analysis_id}")
async def get_analysis(analysis_id: str, request: Request) -> SavedAnalysisResponse:
    """Return the full saved analysis by id.

    Only the owner may access their own analysis. Returns 404 if the
    analysis does not exist or belongs to another user.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    row = await db.fetch_one(
        "SELECT * FROM analyses WHERE id = :id",
        {"id": analysis_id},
    )

    if row is None or str(row["user_id"]) != user["id"]:
        raise HTTPException(status_code=404, detail="Analysis not found")

    overview = row["overview"]
    if isinstance(overview, str):
        overview = json.loads(overview)

    summary = row["summary"]
    if isinstance(summary, str):
        summary = json.loads(summary)

    clauses = row["clauses"]
    if isinstance(clauses, str):
        clauses = json.loads(clauses)

    created_at = row["created_at"]
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()

    updated_at = row.get("updated_at") if hasattr(row, "get") else row["updated_at"] if "updated_at" in row else None
    if isinstance(updated_at, datetime):
        updated_at = updated_at.isoformat()

    return SavedAnalysisResponse(
        id=str(row["id"]),
        filename=row["filename"],
        file_type=row["file_type"],
        page_count=row["page_count"],
        char_count=row["char_count"],
        contract_text=row["contract_text"],
        overview=overview,
        summary=summary,
        clauses=clauses,
        analysis_mode=row["analysis_mode"],
        created_at=created_at,
        updated_at=updated_at,
    )


@router.delete("/{analysis_id}")
async def delete_analysis(analysis_id: str, request: Request) -> dict:
    """Delete a saved analysis by id.

    Only the owner may delete their own analysis. Returns 404 if the
    analysis does not exist or belongs to another user.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    row = await db.fetch_one(
        "SELECT user_id FROM analyses WHERE id = :id",
        {"id": analysis_id},
    )

    if row is None or str(row["user_id"]) != user["id"]:
        raise HTTPException(status_code=404, detail="Analysis not found")

    await db.execute(
        "DELETE FROM analyses WHERE id = :id",
        {"id": analysis_id},
    )

    return {"message": "Analysis deleted"}
