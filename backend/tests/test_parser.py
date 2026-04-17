"""Tests for document parsing service."""

from __future__ import annotations

import shutil

import pytest

from app.services.parser import OCRLimitExceeded, parse_docx, parse_pdf


tesseract_available = shutil.which("tesseract") is not None
poppler_available = shutil.which("pdftoppm") is not None
ocr_available = pytest.mark.skipif(
    not (tesseract_available and poppler_available),
    reason="tesseract or poppler not installed",
)


# --- DOCX (unchanged from pre-SP-1.5) ---


def test_parse_docx_extracts_text(sample_docx_bytes: bytes):
    """DOCX parser extracts readable text."""
    text, _ = parse_docx(sample_docx_bytes)
    assert "CONSULTING AGREEMENT" in text
    assert "NON-COMPETE" in text


def test_parse_docx_estimates_page_count(sample_docx_bytes: bytes):
    """DOCX parser estimates at least 1 page."""
    _, page_count = parse_docx(sample_docx_bytes)
    assert page_count >= 1


# --- PDF native path ---


def test_parse_pdf_extracts_text(sample_pdf_bytes: bytes):
    """PDF parser extracts readable text."""
    result = parse_pdf(sample_pdf_bytes)
    assert "CONSULTING AGREEMENT" in result.text
    assert "NON-COMPETE" in result.text
    assert result.page_count == 1


def test_parse_pdf_returns_page_count(sample_pdf_bytes: bytes):
    """PDF parser returns correct page count."""
    result = parse_pdf(sample_pdf_bytes)
    assert result.page_count >= 1


def test_parse_pdf_native_returns_native_text_source(sample_pdf_bytes: bytes):
    """A text-only PDF returns text_source='native' with no OCR pages."""
    result = parse_pdf(sample_pdf_bytes)
    assert result.text_source == "native"
    assert result.ocr_page_indices == []
    assert "CONSULTING AGREEMENT" in result.text


def test_parse_pdf_empty_triggers_ocr_path(empty_pdf_bytes: bytes, monkeypatch):
    """Blank PDF has 0 chars → sparse → OCR path with stubbed ocr_pages.

    An empty page falls under SPARSE_PAGE_CHARS, so the parser routes it
    through OCR. We stub ``ocr.ocr_pages`` to avoid depending on native
    binaries here; the parser's routing logic is what matters.
    """
    from app.services import parser

    def fake_ocr(_pdf_bytes, indices, *_args, **_kwargs):
        return {i: "" for i in indices}

    monkeypatch.setattr(parser.ocr, "ocr_pages", fake_ocr)

    result = parse_pdf(empty_pdf_bytes)
    assert result.text == ""
    assert result.page_count == 1
    assert result.text_source == "ocr"


# --- PDF OCR / hybrid paths (live binaries required) ---


@ocr_available
def test_parse_pdf_fully_scanned_returns_ocr(scan_short_pdf_bytes: bytes):
    """A fully-rendered PDF returns text_source='ocr' and OCR'd indices."""
    result = parse_pdf(scan_short_pdf_bytes)
    assert result.text_source == "ocr"
    assert result.ocr_page_indices == [0]
    assert "LEASE" in result.text.upper()


@ocr_available
def test_parse_pdf_hybrid_returns_hybrid(hybrid_pdf_bytes: bytes):
    """3 native + 2 scanned pages → text_source='hybrid' with [3, 4] OCR'd."""
    result = parse_pdf(hybrid_pdf_bytes)
    assert result.text_source == "hybrid"
    assert result.ocr_page_indices == [3, 4]
    assert "NATIVE PAGE 1" in result.text
    assert "SCANNED PAGE ONE" in result.text.upper()


# --- OCR page cap ---


@ocr_available
def test_parse_pdf_raises_when_ocr_page_cap_exceeded(scan_large_pdf_bytes: bytes):
    """A 51-page scanned PDF trips OCRLimitExceeded before any OCR runs."""
    with pytest.raises(OCRLimitExceeded):
        parse_pdf(scan_large_pdf_bytes)


def test_parse_pdf_partial_ocr_result_classifies_hybrid(monkeypatch):
    """If ocr_pages silently omits some requested indices, the result is hybrid.

    Classification tracks actual OCR coverage (returned keys), not what
    we asked for. A fully-sparse 3-page PDF where OCR only returns 2 of
    3 pages should still land in ``hybrid`` territory.
    """
    from app.services import parser

    class _FakePage:
        @staticmethod
        def extract_text() -> str:
            return ""

    class _FakePdf:
        pages = [_FakePage()] * 3

        def __enter__(self):
            return self

        def __exit__(self, *_a):
            return False

    monkeypatch.setattr(parser.pdfplumber, "open", lambda _bytes: _FakePdf())
    # OCR silently drops page index 2.
    monkeypatch.setattr(
        parser.ocr,
        "ocr_pages",
        lambda _bytes, indices: {0: "page zero text", 1: "page one text"},
    )

    result = parser.parse_pdf(b"")
    assert result.text_source == "hybrid"


def test_parse_pdf_cap_boundary_51_pages_raises(monkeypatch):
    """51 sparse pages tips over the cap (boundary negative, no native deps)."""
    from app.services import parser

    class _FakePage:
        @staticmethod
        def extract_text() -> str:
            return ""

    class _FakePdf:
        pages = [_FakePage()] * 51

        def __enter__(self):
            return self

        def __exit__(self, *_a):
            return False

    monkeypatch.setattr(parser.pdfplumber, "open", lambda _bytes: _FakePdf())

    with pytest.raises(OCRLimitExceeded):
        parser.parse_pdf(b"")


def test_parse_pdf_cap_boundary_50_pages_does_not_raise(monkeypatch):
    """Exactly 50 sparse pages is allowed — the cap is strict ``>``."""
    from app.services import parser

    class _FakePage:
        @staticmethod
        def extract_text() -> str:
            return ""

    class _FakePdf:
        pages = [_FakePage()] * 50

        def __enter__(self):
            return self

        def __exit__(self, *_a):
            return False

    monkeypatch.setattr(parser.pdfplumber, "open", lambda _bytes: _FakePdf())
    monkeypatch.setattr(
        parser.ocr,
        "ocr_pages",
        lambda _bytes, indices: {i: "text" * 20 for i in indices},
    )

    result = parser.parse_pdf(b"")
    assert result.text_source == "ocr"
    assert len(result.ocr_page_indices) == 50
