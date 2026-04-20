"""Tests for SP-6 DSAR endpoints — account export + hard delete."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import account as account_router

client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Clear in-memory slowapi state between tests.

    Export and delete are rate-limited at 3/hour/IP to stop abuse;
    that budget is too tight for the test file, which reuses the
    TestClient's single loopback address. slowapi's Limiter keeps its
    own per-instance storage, so resetting the account router's
    limiter directly is what clears the counters.
    """

    account_router.limiter.reset()
    yield
    account_router.limiter.reset()

MOCK_USER = {"id": "user-123", "email": "test@example.com"}
USER_CREATED_AT = datetime(2026, 1, 10, tzinfo=timezone.utc)
USER_LAST_LOGIN_AT = datetime(2026, 4, 19, 10, tzinfo=timezone.utc)


def _user_row() -> dict:
    """Canonical users-table row for patched DB fetches."""
    return {
        "id": MOCK_USER["id"],
        "email": MOCK_USER["email"],
        "created_at": USER_CREATED_AT,
        "last_login_at": USER_LAST_LOGIN_AT,
    }


def _analysis_row(analysis_id: str = "analysis-1") -> dict:
    """Canonical analyses-table row for patched DB fetches."""
    return {
        "id": analysis_id,
        "filename": "contract.pdf",
        "file_type": "pdf",
        "page_count": 5,
        "char_count": 12000,
        "contract_text": "Full contract text...",
        "overview": {"contract_type": "SaaS"},
        "summary": {"total_clauses": 2},
        "clauses": [{"title": "Non-Compete", "risk_level": "high"}],
        "analysis_mode": "fast",
        "provenance": {
            "provider": "mistral",
            "model": "mistral-small-4",
            "snapshot": "mistral-small-2603",
            "region": "eu-west-paris",
            "reasoning_effort_per_pass": {
                "overview": "low",
                "extraction": "medium",
                "risk": "high",
                "think_hard": "high",
            },
            "prompt_template_version": "1.0",
            "timestamp": "2026-04-15T12:00:00Z",
        },
        "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
        "updated_at": None,
        "expires_at": datetime(2026, 5, 13, tzinfo=timezone.utc),
        "pinned": False,
    }


# --- GET /api/account/export ---


def test_export_without_auth_returns_401():
    """Anonymous callers cannot pull a DSAR bundle."""
    with patch(
        "app.routers.account.get_current_user", new_callable=AsyncMock, return_value=None
    ):
        resp = client.get("/api/account/export")

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


def test_export_returns_bundle_with_full_shape():
    """Authenticated export returns every required field in the bundle."""
    db = AsyncMock()
    db.fetch_one.return_value = _user_row()
    db.fetch_all.return_value = [_analysis_row(), _analysis_row("analysis-2")]

    with (
        patch(
            "app.routers.account.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.account.get_db", return_value=db),
    ):
        resp = client.get("/api/account/export")

    assert resp.status_code == 200
    data = resp.json()
    assert data["schema_version"] == 1
    assert "exported_at" in data
    assert data["retention_policy_days"] == 30
    assert data["user"]["email"] == MOCK_USER["email"]
    assert data["user"]["created_at"].startswith("2026-01-10")
    assert len(data["analyses"]) == 2
    assert data["analyses"][0]["id"] == "analysis-1"
    # Provenance must round-trip untouched for AI Act transparency.
    assert data["analyses"][0]["provenance"]["provider"] == "mistral"


def test_export_sets_attachment_header():
    """Content-Disposition nudges the browser into a direct download."""
    db = AsyncMock()
    db.fetch_one.return_value = _user_row()
    db.fetch_all.return_value = []

    with (
        patch(
            "app.routers.account.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.account.get_db", return_value=db),
    ):
        resp = client.get("/api/account/export")

    assert resp.status_code == 200
    disposition = resp.headers.get("content-disposition", "")
    assert "attachment" in disposition
    assert "redline-export-" in disposition
    assert ".json" in disposition


def test_export_includes_expired_unpinned_rows():
    """Art 15 access covers rows that the history UI hides as expired."""
    db = AsyncMock()
    expired_row = _analysis_row("expired-1")
    expired_row["expires_at"] = datetime(2026, 1, 1, tzinfo=timezone.utc)
    expired_row["pinned"] = False
    db.fetch_one.return_value = _user_row()
    db.fetch_all.return_value = [expired_row]

    with (
        patch(
            "app.routers.account.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.account.get_db", return_value=db),
    ):
        resp = client.get("/api/account/export")

    assert resp.status_code == 200
    sql = db.fetch_all.await_args.args[0]
    # No expiry filter in the export query — the row must be returned.
    assert "expires_at" not in sql or "expires_at > " not in sql
    assert len(resp.json()["analyses"]) == 1


