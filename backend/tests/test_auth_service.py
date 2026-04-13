"""Tests for auth business logic — token generation, hashing, session management."""

import re

from app.services.auth import (
    MAGIC_LINK_EXPIRY_MINUTES,
    SESSION_MAX_AGE_DAYS,
    generate_token,
    hash_token,
    verify_token_hash,
)


def test_generate_token_returns_url_safe_string():
    """Generated tokens are URL-safe base64 strings."""
    token = generate_token()
    assert len(token) > 20
    assert re.match(r'^[A-Za-z0-9_-]+={0,2}$', token)


def test_generate_token_is_unique():
    """Each call produces a different token."""
    tokens = {generate_token() for _ in range(100)}
    assert len(tokens) == 100


def test_hash_token_deterministic():
    """Same input always produces same hash."""
    token = "test-token-123"
    assert hash_token(token) == hash_token(token)


def test_hash_token_differs_for_different_input():
    """Different tokens produce different hashes."""
    assert hash_token("token-a") != hash_token("token-b")


def test_verify_token_hash_valid():
    """Correct token matches its hash."""
    token = generate_token()
    token_hash = hash_token(token)
    assert verify_token_hash(token, token_hash) is True


def test_verify_token_hash_invalid():
    """Wrong token does not match hash."""
    token_hash = hash_token("correct-token")
    assert verify_token_hash("wrong-token", token_hash) is False


def test_session_max_age_is_30_days():
    """Session tokens last 30 days."""
    assert SESSION_MAX_AGE_DAYS == 30


def test_magic_link_expiry_is_15_minutes():
    """Magic links expire after 15 minutes."""
    assert MAGIC_LINK_EXPIRY_MINUTES == 15
