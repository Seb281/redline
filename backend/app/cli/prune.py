"""Retention prune — SP-5 cron entry point.

Run as ``python -m app.cli.prune`` from a Railway scheduled job (or
any other cron runner that can exec a Python command). Connects to
the configured database, deletes every expired unpinned analysis,
logs the row count, and exits cleanly. No HTTP server, no long-lived
process — one sweep per invocation.

If ``DATABASE_URL`` is unset (e.g. dev without persistence enabled),
the script logs a message and exits with status 0 so a misconfigured
cron job does not spam failure alerts.
"""

import asyncio
import logging
import sys

from app.db import connect_db, disconnect_db, get_db
from app.services.retention import prune_expired

logger = logging.getLogger("app.cli.prune")


async def _run() -> int:
    """Execute a single prune sweep.

    Returns the number of deleted rows so callers can assert on the
    sweep in integration tests; the module CLI entry point discards
    the return value and exits with status 0.
    """

    await connect_db()
    try:
        db = get_db()
        if db is None:
            logger.warning(
                "prune skipped: DATABASE_URL is not set; no persistence to clean"
            )
            return 0

        deleted = await prune_expired(db)
        logger.info("retention prune complete: deleted=%d", deleted)
        return deleted
    finally:
        await disconnect_db()


def main() -> None:
    """Module entry point. Configures logging and runs the sweep."""

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    try:
        asyncio.run(_run())
    except Exception:  # pragma: no cover - defensive logging
        logger.exception("retention prune failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
