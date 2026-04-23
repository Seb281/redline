"""Tests for SP-10 Arc 3 Task 3.1 — semantic search endpoint.

The endpoint takes a 1024-float query embedding (Mistral-embed shape,
produced frontend-side so the backend never holds MISTRAL_API_KEY) and
returns ranked clauses across all of the authenticated user's saved,
non-expired analyses via pgvector cosine similarity.

Contract pinned here:
  - ``POST /api/search/semantic`` — auth required, db required.
  - Body: ``{ query_embedding: [1024 floats], top_k: int (1..50) }``.
  - 401 unauthenticated, 503 when DATABASE_URL unset, 422 on bad shape.
  - Happy path: returns ``results`` ordered by similarity desc, each hit
    carrying ``analysis_id``, ``clause_index``, ``similarity``, plus the
    clause / analysis metadata the history UI needs to render a hit.
  - Tenant isolation: the SQL filter is keyed on the authenticated
    user's id — verified by inspecting the kwargs passed to ``fetch_all``.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)

MOCK_USER = {"id": "user-123", "email": "test@example.com"}

# Mistral-embed emits 1024-float vectors. The validator on
# SemanticSearchRequest enforces this dim at the API boundary so a
# mis-shaped client never reaches the pgvector query.
VALID_EMBEDDING = [0.01] * 1024


def _mock_row(
    analysis_id: str,
    clause_index: int,
    similarity: float,
    title: str = "Non-Compete",
    filename: str = "contract.pdf",
    contract_type: str = "SaaS",
) -> dict:
    """Shape a fake DB row the same way the service projects one.

    The real query joins ``clause_embeddings`` onto ``analyses`` and
    pulls the clause JSON out of the stored array; the service then
    pulls ``title`` / ``clause_text`` / ``risk_level`` out of that entry
    by index. Mirroring that shape here keeps the test honest about
    what the service is expected to consume.
    """

    return {
        "analysis_id": analysis_id,
        "clause_index": clause_index,
        "similarity": similarity,
        "filename": filename,
        "overview": {"contract_type": contract_type},
        "clauses": [
            {
                "title": title,
                "clause_text": "Sample clause text",
                "risk_level": "high",
                "category": "non_compete",
            }
            for _ in range(clause_index + 1)
        ],
        "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
    }


# --- Auth + availability gates ---


def test_semantic_search_without_auth_returns_401():
    """POST /api/search/semantic without authentication returns 401."""
    with patch(
        "app.routers.search.get_current_user",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = client.post(
            "/api/search/semantic",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 5},
        )

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


def test_semantic_search_without_db_returns_503():
    """When DATABASE_URL is unset the endpoint reports the service gap cleanly."""
    with (
        patch(
            "app.routers.search.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.search.get_db", return_value=None),
    ):
        resp = client.post(
            "/api/search/semantic",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 5},
        )

    assert resp.status_code == 503


# --- Input validation ---


def test_semantic_search_rejects_wrong_embedding_dimension():
    """Embedding lengths that do not match Mistral-embed's 1024 dim are 422."""
    with patch(
        "app.routers.search.get_current_user",
        new_callable=AsyncMock,
        return_value=MOCK_USER,
    ):
        resp = client.post(
            "/api/search/semantic",
            json={"query_embedding": [0.1, 0.2, 0.3], "top_k": 5},
        )

    assert resp.status_code == 422


def test_semantic_search_caps_top_k():
    """top_k above the safety cap is rejected — keeps one request from
    scanning every row in the index.
    """
    with patch(
        "app.routers.search.get_current_user",
        new_callable=AsyncMock,
        return_value=MOCK_USER,
    ):
        resp = client.post(
            "/api/search/semantic",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 500},
        )

    assert resp.status_code == 422


