"""SP-9 — AI Act transparency receipt builder (server-side mirror).

The receipt shape lives primarily in ``frontend/src/lib/transparency-receipt.ts``;
this module mirrors it so the backend ``GET /api/analyses/{id}/receipt``
endpoint can produce byte-for-byte the same JSON wrapper for saved
analyses as the client-side builder emits for anonymous sessions.

Kept intentionally tiny and free of I/O: the router passes in the stored
provenance dict plus a small amount of analysis metadata, and this module
returns a serialisable dict that FastAPI hands to the response.

Changing the shape of the receipt:
    1. Update the TypeScript module first (single source of truth for
       schema version + ordering of the pipeline / article / lever arrays).
    2. Mirror the changes here. Bump ``RECEIPT_SCHEMA_VERSION``.
    3. Bump the Pydantic ``ProvenanceModel.schema_version`` doc comment.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

#: Initial release of the receipt wrapper. Bumped (as a string) whenever
#: the JSON shape evolves — consumers diff receipts across releases via
#: this field, so never reorder or drop existing keys without a bump.
RECEIPT_SCHEMA_VERSION = "1"

#: Canonical kind discriminator. Lets a consumer tell a Redline
#: transparency receipt apart from any other JSON blob without relying on
#: the HTTP Content-Type header.
RECEIPT_KIND = "redline.transparency.receipt"

#: AI Act articles Redline explicitly addresses. Mirror of
#: ``AI_ACT_ARTICLES`` in ``frontend/src/lib/transparency-config.ts``.
_AI_ACT_ARTICLES: list[dict[str, str]] = [
    {
        "reference": "Art. 13",
        "key": "art13",
        "surface": "/transparency, AnalysisFooter",
    },
    {
        "reference": "Art. 50",
        "key": "art50",
        "surface": "Disclaimer banner, AnalysisFooter",
    },
]

#: Canonical LLM pipeline. Mirror of ``PIPELINE_STEPS`` on the frontend.
_PIPELINE_STEPS: list[dict[str, Any]] = [
    {"key": "pass0", "label": "Pass 0 · overview", "is_llm_call": True},
    {"key": "redaction", "label": "Redaction", "is_llm_call": False},
    {"key": "pass1", "label": "Pass 1 · extraction", "is_llm_call": True},
    {"key": "pass2", "label": "Pass 2 · risk", "is_llm_call": True},
    {"key": "chat", "label": "Chat (optional)", "is_llm_call": True},
]

#: Operator rollback levers. Mirror of ``OPERATOR_LEVERS`` on the frontend.
_OPERATOR_LEVERS: list[dict[str, Any]] = [
    {
        "key": "analysisLocaleOverride",
        "env_var": "ANALYSIS_LOCALE_OVERRIDE",
        "default_value": None,
    },
    {
        "key": "pass2RetryEnabled",
        "env_var": "PASS2_RETRY_ENABLED",
        "default_value": "true",
    },
    {
        "key": "retentionDays",
        "env_var": "RETENTION_DAYS",
        "default_value": "30",
    },
]

#: Known limitations. Mirror of ``LIMITATIONS`` on the frontend.
_LIMITATIONS: list[dict[str, str]] = [
    {"key": "hallucination"},
    {"key": "statuteShortlistGaps"},
    {"key": "notLegalAdvice"},
    {"key": "languageCoverage"},
]


def build_receipt(
    *,
    analysis_id: str | None,
    filename: str | None,
    clause_count: int,
    provenance: dict[str, Any],
) -> dict[str, Any]:
    """Serialise a transparency receipt for a single analysis.

    Pure function — callers pass the stored provenance dict plus the
    minimal metadata needed to identify the analysis. No contract text,
    no clause text, no user identifier ever lands in the receipt.

    ``provenance`` may be an empty dict for legacy rows saved before
    SP-1 Phase 5. In that case the ``schema_version`` on the wrapper
    falls back to the module-level default (``"1"``) so the receipt
    still carries a stable shape, and the provenance block is echoed
    through verbatim for auditors.
    """
    schema_version = provenance.get("schema_version") or RECEIPT_SCHEMA_VERSION
    analysis_locale = provenance.get("analysis_locale")
    return {
        "kind": RECEIPT_KIND,
        "schema_version": schema_version,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "analysis": {
            "id": analysis_id,
            "filename": filename,
            "clause_count": clause_count,
            "analysis_locale": analysis_locale,
        },
        "provenance": provenance,
        "pipeline": [dict(step) for step in _PIPELINE_STEPS],
        "ai_act_articles": [dict(a) for a in _AI_ACT_ARTICLES],
        "operator_levers": [dict(lever) for lever in _OPERATOR_LEVERS],
        "limitations": [dict(l) for l in _LIMITATIONS],
    }
