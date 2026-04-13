"""Authentication business logic — token generation, hashing, validation."""

import hashlib
import secrets

SESSION_MAX_AGE_DAYS = 30
MAGIC_LINK_EXPIRY_MINUTES = 15


def generate_token() -> str:
    """Generate a cryptographically secure URL-safe token (32 bytes)."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 hash a token for safe database storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def verify_token_hash(token: str, token_hash: str) -> bool:
    """Verify a plaintext token against its stored hash."""
    return secrets.compare_digest(hash_token(token), token_hash)