# --- DELETE /api/account ---


def test_delete_without_auth_returns_401():
    """Anonymous callers cannot delete accounts."""
    with patch(
        "app.routers.account.get_current_user", new_callable=AsyncMock, return_value=None
    ):
        resp = client.request(
            "DELETE", "/api/account", json={"confirm": "test@example.com"}
        )

    assert resp.status_code == 401


def test_delete_missing_confirm_returns_422():
    """Pydantic rejects bodies without the required `confirm` field."""
    with patch(
        "app.routers.account.get_current_user",
        new_callable=AsyncMock,
        return_value=MOCK_USER,
    ):
        resp = client.request("DELETE", "/api/account", json={})

    assert resp.status_code == 422


def test_delete_wrong_confirm_returns_400_and_preserves_row():
    """A typo in the confirmation keeps the account intact."""
    db = AsyncMock()
    db.fetch_one.return_value = _user_row()

    with (
        patch(
            "app.routers.account.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.account.get_db", return_value=db),
    ):
        resp = client.request(
            "DELETE", "/api/account", json={"confirm": "wrong@example.com"}
        )

    assert resp.status_code == 400
    db.execute.assert_not_awaited()


def test_delete_correct_confirm_cascades_and_inserts_stub():
    """Matching confirm → stub insert → users delete → session cookie cleared."""
    db = AsyncMock()
    db.fetch_one.side_effect = [
        _user_row(),          # SELECT users
        {"n": 3},              # SELECT COUNT(*) FROM analyses
    ]

    with (
        patch(
            "app.routers.account.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.account.get_db", return_value=db),
        patch(
            "app.routers.account.send_account_deleted_email",
            new_callable=AsyncMock,
        ) as mock_email,
    ):
        resp = client.request(
            "DELETE", "/api/account", json={"confirm": "test@example.com"}
        )

    assert resp.status_code == 200
    assert resp.json() == {"message": "Account deleted"}

    # Two execute calls: INSERT deleted_accounts, DELETE users.
    assert db.execute.await_count == 2
    insert_sql = db.execute.await_args_list[0].args[0]
    delete_sql = db.execute.await_args_list[1].args[0]
    assert "INSERT INTO deleted_accounts" in insert_sql
    assert "DELETE FROM users" in delete_sql

    insert_params = db.execute.await_args_list[0].args[1]
    assert insert_params["analyses_count"] == 3
    assert insert_params["account_age_days"] >= 0

    mock_email.assert_awaited_once_with("test@example.com")

    # Session cookie explicitly cleared via Set-Cookie deletion —
    # starlette emits a max-age=0 / expires-in-the-past directive.
    set_cookie = resp.headers.get("set-cookie", "")
    assert "session=" in set_cookie.lower()


def test_delete_confirm_case_insensitive_match():
    """Confirm comparison ignores casing so mobile autocapitalisation is fine."""
    db = AsyncMock()
    db.fetch_one.side_effect = [_user_row(), {"n": 0}]

    with (
        patch(
            "app.routers.account.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.account.get_db", return_value=db),
        patch(
            "app.routers.account.send_account_deleted_email",
            new_callable=AsyncMock,
        ),
    ):
        resp = client.request(
            "DELETE", "/api/account", json={"confirm": "Test@Example.com"}
        )

    assert resp.status_code == 200


def test_delete_survives_email_failure():
    """Email is best-effort — a Resend outage must not resurrect the account."""
    db = AsyncMock()
    db.fetch_one.side_effect = [_user_row(), {"n": 0}]

    with (
        patch(
            "app.routers.account.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.account.get_db", return_value=db),
        patch(
            "app.routers.account.send_account_deleted_email",
            new_callable=AsyncMock,
            side_effect=RuntimeError("resend down"),
        ),
    ):
        resp = client.request(
            "DELETE", "/api/account", json={"confirm": "test@example.com"}
        )

    assert resp.status_code == 200
    # Delete still executed despite the email failure.
    assert db.execute.await_count == 2


def test_delete_user_age_reported_in_stub():
    """account_age_days is computed from users.created_at."""
    db = AsyncMock()
    user = _user_row()
    user["created_at"] = datetime.now(timezone.utc) - timedelta(days=100)
    db.fetch_one.side_effect = [user, {"n": 0}]

    with (
        patch(
            "app.routers.account.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.account.get_db", return_value=db),
        patch(
            "app.routers.account.send_account_deleted_email",
            new_callable=AsyncMock,
        ),
    ):
        resp = client.request(
            "DELETE", "/api/account", json={"confirm": "test@example.com"}
        )

    assert resp.status_code == 200
    insert_params = db.execute.await_args_list[0].args[1]
    assert 99 <= insert_params["account_age_days"] <= 100
