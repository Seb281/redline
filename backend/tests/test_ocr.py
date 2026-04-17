"""Tests for the Tesseract OCR wrapper (SP-1.5).

Tests split into two classes:
    * Mocked tests — always run; patch ``pdf2image`` and ``pytesseract``
      so the subprocess paths are exercised without native binaries.
    * Live tests — require real tesseract + poppler on PATH; auto-skip
      when absent so CI without the native deps stays green.
"""

from __future__ import annotations

import shutil
import subprocess
from unittest.mock import MagicMock, patch

import pytest

from app.services import ocr
from app.services.ocr import OCRError, ocr_pages


tesseract_available = shutil.which("tesseract") is not None
poppler_available = shutil.which("pdftoppm") is not None
native_available = tesseract_available and poppler_available

requires_native = pytest.mark.skipif(
    not native_available,
    reason="tesseract or poppler not installed in this environment",
)


# --- Mocked tests (no native deps required) ---


def test_ocr_pages_empty_indices_is_noop():
    """Empty indices list returns ``{}`` without touching the OCR stack."""
    with patch.object(ocr.pdf2image, "convert_from_bytes") as mock_conv, \
         patch.object(ocr.pytesseract, "image_to_string") as mock_ocr:
        assert ocr_pages(b"ignored", page_indices=[]) == {}
        mock_conv.assert_not_called()
        mock_ocr.assert_not_called()


def test_ocr_pages_renders_only_requested_indices():
    """Only the requested page indices trigger pdf2image calls."""
    mock_image = MagicMock()
    with patch.object(ocr.pdf2image, "convert_from_bytes", return_value=[mock_image]) as mock_conv, \
         patch.object(ocr.pytesseract, "image_to_string", return_value="text"):
        result = ocr_pages(b"pdf", page_indices=[2, 5])

    assert result == {2: "text", 5: "text"}
    assert mock_conv.call_count == 2
    first_call_kwargs = mock_conv.call_args_list[0].kwargs
    second_call_kwargs = mock_conv.call_args_list[1].kwargs
    # pdf2image uses 1-indexed pages; we translate from zero-based.
    assert (first_call_kwargs["first_page"], first_call_kwargs["last_page"]) == (3, 3)
    assert (second_call_kwargs["first_page"], second_call_kwargs["last_page"]) == (6, 6)


def test_ocr_pages_raises_on_tesseract_runtime_error():
    """A non-zero tesseract exit surfaces as OCRError."""
    mock_image = MagicMock()
    with patch.object(ocr.pdf2image, "convert_from_bytes", return_value=[mock_image]), \
         patch.object(
             ocr.pytesseract,
             "image_to_string",
             side_effect=RuntimeError("tesseract crashed"),
         ):
        with pytest.raises(OCRError, match="Tesseract failed"):
            ocr_pages(b"pdf", page_indices=[0])


def test_ocr_pages_raises_on_tesseract_error():
    """A ``pytesseract.TesseractError`` (non-zero exit) surfaces as OCRError."""
    import pytesseract as _pt

    mock_image = MagicMock()
    with patch.object(ocr.pdf2image, "convert_from_bytes", return_value=[mock_image]), \
         patch.object(
             ocr.pytesseract,
             "image_to_string",
             side_effect=_pt.TesseractError(1, "language pack missing"),
         ):
        with pytest.raises(OCRError, match="Tesseract failed"):
            ocr_pages(b"pdf", page_indices=[0])


def test_ocr_pages_raises_on_timeout():
    """``subprocess.TimeoutExpired`` from pytesseract becomes OCRError."""
    mock_image = MagicMock()
    timeout = subprocess.TimeoutExpired(cmd="tesseract", timeout=30)
    with patch.object(ocr.pdf2image, "convert_from_bytes", return_value=[mock_image]), \
         patch.object(ocr.pytesseract, "image_to_string", side_effect=timeout):
        with pytest.raises(OCRError, match="Tesseract failed"):
            ocr_pages(b"pdf", page_indices=[0])


def test_ocr_pages_raises_when_pdf2image_returns_empty():
    """An empty images list from pdf2image is treated as a hard error."""
    with patch.object(ocr.pdf2image, "convert_from_bytes", return_value=[]):
        with pytest.raises(OCRError, match="no image"):
            ocr_pages(b"pdf", page_indices=[0])


def test_ocr_pages_wraps_pdf2image_exceptions_as_ocr_error():
    """Any rendering failure is surfaced as OCRError, not the raw type."""
    with patch.object(
        ocr.pdf2image,
        "convert_from_bytes",
        side_effect=RuntimeError("poppler boom"),
    ):
        with pytest.raises(OCRError, match="Failed to render page 0"):
            ocr_pages(b"pdf", page_indices=[0])


def test_healthcheck_returns_false_when_tesseract_missing():
    """healthcheck reports False when tesseract is absent from PATH."""
    def fake_which(name: str) -> str | None:
        return "/usr/bin/pdftoppm" if name == "pdftoppm" else None

    with patch.object(ocr.shutil, "which", side_effect=fake_which):
        assert ocr.healthcheck() is False


def test_healthcheck_returns_false_when_poppler_missing():
    """healthcheck reports False when poppler's pdftoppm is absent."""
    def fake_which(name: str) -> str | None:
        return "/usr/bin/tesseract" if name == "tesseract" else None

    with patch.object(ocr.shutil, "which", side_effect=fake_which):
        assert ocr.healthcheck() is False


def test_healthcheck_returns_true_when_both_present():
    """healthcheck reports True when both binaries are on PATH."""
    with patch.object(ocr.shutil, "which", return_value="/usr/bin/x"):
        assert ocr.healthcheck() is True


# --- Live tests (require real tesseract + poppler) ---


@requires_native
def test_ocr_pages_extracts_text_from_scanned_pdf(scan_short_pdf_bytes: bytes):
    """Real tesseract pulls known text out of a rendered raster PDF."""
    result = ocr_pages(scan_short_pdf_bytes, page_indices=[0])
    assert set(result.keys()) == {0}
    # Tesseract can introduce minor noise; match on a robust uppercase token.
    assert "LEASE" in result[0].upper()
