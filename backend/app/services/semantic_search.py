"""SP-10 Arc 3 Task 3.1 — cross-analysis semantic search service.

Runs a pgvector cosine query against the ``clause_embeddings`` table,
joined to the user's saved ``analyses``. The HNSW cosine index
(``idx_clause_embeddings_hnsw`` from migration 005) makes this an ANN
lookup rather than a full scan — critical once a user has dozens of
saved contracts.

Design tenets:
  - **Tenant isolation by filter, not by table.** The SQL ``WHERE`` pins
    ``a.user_id``, so one user's embeddings can never leak into another
    user's results. The router validates the caller is authenticated
    before passing anything in.
  - **Retention-aware.** Matches the ``GET /api/analyses`` rule: expired
    unpinned rows are hidden even before the daily prune job runs, so
    search can never resurrect a logically-deleted contract.
  - **No embedding model in the backend.** The query vector arrives
    pre-embedded from the frontend — keeps ``MISTRAL_API_KEY`` client-
    side, matching the rest of the analysis pipeline.
  - **Fail-soft on row drift.** If an embedding row points at an index
    past the stored ``clauses`` array (e.g. a mid-flight schema change
    mismatched the two), we skip the hit rather than 500ing the whole
    response.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.schemas import SemanticSearchHit


def _format_vector(values: list[float]) -> str:
    """Encode a float vector as pgvector's text literal.

    Mirrors ``app.routers.analyses._format_vector`` — the two live in
    separate modules to avoid a router-to-router import, and keeping
    the literal form driver-agnostic means the service works against
    the real ``databases`` pool and any ``AsyncMock`` the tests plug
    in.
    """

    return "[" + ",".join(repr(float(v)) for v in values) + "]"


def _coerce_json(value: Any) -> Any:
    """Decode a JSONB column value to a Python dict/list.

    Most async drivers return strings for JSONB; a few (asyncpg with a
    registered codec) return native Python objects. Supporting both
    avoids a second code path for tests that hand back plain dicts.
    """

    if isinstance(value, str):
        return json.loads(value)
    return value


async def semantic_search(
    db: Any,
    *,
    user_id: str,
    query_embedding: list[float],
    top_k: int,
) -> list[SemanticSearchHit]:
    """Return the top-``top_k`` clauses most similar to ``query_embedding``.

    Results are ordered by cosine similarity descending (so the closest
    vector is first). ``similarity`` is ``1 - cosine_distance``, bounded
    to ``[0, 2]`` by pgvector — in practice normalized Mistral-embed
    vectors land in ``[0, 1]``.
    """

    now = datetime.now(timezone.utc)
    rows = await db.fetch_all(
        """
        SELECT
            ce.analysis_id AS analysis_id,
            ce.clause_index AS clause_index,
            1 - (ce.embedding <=> :query_embedding) AS similarity,
            a.filename AS filename,
            a.overview AS overview,
            a.clauses AS clauses,
            a.created_at AS created_at
        FROM clause_embeddings ce
        JOIN analyses a ON a.id = ce.analysis_id
        WHERE a.user_id = :user_id
          AND (a.pinned = TRUE OR a.expires_at IS NULL OR a.expires_at > :now)
        ORDER BY ce.embedding <=> :query_embedding ASC
        LIMIT :top_k
        """,
        {
            "query_embedding": _format_vector(query_embedding),
            "user_id": user_id,
            "now": now,
            "top_k": top_k,
        },
    )

    hits: list[SemanticSearchHit] = []
    for row in rows:
        clauses = _coerce_json(row["clauses"])
        overview = _coerce_json(row["overview"])
        idx = int(row["clause_index"])

        # Fail-soft: skip rather than crash when the embedding row
        # points past the stored clauses list.
        if not isinstance(clauses, list) or idx < 0 or idx >= len(clauses):
            continue

        clause = clauses[idx] if isinstance(clauses[idx], dict) else {}
        contract_type = (
            overview.get("contract_type") if isinstance(overview, dict) else None
        )

        created_at = row["created_at"]
        if isinstance(created_at, datetime):
            created_at_iso = created_at.isoformat()
        else:
            created_at_iso = str(created_at)

        hits.append(
            SemanticSearchHit(
                analysis_id=str(row["analysis_id"]),
                clause_index=idx,
                similarity=float(row["similarity"]),
                clause_title=clause.get("title"),
                clause_text=clause.get("clause_text"),
                risk_level=clause.get("risk_level"),
                filename=row["filename"],
                contract_type=contract_type,
                created_at=created_at_iso,
            )
        )

    return hits
