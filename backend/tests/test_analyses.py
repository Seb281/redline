"""Tests for analyses CRUD endpoints — save, list, get, delete."""

import sys
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

# Stub weasyprint before any app imports so tests run without native libs
sys.modules.setdefault("weasyprint", MagicMock())

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)

MOCK_USER = {"id": "user-123", "email": "test@example.com"}

SAVE_PAYLOAD = {
    "filename": "contract.pdf",
    "file_type": "pdf",
    "page_count": 5,
    "char_count": 12000,
    "contract_text": "Full contract text...",
    "overview": {"contract_type": "SaaS", "parties": ["A", "B"], "key_terms": []},
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
            "overview": {"contract_type": "SaaS", "parties": ["A", "B"]},
            "clauses": [
                {"title": "Non-Compete", "risk_level": "high"},
                {"title": "Governing Law", "risk_level": "low"},
            ],
            "analysis_mode": "fast",
            "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
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
    assert json.loads(call_params["provenance"]) == provenance


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
