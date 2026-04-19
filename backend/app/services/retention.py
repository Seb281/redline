"""Retention sweep — SP-5.

The daily cron job calls :func:`prune_expired` to delete saved
analyses whose ``expires_at`` has elapsed and which have not been
pinned. Runs inside the normal ``databases`` connection pool so it
shares the same config as the HTTP app; pin state and foreign keys
(``analyses(user_id)`` → ``users.id`` with ON DELETE CASCADE) are
respected by the DB layer.

Keeping the query narrow — ``pinned = FALSE AND expires_at <= now()``
— means pinned rows are safe regardless of age, and the partial index
``idx_analyses_expires_at`` matches this predicate for an O(log n)
sweep.
"""

from datetime import datetime, timezone

from databases import Database


async def prune_expired(db: Database, *, now: datetime | None = None) -> int:
    """Delete every unpinned analysis whose expiry has elapsed.

    Returns the number of rows removed so the caller can log or
    emit metrics. ``now`` is injectable for unit tests; production
    callers should let it default to the current UTC timestamp.
    """

    cutoff = now if now is not None else datetime.now(timezone.utc)

    rows = await db.fetch_all(
        """
        DELETE FROM analyses
        WHERE pinned = FALSE
          AND expires_at IS NOT NULL
          AND expires_at <= :now
        RETURNING id
        """,
        {"now": cutoff},
    )
    return len(rows)
