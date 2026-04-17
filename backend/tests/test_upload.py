"""Tests for the upload endpoint."""

import shutil

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


_tesseract_available = shutil.which("tesseract") is not None
_poppler_available = shutil.which("pdftoppm") is not None
ocr_available = pytest.mark.skipif(
    not (_tesseract_available and _poppler_available),
    reason="tesseract or poppler not installed",
)


def test_upload_pdf_success(sample_pdf_bytes: bytes):
    """Uploading a valid PDF returns extracted text and metadata."""
    response = client.post(
        "/api/upload",
        files={"file": ("contract.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "contract.pdf"
    assert data["file_type"] == "pdf"
    assert data["page_count"] >= 1
    assert "CONSULTING AGREEMENT" in data["extracted_text"]
    assert data["char_count"] > 0


def test_upload_docx_success(sample_docx_bytes: bytes):
    """Uploading a valid DOCX returns extracted text and metadata."""
    response = client.post(
        "/api/upload",
        files={"file": ("contract.docx", sample_docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "contract.docx"
    assert data["file_type"] == "docx"
    assert "CONSULTING AGREEMENT" in data["extracted_text"]


def test_upload_unsupported_file_type():
    """Uploading an unsupported file type returns 422."""
    response = client.post(
        "/api/upload",
        files={"file": ("notes.txt", b"some text", "text/plain")},
    )
    assert response.status_code == 422
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_empty_pdf_returns_error(empty_pdf_bytes: bytes, monkeypatch):
    """Uploading a PDF with no extractable text returns 422.

    Under SP-1.5 an empty page is sparse and routes to OCR. We stub OCR
    to return empty strings so we're testing the upload router's
    <50-char rejection rather than depending on tesseract+poppler.
    """
    from app.services import parser

    monkeypatch.setattr(parser.ocr, "ocr_pages", lambda _b, indices: {i: "" for i in indices})

    response = client.post(
        "/api/upload",
        files={"file": ("empty.pdf", empty_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 422
    assert "Could not extract" in response.json()["detail"]


# --- SP-1.5 text_source + OCR error mapping ---


def test_upload_native_pdf_reports_text_source_native(sample_pdf_bytes: bytes):
    """Native-text PDF upload returns text_source='native'."""
    response = client.post(
        "/api/upload",
        files={"file": ("contract.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 200
    assert response.json()["text_source"] == "native"


def test_upload_maps_ocr_limit_exceeded_to_422(monkeypatch):
    """A parser OCRLimitExceeded surfaces as HTTP 422 with the cap message."""
    from app.services import parser as parser_mod
    from app.routers import upload as upload_mod

    def _raise_cap(_bytes):
        raise parser_mod.OCRLimitExceeded("51 scanned pages exceeds cap of 50")

    monkeypatch.setattr(upload_mod, "parse_pdf", _raise_cap)

    response = client.post(
        "/api/upload",
        files={"file": ("big-scan.pdf", b"%PDF-1.4\n", "application/pdf")},
    )
    assert response.status_code == 422
    assert "50 pages" in response.json()["detail"]


def test_upload_maps_ocr_error_to_500(monkeypatch):
    """A parser OCRError (poppler/tesseract crash) surfaces as HTTP 500."""
    from app.services import ocr as ocr_mod
    from app.routers import upload as upload_mod

    def _raise_ocr(_bytes):
        raise ocr_mod.OCRError("tesseract unavailable")

    monkeypatch.setattr(upload_mod, "parse_pdf", _raise_ocr)

    response = client.post(
        "/api/upload",
        files={"file": ("scan.pdf", b"%PDF-1.4\n", "application/pdf")},
    )
    assert response.status_code == 500
    assert "OCR service unavailable" in response.json()["detail"]


@ocr_available
def test_upload_scanned_pdf_reports_text_source_ocr(scan_short_pdf_bytes: bytes):
    """Fully scanned PDF upload returns text_source='ocr'."""
    response = client.post(
        "/api/upload",
        files={"file": ("scan.pdf", scan_short_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 200
    assert response.json()["text_source"] == "ocr"


@ocr_available
def test_upload_over_cap_scan_returns_422_with_cap_message(scan_large_pdf_bytes: bytes):
    """51-page scan is rejected with the user-facing cap message."""
    response = client.post(
        "/api/upload",
        files={"file": ("big-scan.pdf", scan_large_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 422
    assert "50 pages" in response.json()["detail"]


@ocr_available
def test_upload_blank_scan_returns_scan_quality_error(scan_blank_pdf_bytes: bytes):
    """Near-empty scan produces the updated scan-quality error message."""
    response = client.post(
        "/api/upload",
        files={"file": ("blank.pdf", scan_blank_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 422
    assert "scan quality" in response.json()["detail"].lower()
