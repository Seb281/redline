"""Tests for document parsing service."""

from app.services.parser import parse_pdf, parse_docx


def test_parse_pdf_extracts_text(sample_pdf_bytes: bytes):
    """PDF parser extracts readable text."""
    text, page_count = parse_pdf(sample_pdf_bytes)
    assert "CONSULTING AGREEMENT" in text
    assert "NON-COMPETE" in text
    assert page_count == 1


def test_parse_pdf_returns_page_count(sample_pdf_bytes: bytes):
    """PDF parser returns correct page count."""
    _, page_count = parse_pdf(sample_pdf_bytes)
    assert page_count >= 1


def test_parse_docx_extracts_text(sample_docx_bytes: bytes):
    """DOCX parser extracts readable text."""
    text, page_count = parse_docx(sample_docx_bytes)
    assert "CONSULTING AGREEMENT" in text
    assert "NON-COMPETE" in text


def test_parse_docx_estimates_page_count(sample_docx_bytes: bytes):
    """DOCX parser estimates at least 1 page."""
    _, page_count = parse_docx(sample_docx_bytes)
    assert page_count >= 1


def test_parse_pdf_empty_returns_empty_string(empty_pdf_bytes: bytes):
    """PDF parser returns empty string for blank PDF."""
    text, page_count = parse_pdf(empty_pdf_bytes)
    assert text == ""
    assert page_count == 1
