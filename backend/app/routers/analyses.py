"""CRUD endpoints for saved contract analyses.

Retention (SP-5): saved analyses carry an ``expires_at`` timestamp
(default ``now() + RETENTION_DAYS``) and a ``pinned`` flag. The daily
prune job deletes rows where ``pinned = FALSE AND expires_at <=
now()``. Users can pin (never expire) or extend (reset the clock)
from the history UI.
"""

import json
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db import get_db
from app.middleware import get_current_user
from app.schemas import (
    AnalysisListItem,
    SaveAnalysisRequest,
    SavedAnalysisResponse,
    UpdateAnalysisRequest,
)

router = APIRouter(prefix="/api/analyses", tags=["analyses"])
limiter = Limiter(key_func=get_remote_address)


def _retention_days() -> int:
    """Read the retention window from the environment each call.

    Resolved per request so tests can monkeypatch ``RETENTION_DAYS``
    without re-importing the module. Falls back to 30 — the roadmap
    default — if the env var is missing or malformed.
    """

    raw = os.environ.get("RETENTION_DAYS", "30")
    try:
        parsed = int(raw)
    except ValueError:
        return 30
    return parsed if parsed > 0 else 30


def _default_expiry(now: datetime) -> datetime:
    """Return the expiry for a newly created analysis."""

    return now + timedelta(days=_retention_days())


@router.post("", status_code=201)
@limiter.limit("20/hour")
async def save_analysis(body: SaveAnalysisRequest, request: Request) -> dict:
    """Save a completed analysis for the authenticated user.

    Serialises overview, summary, and clauses as JSONB. Returns the
    generated analysis id. The row is created with
    ``pinned = FALSE`` and ``expires_at = now() + RETENTION_DAYS``;
    both can be changed later via PATCH / extend.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = _default_expiry(now)

    await db.execute(
        """
        INSERT INTO analyses
            (id, user_id, filename, file_type, page_count, char_count,
             contract_text, overview, summary, clauses, analysis_mode,
             provenance, created_at, expires_at, pinned)
        VALUES
            (:id, :user_id, :filename, :file_type, :page_count, :char_count,
             :contract_text, :overview, :summary, :clauses, :analysis_mode,
             :provenance, :created_at, :expires_at, FALSE)
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
            "provenance": json.dumps(body.provenance.model_dump()),
            "created_at": now,
            "expires_at": expires_at,
        },
    )

    return {"id": analysis_id}


@router.get("")
async def list_analyses(request: Request) -> list[AnalysisListItem]:
    """Return the authenticated user's active (non-expired) analyses.

    Pinned analyses are always included; unpinned analyses are
    included only when ``expires_at`` is still in the future. Results
    ordered by creation date (newest first). Risk counts and clause
    totals are computed from the stored clauses JSON.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    now = datetime.now(timezone.utc)
    rows = await db.fetch_all(
        """
        SELECT id, filename, file_type, overview, clauses, analysis_mode,
               created_at, expires_at, pinned
        FROM analyses
        WHERE user_id = :user_id
          AND (pinned = TRUE OR expires_at IS NULL OR expires_at > :now)
        ORDER BY created_at DESC
        """,
        {"user_id": user["id"], "now": now},
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

        expires_at = row["expires_at"]
        if isinstance(expires_at, datetime):
            expires_at = expires_at.isoformat()

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
                expires_at=expires_at,
                pinned=bool(row["pinned"]),
            )
        )

    return items


@router.get("/{analysis_id}")
async def get_analysis(analysis_id: str, request: Request) -> SavedAnalysisResponse:
    """Return the full saved analysis by id.

    Only the owner may access their own analysis. Expired, unpinned
    analyses are treated as deleted (404) — the row may physically
    still exist until the next prune run, but it should not be
    visible to the user.
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

    pinned = bool(row["pinned"]) if "pinned" in row.keys() else False
    raw_expires_at = row["expires_at"] if "expires_at" in row.keys() else None
    now = datetime.now(timezone.utc)
    if (
        not pinned
        and isinstance(raw_expires_at, datetime)
        and raw_expires_at <= now
    ):
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

    # Provenance may be absent on pre-migration rows (column default '{}').
    provenance: dict = {}
    try:
        raw_provenance = row["provenance"]
    except (KeyError, IndexError):
        raw_provenance = None
    if raw_provenance is not None:
        provenance = (
            json.loads(raw_provenance)
            if isinstance(raw_provenance, str)
            else raw_provenance
        )

    created_at = row["created_at"]
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()

    updated_at = row.get("updated_at") if hasattr(row, "get") else row["updated_at"] if "updated_at" in row else None
    if isinstance(updated_at, datetime):
        updated_at = updated_at.isoformat()

    expires_at: str | None = None
    if isinstance(raw_expires_at, datetime):
        expires_at = raw_expires_at.isoformat()

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
        provenance=provenance,
        expires_at=expires_at,
        pinned=pinned,
    )


@router.patch("/{analysis_id}")
async def update_analysis(
    analysis_id: str, body: UpdateAnalysisRequest, request: Request
) -> dict:
    """Update mutable fields on a saved analysis.

    Today only ``pinned`` is mutable — pin = never expire, unpin =
    resume countdown from the existing ``expires_at``. Returning the
    updated row keeps the UI in sync without a follow-up GET.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    row = await db.fetch_one(
        "SELECT user_id, expires_at, pinned FROM analyses WHERE id = :id",
        {"id": analysis_id},
    )
    if row is None or str(row["user_id"]) != user["id"]:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if body.pinned is None:
        # Nothing to change — treat as a no-op rather than an error so
        # PATCH remains idempotent-friendly.
        pinned = bool(row["pinned"])
        expires_at_raw = row["expires_at"]
    else:
        await db.execute(
            "UPDATE analyses SET pinned = :pinned, updated_at = :now WHERE id = :id",
            {
                "pinned": body.pinned,
                "now": datetime.now(timezone.utc),
                "id": analysis_id,
            },
        )
        pinned = body.pinned
        expires_at_raw = row["expires_at"]

    expires_at_iso: str | None = None
    if isinstance(expires_at_raw, datetime):
        expires_at_iso = expires_at_raw.isoformat()

    return {"id": analysis_id, "pinned": pinned, "expires_at": expires_at_iso}


@router.post("/{analysis_id}/extend")
async def extend_analysis(analysis_id: str, request: Request) -> dict:
    """Reset the retention clock to ``now() + RETENTION_DAYS``.

    Intended for an in-place "keep this for another 30 days" button on
    the history page. No-op on pinned analyses — they already don't
    expire — but we still return the current state so the UI stays
    consistent.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    row = await db.fetch_one(
        "SELECT user_id, pinned FROM analyses WHERE id = :id",
        {"id": analysis_id},
    )
    if row is None or str(row["user_id"]) != user["id"]:
        raise HTTPException(status_code=404, detail="Analysis not found")

    now = datetime.now(timezone.utc)
    new_expires_at = _default_expiry(now)

    await db.execute(
        "UPDATE analyses SET expires_at = :expires_at, updated_at = :now WHERE id = :id",
        {"expires_at": new_expires_at, "now": now, "id": analysis_id},
    )

    return {
        "id": analysis_id,
        "pinned": bool(row["pinned"]),
        "expires_at": new_expires_at.isoformat(),
    }


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
