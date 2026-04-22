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


# --- SP-10 clause embeddings (RAG Arc 1) ---


def test_save_analysis_with_embeddings_persists_vectors():
    """POST /api/analyses with a clause_embeddings block writes vectors in the same transaction.

    Arc 1 Phase 1 guarantees the save path round-trips 1024-dim Mistral
    embeddings alongside the analyses row. The handler must:
      - Accept the new optional ``clause_embeddings`` field on the body
      - Issue one INSERT into ``analyses`` plus one INSERT into
        ``clause_embeddings`` per clause (same mocked db.execute calls)
    """
    from unittest.mock import patch

    payload = {
        **SAVE_PAYLOAD,
        "clause_embeddings": [
            {"clause_index": 0, "embedding": [0.1] * 1024},
            {"clause_index": 1, "embedding": [0.2] * 1024},
        ],
    }

    db = AsyncMock()

    with (
        patch(
            "app.routers.analyses.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.post("/api/analyses", json=payload)

    assert resp.status_code == 201
    # One INSERT into analyses + one bulk INSERT into clause_embeddings.
    assert db.execute.await_count == 2
    embedding_sql = db.execute.await_args_list[1].args[0]
    assert "INSERT INTO clause_embeddings" in embedding_sql
    embedding_params = db.execute.await_args_list[1].args[1]
    # Either a list of dicts (executemany-style) or a single dict with
    # arrays — the router picks one shape. We assert enough structure to
    # verify both clauses are present.
    if isinstance(embedding_params, list):
        assert len(embedding_params) == 2
        assert embedding_params[0]["clause_index"] == 0
        assert embedding_params[1]["clause_index"] == 1
    else:
        # Single-call shape: array params keyed by name.
        assert len(embedding_params.get("clause_indexes", [])) == 2


def test_save_analysis_anonymous_with_embeddings_writes_nothing():
    """Privacy invariant: an unauthenticated caller submitting a full
    payload with ``clause_embeddings`` must be rejected 401 *before* any
    DB write, not just before the embedding INSERT. Regression guard for
    SP-10 Arc 1 Phase 5 — anonymous sessions never trigger an embedding
    write under any circumstances.
    """
    from unittest.mock import patch

    payload = {
        **SAVE_PAYLOAD,
        "clause_embeddings": [
            {"clause_index": 0, "embedding": [0.1] * 1024},
            {"clause_index": 1, "embedding": [0.2] * 1024},
        ],
    }
    db = AsyncMock()

    with (
        patch(
            "app.routers.analyses.get_current_user",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.post("/api/analyses", json=payload)

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"
    # No INSERT into analyses, no INSERT into clause_embeddings.
    db.execute.assert_not_awaited()
    db.fetch_all.assert_not_awaited()
    db.fetch_one.assert_not_awaited()


def test_get_analysis_round_trips_clause_embeddings():
    """GET returns the persisted embedding block with dims + indices intact.

    Owner-authenticated GET must attach ``clause_embeddings`` built from
    the ``clause_embeddings`` table — one 1024-dim vector per clause_index,
    preserving the on-disk order. The frontend history page relies on
    this shape so the chat route's vector branch remains live for saved
    analyses.
    """
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
        "clauses": [
            {"title": "Non-Compete", "risk_level": "high"},
            {"title": "Governing Law", "risk_level": "low"},
        ],
        "analysis_mode": "fast",
        "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
        "updated_at": None,
        "expires_at": datetime(2099, 1, 1, tzinfo=timezone.utc),
        "pinned": False,
    }
    # pgvector returns the text form over most drivers; parser must
    # cope. Use a short-but-valid 1024-dim construction.
    vec0 = [0.1] * 1024
    vec1 = [0.2] * 1024
    db.fetch_all.return_value = [
        {"clause_index": 0, "embedding": "[" + ",".join(f"{v}" for v in vec0) + "]"},
        {"clause_index": 1, "embedding": vec1},  # native-list driver shape
    ]

    with (
        patch(
            "app.routers.analyses.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1")

    assert resp.status_code == 200
    data = resp.json()
    embeddings = data["clause_embeddings"]
    assert embeddings is not None
    assert len(embeddings) == 2
    assert [e["clause_index"] for e in embeddings] == [0, 1]
    assert len(embeddings[0]["embedding"]) == 1024
    assert len(embeddings[1]["embedding"]) == 1024
    assert embeddings[0]["embedding"][0] == pytest.approx(0.1)
    assert embeddings[1]["embedding"][0] == pytest.approx(0.2)


def test_get_analysis_with_no_embeddings_returns_null_block():
    """Pre-SP-10 rows (no embedding_rows) must return ``clause_embeddings: None``
    so the frontend degrades to BM25-only retrieval cleanly.
    """
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
        "summary": {"total_clauses": 0},
        "clauses": [],
        "analysis_mode": "fast",
        "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
        "updated_at": None,
        "expires_at": datetime(2099, 1, 1, tzinfo=timezone.utc),
        "pinned": False,
    }
    db.fetch_all.return_value = []

    with (
        patch(
            "app.routers.analyses.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1")

    assert resp.status_code == 200
    assert resp.json()["clause_embeddings"] is None


def test_save_analysis_rejects_wrong_embedding_dimension():
    """Embeddings must be exactly 1024 dims (Mistral ``mistral-embed``)."""
    from unittest.mock import patch

    payload = {
        **SAVE_PAYLOAD,
        "clause_embeddings": [
            {"clause_index": 0, "embedding": [0.1] * 768},
        ],
    }

    with patch(
        "app.routers.analyses.get_current_user",
        new_callable=AsyncMock,
        return_value=MOCK_USER,
    ):
        resp = client.post("/api/analyses", json=payload)

    assert resp.status_code == 422


def test_save_analysis_without_embeddings_still_works():
    """Legacy payloads (no clause_embeddings) must still succeed — the field is optional."""
    from unittest.mock import patch

    db = AsyncMock()

    with (
        patch(
            "app.routers.analyses.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.post("/api/analyses", json=SAVE_PAYLOAD)

    assert resp.status_code == 201
    # Only the analyses INSERT fires — no embedding table write.
    assert db.execute.await_count == 1


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
    # defaults to None in SP-1.5; `analysis_locale` defaults to None in
    # SP-7 Layer B' (pre-locale rows round-trip as unknown);
    # `schema_version` defaults to None in SP-9 for pre-receipt rows.
    # Round-tripped provenance carries the optional fields alongside the input.
    expected = {
        **provenance,
        "redaction_location": None,
        "text_source": None,
        "analysis_locale": None,
        "schema_version": None,
    }
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


# --- GET /api/analyses/{id}/receipt (SP-9 transparency receipt) ---


def test_get_receipt_without_auth_returns_401():
    """GET /api/analyses/{id}/receipt without authentication returns 401."""
    from unittest.mock import patch

    with patch(
        "app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=None
    ):
        resp = client.get("/api/analyses/analysis-1/receipt")

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


def test_get_receipt_nonexistent_returns_404():
    """GET /api/analyses/{id}/receipt returns 404 for a missing row."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = None

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/nonexistent/receipt")

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Analysis not found"


def test_get_receipt_wrong_owner_returns_404():
    """GET /api/analyses/{id}/receipt hides rows belonging to another user."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = {
        "id": "analysis-1",
        "user_id": "other-user-456",
        "filename": "contract.pdf",
        "clauses": [],
        "provenance": {},
        "pinned": False,
        "expires_at": None,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1/receipt")

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Analysis not found"


def test_get_receipt_expired_unpinned_returns_404():
    """An expired unpinned row is treated as deleted for the receipt too."""
    from unittest.mock import patch

    past = datetime.now(timezone.utc) - timedelta(days=1)
    db = AsyncMock()
    db.fetch_one.return_value = {
        "id": "analysis-1",
        "user_id": "user-123",
        "filename": "contract.pdf",
        "clauses": [],
        "provenance": {},
        "pinned": False,
        "expires_at": past,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1/receipt")

    assert resp.status_code == 404


def test_get_receipt_returns_expected_shape():
    """The receipt wraps stored provenance with the SP-9 canonical shape."""
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
        "analysis_locale": "fr",
        "schema_version": "1",
    }
    db = AsyncMock()
    db.fetch_one.return_value = {
        "id": "analysis-1",
        "user_id": "user-123",
        "filename": "contract.pdf",
        "clauses": [
            {"title": "Non-Compete", "risk_level": "high"},
            {"title": "Governing Law", "risk_level": "low"},
        ],
        "provenance": provenance,
        "pinned": True,
        "expires_at": None,
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1/receipt")

    assert resp.status_code == 200
    body = resp.json()
    assert body["kind"] == "redline.transparency.receipt"
    assert body["schema_version"] == "1"
    assert body["analysis"] == {
        "id": "analysis-1",
        "filename": "contract.pdf",
        "clause_count": 2,
        "analysis_locale": "fr",
    }
    assert body["provenance"] == provenance
    assert [s["key"] for s in body["pipeline"]] == [
        "pass0",
        "redaction",
        "pass1",
        "pass2",
        "chat",
    ]
    refs = [a["reference"] for a in body["ai_act_articles"]]
    assert "Art. 13" in refs
    assert "Art. 50" in refs
    assert len(body["operator_levers"]) > 0
    assert len(body["limitations"]) > 0
    # Privacy-by-design: the receipt must never leak contract/clause text.
    import json as _json

    serialised = _json.dumps(body)
    assert "clause_text" not in serialised
    assert "contract_text" not in serialised


def test_get_receipt_handles_string_encoded_jsonb():
    """Provenance + clauses may come back as JSON strings from asyncpg."""
    from unittest.mock import patch
    import json as _json

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
        "clauses": _json.dumps([{"title": "Non-Compete", "risk_level": "high"}]),
        "provenance": _json.dumps(provenance),
        "pinned": False,
        "expires_at": datetime(2099, 1, 1, tzinfo=timezone.utc),
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1/receipt")

    assert resp.status_code == 200
    body = resp.json()
    assert body["analysis"]["clause_count"] == 1
    assert body["provenance"] == provenance


def test_get_receipt_missing_provenance_defaults_to_empty():
    """Legacy pre-phase-5 rows with no provenance still produce a valid receipt."""
    from unittest.mock import patch

    db = AsyncMock()
    db.fetch_one.return_value = {
        "id": "analysis-1",
        "user_id": "user-123",
        "filename": "contract.pdf",
        "clauses": [],
        "pinned": False,
        "expires_at": datetime(2099, 1, 1, tzinfo=timezone.utc),
    }

    with (
        patch("app.routers.analyses.get_current_user", new_callable=AsyncMock, return_value=MOCK_USER),
        patch("app.routers.analyses.get_db", return_value=db),
    ):
        resp = client.get("/api/analyses/analysis-1/receipt")

    assert resp.status_code == 200
    body = resp.json()
    assert body["kind"] == "redline.transparency.receipt"
    assert body["schema_version"] == "1"
    assert body["provenance"] == {}
    assert body["analysis"]["analysis_locale"] is None


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
