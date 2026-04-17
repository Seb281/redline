"""Tests for /api/health — including the SP-1.5 OCR readiness probe."""

from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_ok_and_ocr_status():
    """/api/health includes an ``ocr`` sub-status alongside ``status``."""
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["ocr"] in ("ok", "unavailable")


def test_health_reports_ocr_unavailable_when_binaries_missing():
    """When tesseract/poppler aren't on PATH, health reports ``ocr='unavailable'``."""
    with patch("app.main.ocr_healthcheck", return_value=False):
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["ocr"] == "unavailable"


def test_health_reports_ocr_ok_when_binaries_present():
    """When both binaries are present, health reports ``ocr='ok'``."""
    with patch("app.main.ocr_healthcheck", return_value=True):
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["ocr"] == "ok"
