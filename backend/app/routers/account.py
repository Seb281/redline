"""Account-level DSAR endpoints — SP-6.

Two endpoints fulfil the GDPR rights of access (Art 15) and erasure
(Art 17) without a manual round-trip to the operator:

- ``GET  /api/account/export`` returns a single JSON bundle with the
  authenticated user's row, every saved analysis (including
  expired-unpinned rows the history UI hides), and the active
  retention policy.
- ``DELETE /api/account`` typed-confirms the account email, cascades
  a hard delete across ``users`` (analyses, sessions, magic_links,
  clause_embeddings follow via ON DELETE CASCADE), inserts an
  anonymised aggregate stub into ``deleted_accounts``, clears the
  session cookie, and emails the user a receipt.

Both endpoints are rate-limited at 3/hour to keep brute-force and
automated scraping of the typed-confirm endpoint out of scope.
"""

import json
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db import get_db
from app.middleware import get_current_user
from app.schemas import (
    DataExportBundle,
    DeleteAccountRequest,
    SavedAnalysisResponse,
    UserExportInfo,
)
from app.services.email import send_account_deleted_email

router = APIRouter(prefix="/api/account", tags=["account"])
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)

EXPORT_SCHEMA_VERSION = 1


def _retention_days() -> int:
    """Return the retention window, mirroring the analyses router.

    Kept as a local helper rather than importing from
    ``routers.analyses`` so the DSAR surface stays independently
    testable.
    """

    raw = os.environ.get("RETENTION_DAYS", "30")
    try:
        parsed = int(raw)
    except ValueError:
        return 30
    return parsed if parsed > 0 else 30


def _isoformat(value: object) -> str | None:
    """Best-effort ISO serialisation for datetime columns.

    Returns ``None`` for missing values and passes strings through
    untouched so callers can feed JSONB-decoded timestamps in without
    a second round of parsing.
    """

    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _row_to_saved_analysis(row: dict) -> SavedAnalysisResponse:
    """Project a raw analyses row to the saved-analysis response shape.

    Duplicates the JSONB-decoding logic from
    ``routers.analyses.get_analysis`` — the export path needs every
    row the user owns (including expired-unpinned) and has to be able
    to serialise them on its own without going through the HTTP
    handler.
    """

    overview = row["overview"]
    if isinstance(overview, str):
        overview = json.loads(overview)

    summary = row["summary"]
    if isinstance(summary, str):
        summary = json.loads(summary)

    clauses = row["clauses"]
    if isinstance(clauses, str):
        clauses = json.loads(clauses)

    provenance: dict = {}
    raw_provenance = row["provenance"] if "provenance" in row.keys() else None
    if raw_provenance is not None:
        provenance = (
            json.loads(raw_provenance)
            if isinstance(raw_provenance, str)
            else raw_provenance
        )

    expires_at = _isoformat(row["expires_at"]) if "expires_at" in row.keys() else None
    pinned = bool(row["pinned"]) if "pinned" in row.keys() else False
    updated_at = _isoformat(row["updated_at"]) if "updated_at" in row.keys() else None

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
        created_at=_isoformat(row["created_at"]) or "",
        updated_at=updated_at,
        provenance=provenance,
        expires_at=expires_at,
        pinned=pinned,
    )


@router.get("/export")
@limiter.limit("3/hour")
async def export_account(request: Request) -> Response:
    """Export the authenticated user's full data set as downloadable JSON.

    The response carries a ``Content-Disposition: attachment`` header
    so browsers save the bundle straight to disk. Filename embeds the
    export date for humans.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    user_row = await db.fetch_one(
        "SELECT id, email, created_at, last_login_at FROM users WHERE id = :id",
        {"id": user["id"]},
    )
    if user_row is None:
        raise HTTPException(status_code=404, detail="User not found")

    rows = await db.fetch_all(
        """
        SELECT id, filename, file_type, page_count, char_count,
               contract_text, overview, summary, clauses, analysis_mode,
               provenance, created_at, updated_at, expires_at, pinned
        FROM analyses
        WHERE user_id = :user_id
        ORDER BY created_at DESC
        """,
        {"user_id": user["id"]},
    )

    analyses = [_row_to_saved_analysis(row) for row in rows]

    now = datetime.now(timezone.utc)
    bundle = DataExportBundle(
        schema_version=EXPORT_SCHEMA_VERSION,
        exported_at=now.isoformat(),
        user=UserExportInfo(
            id=str(user_row["id"]),
            email=user_row["email"],
            created_at=_isoformat(user_row["created_at"]) or "",
            last_login_at=_isoformat(user_row["last_login_at"]),
        ),
        analyses=analyses,
        retention_policy_days=_retention_days(),
    )

    filename = f"redline-export-{now.date().isoformat()}.json"
    return JSONResponse(
        content=bundle.model_dump(mode="json"),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("")
@limiter.limit("3/hour")
async def delete_account(
    body: DeleteAccountRequest, request: Request, response: Response
) -> dict:
    """Hard-delete the authenticated user and every row that cascades.

    Verifies the typed confirmation before doing anything destructive,
    inserts the anonymised aggregate stub, cascades the user row,
    clears the session cookie, and best-efforts a Resend receipt.
    Email failure is logged but never unwinds the delete — the user's
    Art 17 right takes precedence over our ability to send mail.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    user_row = await db.fetch_one(
        "SELECT id, email, created_at FROM users WHERE id = :id",
        {"id": user["id"]},
    )
    if user_row is None:
        raise HTTPException(status_code=404, detail="User not found")

    email = user_row["email"]
    if body.confirm.strip().lower() != email.strip().lower():
        raise HTTPException(
            status_code=400,
            detail="Confirmation does not match your email address",
        )

    # Aggregate stub — counts only, no PII.
    count_row = await db.fetch_one(
        "SELECT COUNT(*) AS n FROM analyses WHERE user_id = :user_id",
        {"user_id": user["id"]},
    )
    analyses_count = int(count_row["n"]) if count_row and count_row["n"] else 0

    created_at = user_row["created_at"]
    now = datetime.now(timezone.utc)
    if isinstance(created_at, datetime):
        age_days = max(0, (now - created_at).days)
    else:
        age_days = 0

    await db.execute(
        """
        INSERT INTO deleted_accounts
            (deleted_at, analyses_count, account_age_days)
        VALUES
            (:deleted_at, :analyses_count, :account_age_days)
        """,
        {
            "deleted_at": now,
            "analyses_count": analyses_count,
            "account_age_days": age_days,
        },
    )

    # Cascades: analyses, sessions, magic_links, clause_embeddings.
    await db.execute(
        "DELETE FROM users WHERE id = :id",
        {"id": user["id"]},
    )

    response.delete_cookie(
        key="session",
        httponly=True,
        secure=True,
        samesite="none",
    )

    try:
        await send_account_deleted_email(email)
    except Exception as exc:  # noqa: BLE001 — best-effort receipt
        logger.warning("Account deletion email failed: %s", exc)

    return {"message": "Account deleted"}
