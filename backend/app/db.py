"""Database connection pool and lifecycle management."""

import os

from databases import Database

DATABASE_URL = os.environ.get("DATABASE_URL", "")

database = Database(DATABASE_URL) if DATABASE_URL else None


async def connect_db() -> None:
    """Connect to the database pool. No-op if DATABASE_URL is not set."""
    if database is not None:
        await database.connect()


async def disconnect_db() -> None:
    """Disconnect the database pool. No-op if DATABASE_URL is not set."""
    if database is not None:
        await database.disconnect()


def get_db() -> Database | None:
    """Return the database instance, or None if not configured."""
    return database