def test_semantic_search_rejects_nonpositive_top_k():
    """top_k must be >= 1 — a zero hit count would be a silent no-op."""
    with patch(
        "app.routers.search.get_current_user",
        new_callable=AsyncMock,
        return_value=MOCK_USER,
    ):
        resp = client.post(
            "/api/search/semantic",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 0},
        )

    assert resp.status_code == 422


# --- Happy path ---


def test_semantic_search_returns_ranked_hits():
    """Returns the ranked hits the service produced, with projected fields."""
    db = AsyncMock()
    db.fetch_all.return_value = [
        _mock_row("a-1", 0, 0.92, title="Termination"),
        _mock_row("a-1", 2, 0.84, title="Non-Compete"),
        _mock_row("a-2", 1, 0.71, title="Governing Law"),
    ]

    with (
        patch(
            "app.routers.search.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.search.get_db", return_value=db),
    ):
        resp = client.post(
            "/api/search/semantic",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 10},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    results = data["results"]
    assert len(results) == 3

    # Similarity ordering is preserved end-to-end (the SQL produces it,
    # the service forwards it, the router doesn't re-sort).
    assert [r["similarity"] for r in results] == [0.92, 0.84, 0.71]

    first = results[0]
    assert first["analysis_id"] == "a-1"
    assert first["clause_index"] == 0
    assert first["clause_title"] == "Termination"
    assert first["clause_text"] == "Sample clause text"
    assert first["risk_level"] == "high"
    assert first["filename"] == "contract.pdf"
    assert first["contract_type"] == "SaaS"


def test_semantic_search_isolates_per_user():
    """The user_id filter reaches the SQL query verbatim — no cross-tenant leak."""
    db = AsyncMock()
    db.fetch_all.return_value = []

    with (
        patch(
            "app.routers.search.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.search.get_db", return_value=db),
    ):
        resp = client.post(
            "/api/search/semantic",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 5},
        )

    assert resp.status_code == 200
    db.fetch_all.assert_awaited_once()
    _, kwargs = db.fetch_all.await_args
    # databases/encode.execute passes params as the second positional arg.
    params = db.fetch_all.await_args.args[1]
    assert params["user_id"] == MOCK_USER["id"]
    assert params["top_k"] == 5
    # Embedding is shipped as the pgvector text literal, not a Python list.
    assert isinstance(params["query_embedding"], str)
    assert params["query_embedding"].startswith("[")
    assert params["query_embedding"].endswith("]")


def test_semantic_search_handles_out_of_bounds_clause_index():
    """A clause_index pointing past the stored clauses list is skipped
    rather than crashing — defensive against row/index drift between
    ``clause_embeddings`` and the analysis JSON.
    """
    db = AsyncMock()
    bad_row = {
        "analysis_id": "a-1",
        "clause_index": 99,
        "similarity": 0.9,
        "filename": "contract.pdf",
        "overview": {"contract_type": "SaaS"},
        "clauses": [{"title": "Only clause"}],
        "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
    }
    db.fetch_all.return_value = [bad_row]

    with (
        patch(
            "app.routers.search.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.search.get_db", return_value=db),
    ):
        resp = client.post(
            "/api/search/semantic",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 5},
        )

    assert resp.status_code == 200
    assert resp.json()["results"] == []


# --- SP-10 Arc 3 Task 3.3 — similar-contracts (library comparison panel) ---


def _mock_similar_row(
    analysis_id: str,
    clause_index: int,
    similarity: float,
    filename: str = "contract.pdf",
    contract_type: str = "SaaS",
    title: str = "Termination",
) -> dict:
    """Shape a DB row matching the ROW_NUMBER() CTE projection.

    The real query collapses per-analysis to the best clause, so each
    row here represents one contract + its best-matching clause.
    """

    return {
        "analysis_id": analysis_id,
        "clause_index": clause_index,
        "similarity": similarity,
        "filename": filename,
        "overview": {"contract_type": contract_type},
        "clauses": [
            {"title": title, "clause_text": "t", "risk_level": "high"}
            for _ in range(clause_index + 1)
        ],
        "created_at": datetime(2026, 4, 13, tzinfo=timezone.utc),
    }


