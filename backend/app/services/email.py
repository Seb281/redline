"""Email sending via Resend for magic link authentication."""

import os

import resend

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "Redline <noreply@redline.giupana.com>")


async def send_magic_link_email(email: str, magic_link_url: str) -> None:
    """Send a magic link login email to the given address.

    Raises ValueError if RESEND_API_KEY is not configured.
    """
    if not RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY not configured")

    resend.api_key = RESEND_API_KEY
    resend.Emails.send({
        "from": FROM_EMAIL,
        "to": [email],
        "subject": "Sign in to Redline",
        "html": (
            "<h2>Sign in to Redline</h2>"
            "<p>Click the link below to sign in. This link expires in 15 minutes.</p>"
            f'<a href="{magic_link_url}">Sign in to Redline</a>'
            "<p>If you didn't request this, you can ignore this email.</p>"
        ),
    })


async def send_account_deleted_email(email: str) -> None:
    """Send a confirmation receipt after a DSAR deletion (SP-6).

    Fire-and-forget from the caller's perspective: the deletion has
    already committed by the time this runs, so a send failure must
    not resurrect the account. Raises ValueError if RESEND_API_KEY is
    not configured so the caller can decide whether to log or swallow.
    """
    if not RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY not configured")

    resend.api_key = RESEND_API_KEY
    resend.Emails.send({
        "from": FROM_EMAIL,
        "to": [email],
        "subject": "Your Redline account has been deleted",
        "html": (
            "<h2>Account deleted</h2>"
            "<p>Your Redline account and all associated data have been "
            "permanently deleted at your request.</p>"
            "<p>This action is irreversible. If you would like to use "
            "Redline again in the future, you can create a new account "
            "at any time.</p>"
            "<p>If you did not request this deletion, please contact us "
            "immediately.</p>"
        ),
    })
