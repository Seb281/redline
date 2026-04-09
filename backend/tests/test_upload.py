"""Tests for the upload endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


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


def test_upload_empty_pdf_returns_error(empty_pdf_bytes: bytes):
    """Uploading a PDF with no extractable text returns 422."""
    response = client.post(
        "/api/upload",
        files={"file": ("empty.pdf", empty_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 422
    assert "Could not extract" in response.json()["detail"]
