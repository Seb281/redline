"""Tests for analyses CRUD endpoints — save, list, get, delete,
retention (SP-5: pin, extend, prune, hidden-when-expired)."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.retention import prune_expired

client = TestClient(app, raise_server_exceptions=False)

MOCK_USER = {"id": "user-123", "email": "test@example.com"}

SAVE_PAYLOAD = {
    "filename": "contract.pdf",
    "file_type": "pdf",
    "page_count": 5,
    "char_count": 12000,
    "contract_text": "Full contract text...",
    "overview": {"contract_type": "SaaS", "parties": [{"name": "A", "role_label": None}, {"name": "B", "role_label": None}], "key_terms": []},
    "summary": {
        "total_clauses": 2,
        "risk_breakdown": {"high": 1, "medium": 0, "low": 1, "informational": 0},
        "top_risks": [],
    },
    "clauses": [
        {"title": "Non-Compete", "risk_level": "high", "category": "non_compete"},
        {"title": "Governing Law", "risk_level": "low", "category": "governing_law"},
    ],
    "analysis_mode": "fast",
    # Provenance is required end-to-end since SP-1 Phase 5. Older
    # payloads without it are now rejected at the Pydantic boundary.
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
}


# --- POST /api/analyses ---


def test_save_analysis_without_auth_returns_401():
    """POST /api/analyses without authentication returns 401."""
    from unittest.mock import patch

    with patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=None):
        resp = client.post("/api/analyses", json=SAVE_PAYLOAD)

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


def test_save_analysis_with_auth_returns_201():
    """POST /api/analyses with valid auth saves analysis and returns 201 with id."""
    from unittest.mock import patch

    db = AsyncMock()

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.post("/api/analyses", json=SAVE_PAYLOAD)

    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert isinstance(data["id"], str)
    db.execute.assert_awaited_once()


def test_save_analysis_without_provenance_returns_422():
    """POST without a provenance block is rejected at the Pydantic boundary."""
    from unittest.mock import patch

    payload = {k: v for k, v in SAVE_PAYLOAD.items() if k != "provenance"}

    with patch(
        "app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER
    ):
        resp = client.post("/api/analyses", json=payload)

    assert resp.status_code == 422


def test_save_analysis_with_legacy_provenance_sentinel_returns_422():
    """Legacy-pre-phase5 placeholder provenance must never persist."""
    from unittest.mock import patch

    payload = {
        **SAVE_PAYLOAD,
        "provenance": {**SAVE_PAYLOAD["provenance"], "provider": "legacy-pre-phase5"},
    }

    with patch(
        "app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER
    ):
        resp = client.post("/api/analyses", json=payload)

    assert resp.status_code == 422


# --- GET /api/analyses ---


def test_list_analyses_without_auth_returns_401():
    """GET /api/analyses without authentication returns 401."""
    from unittest.mock import patch

    with patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=None):
        resp = client.get("/api/analyses")

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


def test_list_analyses_with_auth_returns_items():
    """GET /api/analyses with auth returns list with correct risk counts."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_all.return_value = [
        {
            "id": "analysis-1",
            "filename": "contract.pdf",
            "file_type": "pdf",
            "overview": {"contract_type": "SaaS", "parties": [{"name": "A", "role_label": None}, {"name": "B", "role_label": None}]},
            "clauses": [
                {"title": "Non-Compete", "risk_level": "high"},
                {"title": "Governing Law", "risk_level": "low"},
            ],
            "analysis_mode": "fast",
            "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
            "expires_at": datetime(2026, 5, 13, tzinfo=timezone.utc),
            "pinned": False,
        },
    ]

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    item = data[0]
    assert item["id"] == "analysis-1"
    assert item["clause_count"] == 2
    assert item["risk_high"] == 1
    assert item["risk_medium"] == 0
    assert item["risk_low"] == 1
    assert item["contract_type"] == "SaaS"


# --- GET /api/analyses/{id} ---


def test_get_analysis_with_auth_returns_full():
    """GET /api/analyses/{id} returns full analysis for the owner."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = {
        "id": "analysis-1",
        "user_id": "user-123",
        "filename": "contract.pdf",
        "file_type": "pdf",
        "page_count": 5,
        "char_count": 12000,
        "contract_text": "Full contract text...",
        "overview": {"contract_type": "SaaS"},
        "summary": {"total_clauses": 2},
        "clauses": [{"title": "Non-Compete", "risk_level": "high"}],
        "analysis_mode": "fast",
        "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
        "updated_at": None,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1")

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "analysis-1"
    assert data["filename"] == "contract.pdf"
    assert data["overview"] == {"contract_type": "SaaS"}
    assert data["clauses"] == [{"title": "Non-Compete", "risk_level": "high"}]


def test_get_analysis_not_found_returns_404():
    """GET /api/analyses/{id} returns 404 when analysis does not exist."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = None

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/nonexistent")

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Analysis not found"


