"""Tests for auth endpoints — login, verify, logout, current user."""

import sys
from datetime import datetime, timedelta, timezone
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock, patch

# Stub weasyprint before any app imports so tests run without native libs
if "weasyprint" not in sys.modules:
    _wp = ModuleType("weasyprint")
    _wp.HTML = MagicMock()  # type: ignore[attr-defined]
    sys.modules["weasyprint"] = _wp

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


# --- POST /api/auth/login ---


@patch("app.routers.auth.send_magic_link_email", new_callable=AsyncMock)
@patch("app.routers.auth.get_db")
def test_login_sends_magic_link(mock_get_db, mock_send_email):
    """Login with valid email sends a magic link and returns 200."""
    db = AsyncMock()
    mock_get_db.return_value = db
    db.fetch_one.return_value = {"id": "user-id"}

    resp = client.post("/api/auth/login", json={"email": "test@example.com"})

    assert resp.status_code == 200
    assert resp.json() == {"message": "Check your inbox"}
    mock_send_email.assert_awaited_once()


def test_login_missing_email():
    """Login without email field returns 422 validation error."""
    resp = client.post("/api/auth/login", json={})
    assert resp.status_code == 422


def test_login_email_too_short():
    """Login with email shorter than 3 chars returns 422."""
    resp = client.post("/api/auth/login", json={"email": "ab"})
    assert resp.status_code == 422


@patch("app.routers.auth.get_db")
def test_login_no_db_returns_503(mock_get_db):
    """Login returns 503 when database is not available."""
    mock_get_db.return_value = None

    resp = client.post("/api/auth/login", json={"email": "test@example.com"})

    assert resp.status_code == 503
    assert resp.json()["detail"] == "Database not available"


# --- POST /api/auth/verify ---


@patch("app.routers.auth.get_db")
def test_verify_valid_token_sets_cookie(mock_get_db):
    """Verify with valid token creates session and sets cookie."""
    db = AsyncMock()
    mock_get_db.return_value = db

    magic_link_row = {
        "id": "link-id",
        "user_id": "user-id",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "used_at": None,
    }
    user_row = {"id": "user-id", "email": "test@example.com"}

    def fetch_one_side_effect(query, *args, **kwargs):
        """Route mock responses based on the SQL query."""
        if "magic_links" in query:
            return magic_link_row
        if "users" in query:
            return user_row
        return None

    db.fetch_one.side_effect = fetch_one_side_effect

    resp = client.post("/api/auth/verify", json={"token": "valid-token"})

    assert resp.status_code == 200
    assert resp.json()["email"] == "test@example.com"
    assert resp.json()["id"] == "user-id"
    assert "session" in resp.cookies


@patch("app.routers.auth.get_db")
def test_verify_expired_token_returns_401(mock_get_db):
    """Verify with expired token returns 401."""
    db = AsyncMock()
    mock_get_db.return_value = db

    expired_link = {
        "id": "link-id",
        "user_id": "user-id",
        "expires_at": datetime.now(timezone.utc) - timedelta(minutes=5),
        "used_at": None,
    }

    db.fetch_one.return_value = expired_link

    resp = client.post("/api/auth/verify", json={"token": "expired-token"})

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Link expired"


@patch("app.routers.auth.get_db")
def test_verify_used_token_returns_401(mock_get_db):
    """Verify with already-used token returns 401."""
    db = AsyncMock()
    mock_get_db.return_value = db

    used_link = {
        "id": "link-id",
        "user_id": "user-id",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "used_at": datetime.now(timezone.utc) - timedelta(minutes=2),
    }

    db.fetch_one.return_value = used_link

    resp = client.post("/api/auth/verify", json={"token": "used-token"})

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Link already used"


# --- GET /api/auth/me ---


@patch("app.routers.auth.get_current_user")
def test_me_without_session_returns_401(mock_get_current_user):
    """GET /me without a valid session returns 401."""
    mock_get_current_user.return_value = None

    resp = client.get("/api/auth/me")

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


@patch("app.routers.auth.get_current_user")
def test_me_with_valid_session_returns_user(mock_get_current_user):
    """GET /me with a valid session returns user info."""
    mock_get_current_user.return_value = {
        "id": "user-id",
        "email": "test@example.com",
    }

    resp = client.get("/api/auth/me")

    assert resp.status_code == 200
    assert resp.json() == {"id": "user-id", "email": "test@example.com"}


# --- POST /api/auth/logout ---


@patch("app.routers.auth.get_db")
def test_logout_clears_session_cookie(mock_get_db):
    """Logout clears session cookie and deletes server-side session."""
    db = AsyncMock()
    mock_get_db.return_value = db

    resp = client.post(
        "/api/auth/logout",
        cookies={"session": "some-token"},
    )

    assert resp.status_code == 200
    assert resp.json() == {"message": "Logged out"}
    # Cookie should be cleared via Set-Cookie header with max-age=0
    set_cookie_header = resp.headers.get("set-cookie", "")
    assert "session=" in set_cookie_header
    assert 'max-age=0' in set_cookie_header.lower()
    db.execute.assert_awaited_once()