def test_similar_contracts_without_auth_returns_401():
    """POST /api/search/similar-contracts without auth is 401."""
    with patch(
        "app.routers.search.get_current_user",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = client.post(
            "/api/search/similar-contracts",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 5},
        )

    assert resp.status_code == 401


def test_similar_contracts_without_db_returns_503():
    """DATABASE_URL-less deploy returns 503 cleanly."""
    with (
        patch(
            "app.routers.search.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.search.get_db", return_value=None),
    ):
        resp = client.post(
            "/api/search/similar-contracts",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 5},
        )

    assert resp.status_code == 503


def test_similar_contracts_rejects_wrong_embedding_dim():
    """Non-1024-dim embeddings are rejected at the API boundary."""
    with patch(
        "app.routers.search.get_current_user",
        new_callable=AsyncMock,
        return_value=MOCK_USER,
    ):
        resp = client.post(
            "/api/search/similar-contracts",
            json={"query_embedding": [0.1, 0.2], "top_k": 5},
        )

    assert resp.status_code == 422


def test_similar_contracts_caps_top_k():
    """top_k is capped — the panel only shows a few rows."""
    with patch(
        "app.routers.search.get_current_user",
        new_callable=AsyncMock,
        return_value=MOCK_USER,
    ):
        resp = client.post(
            "/api/search/similar-contracts",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 500},
        )

    assert resp.status_code == 422


def test_similar_contracts_returns_aggregated_hits():
    """Returns contract-level hits with best-clause anchor + similarity."""
    db = AsyncMock()
    db.fetch_all.return_value = [
        _mock_similar_row("a-1", 2, 0.91, filename="nda.pdf", title="Confidentiality"),
        _mock_similar_row("a-2", 0, 0.78, filename="msa.pdf", title="Payment"),
    ]

    with (
        patch(
            "app.routers.search.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.search.get_db", return_value=db),
    ):
        resp = client.post(
            "/api/search/similar-contracts",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 5},
        )

    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 2
    assert results[0]["analysis_id"] == "a-1"
    assert results[0]["filename"] == "nda.pdf"
    assert results[0]["best_clause_index"] == 2
    assert results[0]["best_clause_title"] == "Confidentiality"
    assert results[0]["contract_type"] == "SaaS"
    assert [r["similarity"] for r in results] == [0.91, 0.78]


def test_similar_contracts_passes_exclude_id_to_sql():
    """The exclude_analysis_id arrives in the SQL params when supplied."""
    db = AsyncMock()
    db.fetch_all.return_value = []

    with (
        patch(
            "app.routers.search.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.search.get_db", return_value=db),
    ):
        resp = client.post(
            "/api/search/similar-contracts",
            json={
                "query_embedding": VALID_EMBEDDING,
                "exclude_analysis_id": "current-id",
                "top_k": 5,
            },
        )

    assert resp.status_code == 200
    params = db.fetch_all.await_args.args[1]
    assert params["user_id"] == MOCK_USER["id"]
    assert params["exclude_id"] == "current-id"


def test_similar_contracts_omits_exclude_clause_when_absent():
    """Without exclude_analysis_id the SQL should not reference it."""
    db = AsyncMock()
    db.fetch_all.return_value = []

    with (
        patch(
            "app.routers.search.get_current_user",
            new_callable=AsyncMock,
            return_value=MOCK_USER,
        ),
        patch("app.routers.search.get_db", return_value=db),
    ):
        resp = client.post(
            "/api/search/similar-contracts",
            json={"query_embedding": VALID_EMBEDDING, "top_k": 5},
        )

    assert resp.status_code == 200
    sql = db.fetch_all.await_args.args[0]
    params = db.fetch_all.await_args.args[1]
    assert ":exclude_id" not in sql
    assert "exclude_id" not in params