def test_get_analysis_wrong_owner_returns_404():
    """GET /api/analyses/{id} returns 404 when user is not the owner."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = {
        "id": "analysis-1",
        "user_id": "other-user-456",
        "filename": "contract.pdf",
        "file_type": "pdf",
        "page_count": 5,
        "char_count": 12000,
        "contract_text": "Full contract text...",
        "overview": {"contract_type": "SaaS"},
        "summary": {"total_clauses": 2},
        "clauses": [],
        "analysis_mode": "fast",
        "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
        "updated_at": None,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1")

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Analysis not found"


# --- DELETE /api/analyses/{id} ---


def test_save_analysis_persists_provenance():
    """POST with a provenance block passes it verbatim into the INSERT."""
    import json
    from unittest.mock import patch

    db = AsyncMock()
    provenance = {
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
    }
    payload = {**SAVE_PAYLOAD, "provenance": provenance}

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.post("/api/analyses", json=payload)

    assert resp.status_code == 201
    db.execute.assert_awaited_once()
    call_params = db.execute.await_args.args[1]
    # `redaction_location` defaults to None in SP-1.6; `text_source`
    # defaults to None in SP-1.5. Round-tripped provenance carries the
    # optional fields alongside the input.
    expected = {**provenance, "redaction_location": None, "text_source": None}
    assert json.loads(call_params["provenance"]) == expected


def test_get_analysis_returns_provenance_round_trip():
    """GET /api/analyses/{id} returns the stored provenance JSON unchanged."""
    from unittest.mock import patch

    provenance = {
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
    }

    db = AsyncMock()
    db.fetch_one.return_value = {
        "id": "analysis-1",
        "user_id": "user-123",
        "filename": "contract.pdf",
        "file_type": "pdf",
        "page_count": 5,
        "char_count": 12000,
        "contract_text": "Full contract text...",
        "overview": {"contract_type": "SaaS"},
        "summary": {"total_clauses": 2},
        "clauses": [{"title": "Non-Compete", "risk_level": "high"}],
        "analysis_mode": "fast",
        "provenance": provenance,
        "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
        "updated_at": None,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1")

    assert resp.status_code == 200
    assert resp.json()["provenance"] == provenance


def test_get_analysis_missing_provenance_defaults_to_empty():
    """Pre-migration rows without a provenance column degrade to an empty dict."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = {
        "id": "analysis-1",
        "user_id": "user-123",
        "filename": "contract.pdf",
        "file_type": "pdf",
        "page_count": 5,
        "char_count": 12000,
        "contract_text": "Full contract text...",
        "overview": {"contract_type": "SaaS"},
        "summary": {"total_clauses": 2},
        "clauses": [],
        "analysis_mode": "fast",
        "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
        "updated_at": None,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1")

    assert resp.status_code == 200
    assert resp.json()["provenance"] == {}


def test_delete_analysis_without_auth_returns_401():
    """DELETE /api/analyses/{id} without authentication returns 401."""
    from unittest.mock import patch

    with patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=None):
        resp = client.delete("/api/analyses/analysis-1")

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


def test_delete_analysis_with_auth_returns_200():
    """DELETE /api/analyses/{id} with valid auth deletes and returns 200."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = {"user_id": "user-123"}

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.delete("/api/analyses/analysis-1")

    assert resp.status_code == 200
    assert resp.json() == {"message": "Analysis deleted"}
    db.execute.assert_awaited_once()


# --- SP-5 retention ---


def test_save_analysis_sets_expires_at(monkeypatch):
    """A freshly-saved analysis gets expires_at = now + RETENTION_DAYS."""
    from unittest.mock import patch

    monkeypatch.setenv("RETENTION_DAYS", "45")
    db = AsyncMock()

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.post("/api/analyses", json=SAVE_PAYLOAD)

    assert resp.status_code == 201
    params = db.execute.await_args.args[1]
    # created_at + 45 days should land on the expires_at param.
    delta = params["expires_at"] - params["created_at"]
    assert delta == timedelta(days=45)


def test_list_analyses_excludes_expired_unpinned_rows():
    """Query includes the (pinned = TRUE OR expires_at > now) filter."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_all.return_value = []

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses")

    assert resp.status_code == 200
    sql = db.fetch_all.await_args.args[0]
    assert "pinned = TRUE" in sql
    assert "expires_at" in sql


