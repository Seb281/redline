"""Tests for email sending service."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.email import send_magic_link_email


@pytest.mark.asyncio(loop_scope="session")
async def test_send_magic_link_email_calls_resend():
    """Magic link email sends via Resend with correct params."""
    with patch("app.services.email.RESEND_API_KEY", "re_test_key"), \
         patch("app.services.email.resend") as mock_resend:
        mock_resend.Emails.send = AsyncMock(return_value={"id": "test-id"})

        await send_magic_link_email(
            email="user@example.com",
            magic_link_url="https://app.example.com/auth/verify?token=abc123",
        )

        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["to"] == ["user@example.com"]
        assert "abc123" in call_args["html"]


@pytest.mark.asyncio(loop_scope="session")
async def test_send_magic_link_email_without_api_key_raises():
    """Email service raises ValueError if RESEND_API_KEY is not set."""
    with patch("app.services.email.RESEND_API_KEY", ""):
        with pytest.raises(ValueError, match="RESEND_API_KEY"):
            await send_magic_link_email(
                email="user@example.com",
                magic_link_url="https://example.com/verify",
            )
