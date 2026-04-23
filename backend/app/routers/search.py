"""SP-10 Arc 3 Task 3.1 — cross-analysis semantic search router.

Pipeline responsibility split (mirroring the rest of the app):
  - Frontend embeds the user's query with ``mistral-embed`` and POSTs
    the 1024-float vector here. Keeps ``MISTRAL_API_KEY`` off the
    backend, which is the existing pattern for every LLM call.
  - This router enforces auth, DB availability, shape validation, and
    per-IP rate limits. The query itself lives in
    ``services.semantic_search`` so the HTTP layer stays thin.

Rate limit: ``20/minute`` per IP. Consistent with the other public
endpoints in ``main.py`` and tight enough to cap the cost of a
dictionary-attack-style scan against the ANN index.
"""

from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db import get_db
from app.middleware import get_current_user
from app.schemas import (
    SemanticSearchRequest,
    SemanticSearchResponse,
    SimilarContractsRequest,
    SimilarContractsResponse,
)
from app.services.semantic_search import semantic_search, similar_contracts

router = APIRouter(prefix="/api/search", tags=["search"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/semantic")
@limiter.limit("20/minute")
async def semantic_search_endpoint(
    body: SemanticSearchRequest, request: Request
) -> SemanticSearchResponse:
    """Search all of the authenticated user's saved clauses by vector similarity.

    Returns ``SemanticSearchResponse`` carrying the top-``top_k`` hits
    ordered by cosine similarity descending. Hits are scoped to the
    caller's own analyses and respect the SP-5 retention rules —
    expired unpinned analyses are hidden.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    hits = await semantic_search(
        db,
        user_id=user["id"],
        query_embedding=body.query_embedding,
        top_k=body.top_k,
        exclude_analysis_id=body.exclude_analysis_id,
    )

    return SemanticSearchResponse(results=hits)


@router.post("/similar-contracts")
@limiter.limit("20/minute")
async def similar_contracts_endpoint(
    body: SimilarContractsRequest, request: Request
) -> SimilarContractsResponse:
    """Return contracts in the caller's library most similar to the query.

    Unlike ``/api/search/semantic`` which returns clause-level hits, this
    aggregates at contract granularity (one row per analysis). Used by
    the SP-10 Arc 3 Task 3.3 library-comparison panel on the report page.
    """
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    hits = await similar_contracts(
        db,
        user_id=user["id"],
        query_embedding=body.query_embedding,
        exclude_analysis_id=body.exclude_analysis_id,
        top_k=body.top_k,
    )

    return SimilarContractsResponse(results=hits)