def test_list_analyses_propagates_retention_fields():
    """AnalysisListItem carries expires_at and pinned to the client."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_all.return_value = [
        {
            "id": "analysis-1",
            "filename": "contract.pdf",
            "file_type": "pdf",
            "overview": {"contract_type": "NDA"},
            "clauses": [],
            "analysis_mode": "fast",
            "created_at": datetime(2026, 4, 1, tzinfo=timezone.utc),
            "expires_at": datetime(2026, 5, 1, tzinfo=timezone.utc),
            "pinned": True,
        }
    ]

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses")

    item = resp.json()[0]
    assert item["pinned"] is True
    assert item["expires_at"].startswith("2026-05-01")


def test_get_analysis_returns_404_when_expired_and_unpinned():
    """A row past its expiry without a pin is treated as deleted (404)."""
    from unittest.mock import patch

    past = datetime.now(timezone.utc) - timedelta(days=1)
    db = AsyncMock()
    db.fetch_one.return_value = {
        "id": "analysis-1",
        "user_id": "user-123",
        "filename": "contract.pdf",
        "file_type": "pdf",
        "page_count": 5,
        "char_count": 12000,
        "contract_text": "text",
        "overview": {},
        "summary": {},
        "clauses": [],
        "analysis_mode": "fast",
        "created_at": datetime(2026, 3, 1, tzinfo=timezone.utc),
        "updated_at": None,
        "expires_at": past,
        "pinned": False,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1")

    assert resp.status_code == 404


def test_get_analysis_still_accessible_when_expired_but_pinned():
    """Pinned analyses never expire, even if expires_at is in the past."""
    from unittest.mock import patch

    past = datetime.now(timezone.utc) - timedelta(days=1)
    db = AsyncMock()
    db.fetch_one.return_value = {
        "id": "analysis-1",
        "user_id": "user-123",
        "filename": "contract.pdf",
        "file_type": "pdf",
        "page_count": 5,
        "char_count": 12000,
        "contract_text": "text",
        "overview": {"contract_type": "NDA"},
        "summary": {},
        "clauses": [],
        "analysis_mode": "fast",
        "created_at": datetime(2026, 3, 1, tzinfo=timezone.utc),
        "updated_at": None,
        "expires_at": past,
        "pinned": True,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1")

    assert resp.status_code == 200
    data = resp.json()
    assert data["pinned"] is True


def test_patch_analysis_pins_row():
    """PATCH with pinned=true flips the flag via an UPDATE."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = {
        "user_id": "user-123",
        "expires_at": datetime(2026, 5, 1, tzinfo=timezone.utc),
        "pinned": False,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.patch("/api/analyses/analysis-1", json={"pinned": True})

    assert resp.status_code == 200
    assert resp.json()["pinned"] is True
    db.execute.assert_awaited_once()
    update_sql = db.execute.await_args.args[0]
    assert "UPDATE analyses" in update_sql
    assert "pinned" in update_sql


def test_patch_analysis_noop_when_pinned_omitted():
    """PATCH with no mutable fields still returns current state (no UPDATE)."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = {
        "user_id": "user-123",
        "expires_at": datetime(2026, 5, 1, tzinfo=timezone.utc),
        "pinned": True,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.patch("/api/analyses/analysis-1", json={})

    assert resp.status_code == 200
    assert resp.json()["pinned"] is True
    db.execute.assert_not_awaited()


def test_patch_analysis_wrong_owner_returns_404():
    """Non-owners cannot pin each other's analyses."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = {
        "user_id": "other-user",
        "expires_at": datetime(2026, 5, 1, tzinfo=timezone.utc),
        "pinned": False,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.patch("/api/analyses/analysis-1", json={"pinned": True})

    assert resp.status_code == 404


def test_extend_analysis_resets_expires_at(monkeypatch):
    """POST /extend pushes expires_at forward by RETENTION_DAYS."""
    from unittest.mock import patch

    monkeypatch.setenv("RETENTION_DAYS", "30")
    db = AsyncMock()
    db.fetch_one.return_value = {"user_id": "user-123", "pinned": False}

    before = datetime.now(timezone.utc)

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.post("/api/analyses/analysis-1/extend")

    after = datetime.now(timezone.utc)
    assert resp.status_code == 200
    params = db.execute.await_args.args[1]
    # The new expiry should land roughly 30 days after the request.
    assert (params["expires_at"] - before) >= timedelta(days=29, hours=23)
    assert (params["expires_at"] - after) <= timedelta(days=30, minutes=1)


def test_extend_analysis_wrong_owner_returns_404():
    """Non-owners cannot extend each other's retention clocks."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = {"user_id": "other-user", "pinned": False}

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.post("/api/analyses/analysis-1/extend")

    assert resp.status_code == 404


# --- retention service ---


@pytest.mark.asyncio
async def test_prune_expired_deletes_only_unpinned_past_rows():
    """The prune query filters on pinned=FALSE AND expires_at <= now()."""
    db = AsyncMock()
    db.fetch_all.return_value = [{"id": "analysis-1"}, {"id": "analysis-2"}]

    now = datetime(2026, 5, 1, tzinfo=timezone.utc)
    deleted = await prune_expired(db, now=now)

    assert deleted == 2
    sql = db.fetch_all.await_args.args[0]
    assert "DELETE FROM analyses" in sql
    assert "pinned = FALSE" in sql
    assert "expires_at <= :now" in sql
    params = db.fetch_all.await_args.args[1]
    assert params == {"now": now}


@pytest.mark.asyncio
async def test_prune_expired_returns_zero_when_nothing_expired():
    """Empty RETURNING → zero deletions."""
    db = AsyncMock()
    db.fetch_all.return_value = []

    deleted = await prune_expired(db)

    assert deleted == 0
