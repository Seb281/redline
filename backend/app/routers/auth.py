"""Auth endpoints — magic link login, verify, logout, current user."""

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, Response

from app.db import get_db
from app.middleware import get_current_user
from app.schemas import LoginRequest, UserResponse, VerifyRequest
from app.services.auth import (
    MAGIC_LINK_EXPIRY_MINUTES,
    SESSION_MAX_AGE_DAYS,
    generate_token,
    hash_token,
)
from app.services.email import send_magic_link_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")


@router.post("/login")
async def login(body: LoginRequest, request: Request) -> dict:
    """Send a magic link to the user's email.

    Creates the user if they don't exist. Generates a one-time token,
    stores its hash, and sends the login link via email.
    """
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    # Upsert user
    user = await db.fetch_one(
        "SELECT id FROM users WHERE email = :email",
        {"email": body.email},
    )

    if user is None:
        user = await db.fetch_one(
            "INSERT INTO users (email) VALUES (:email) RETURNING id",
            {"email": body.email},
        )

    user_id = str(user["id"])

    # Generate and store magic link
    token = generate_token()
    token_hash = hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=MAGIC_LINK_EXPIRY_MINUTES)

    await db.execute(
        """
        INSERT INTO magic_links (user_id, token_hash, expires_at)
        VALUES (:user_id, :token_hash, :expires_at)
        """,
        {"user_id": user_id, "token_hash": token_hash, "expires_at": expires_at},
    )

    # Send email
    magic_link_url = f"{FRONTEND_URL}/auth/verify?token={token}"
    await send_magic_link_email(body.email, magic_link_url)

    return {"message": "Check your inbox"}


@router.post("/verify")
async def verify(body: VerifyRequest, response: Response) -> UserResponse:
    """Verify a magic link token and create a session.

    Validates the token hash, checks expiry and single-use, then sets
    an HttpOnly session cookie.
    """
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    token_hash = hash_token(body.token)
    now = datetime.now(timezone.utc)

    # Find magic link by hash
    link = await db.fetch_one(
        """
        SELECT id, user_id, expires_at, used_at
        FROM magic_links
        WHERE token_hash = :token_hash
        """,
        {"token_hash": token_hash},
    )

    if link is None:
        raise HTTPException(status_code=401, detail="Invalid or expired link")

    if link["used_at"] is not None:
        raise HTTPException(status_code=401, detail="Link already used")

    if link["expires_at"] < now:
        raise HTTPException(status_code=401, detail="Link expired")

    # Mark as used
    await db.execute(
        "UPDATE magic_links SET used_at = :now WHERE id = :id",
        {"now": now, "id": link["id"]},
    )

    # Create session
    session_token = generate_token()
    session_hash = hash_token(session_token)
    session_expiry = now + timedelta(days=SESSION_MAX_AGE_DAYS)

    await db.execute(
        """
        INSERT INTO sessions (user_id, token_hash, expires_at)
        VALUES (:user_id, :token_hash, :expires_at)
        """,
        {
            "user_id": str(link["user_id"]),
            "token_hash": session_hash,
            "expires_at": session_expiry,
        },
    )

    # Set cookie
    response.set_cookie(
        key="session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
    )

    # Get user info
    user = await db.fetch_one(
        "SELECT id, email FROM users WHERE id = :id",
        {"id": str(link["user_id"])},
    )

    return UserResponse(id=str(user["id"]), email=user["email"])


@router.get("/me")
async def me(request: Request) -> UserResponse:
    """Return the current authenticated user, or 401 if not logged in."""
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return UserResponse(id=user["id"], email=user["email"])


@router.post("/logout")
async def logout(request: Request, response: Response) -> dict:
    """Clear the session cookie and delete the server-side session."""
    session_token = request.cookies.get("session")

    if session_token:
        db = get_db()
        if db is not None:
            token_hash = hash_token(session_token)
            await db.execute(
                "DELETE FROM sessions WHERE token_hash = :token_hash",
                {"token_hash": token_hash},
            )

    response.delete_cookie(
        key="session",
        httponly=True,
        secure=True,
        samesite="none",
    )
    return {"message": "Logged out"}
