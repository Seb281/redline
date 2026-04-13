"""Request middleware for session-based authentication."""

from datetime import datetime, timedelta, timezone

from fastapi import Request

from app.db import get_db
from app.services.auth import hash_token, SESSION_MAX_AGE_DAYS


async def get_current_user(request: Request) -> dict | None:
    """Extract and validate session from cookie.

    Returns user dict {id, email} if valid session exists, None otherwise.
    Extends session expiry on each valid request (sliding window).
    """
    db = get_db()
    if db is None:
        return None

    session_token = request.cookies.get("session")
    if not session_token:
        return None

    token_hash = hash_token(session_token)
    now = datetime.now(timezone.utc)

    row = await db.fetch_one(
        """
        SELECT s.id AS session_id, s.user_id, u.email
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = :token_hash AND s.expires_at > :now
        """,
        {"token_hash": token_hash, "now": now},
    )

    if row is None:
        return None

    # Sliding window — extend session expiry
    new_expiry = now + timedelta(days=SESSION_MAX_AGE_DAYS)
    await db.execute(
        "UPDATE sessions SET expires_at = :expires_at WHERE id = :id",
        {"expires_at": new_expiry, "id": row["session_id"]},
    )

    # Update last login timestamp
    await db.execute(
        "UPDATE users SET last_login_at = :now WHERE id = :id",
        {"now": now, "id": row["user_id"]},
    )

    return {"id": str(row["user_id"]), "email": row["email"]}
