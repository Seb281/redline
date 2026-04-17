"""Tesseract OCR wrapper for scanned-PDF fallback (SP-1.5).

All work is local — no network calls, no third-party vision model.
Images are rendered page-by-page via ``pdf2image`` (which shells out to
poppler's ``pdftoppm``) and each rendered page is fed into Tesseract
via ``pytesseract``. Only the explicitly-requested page indices are
rendered, so the caller controls both memory and wall-clock cost.

Design notes:
    * Language packs are joined with ``+`` and passed to Tesseract in a
      single invocation per page — Tesseract handles mixed-language text
      itself.
    * Each Tesseract call is bounded by ``OCR_PAGE_TIMEOUT_SECONDS`` so
      a single malformed page can't hang a whole request.
    * ``OCRError`` is the uniform exception the caller catches; the
      router translates it to an HTTP response.
"""

from __future__ import annotations

import shutil
import subprocess

import pdf2image
import pytesseract
from PIL import Image

OCR_DEFAULT_LANGS = "eng+fra+deu+nld+spa+ita"
"""Languages loaded for every OCR call — the SP-1.5 EU core set."""

OCR_DEFAULT_DPI = 200
"""Default render DPI. 200 is a good accuracy/latency trade-off for Tesseract."""

OCR_PAGE_TIMEOUT_SECONDS = 30
"""Hard per-page Tesseract timeout. Protects against hung subprocesses."""


class OCRError(Exception):
    """Raised when Tesseract or pdf2image fails.

    Uniform exception for any underlying failure (non-zero tesseract
    exit, timeout, poppler rendering error). Lets the router translate
    to a single HTTP response shape.
    """


def _render_page(pdf_bytes: bytes, page_index: int, dpi: int) -> Image.Image:
    """Render one PDF page (zero-indexed) to a PIL image via poppler.

    Only the requested page is rasterised; this keeps memory bounded
    for very large PDFs. ``pdf2image`` uses one-indexed page numbers
    internally, so we translate from our zero-indexed convention.
    """
    images = pdf2image.convert_from_bytes(
        pdf_bytes,
        dpi=dpi,
        first_page=page_index + 1,
        last_page=page_index + 1,
    )
    if not images:
        raise OCRError(f"pdf2image returned no image for page {page_index}")
    return images[0]


def _run_tesseract(image: Image.Image, langs: str) -> str:
    """Run Tesseract on a single image with a per-call timeout.

    Wraps ``pytesseract.image_to_string`` so underlying
    ``subprocess.TimeoutExpired`` and any ``RuntimeError`` from the
    tesseract subprocess surface as a single :class:`OCRError` to the
    caller.
    """
    try:
        return pytesseract.image_to_string(
            image,
            lang=langs,
            timeout=OCR_PAGE_TIMEOUT_SECONDS,
        )
    except (
        RuntimeError,
        subprocess.TimeoutExpired,
        pytesseract.TesseractError,
    ) as exc:
        raise OCRError(f"Tesseract failed: {exc}") from exc


def ocr_pages(
    pdf_bytes: bytes,
    page_indices: list[int],
    langs: str = OCR_DEFAULT_LANGS,
    dpi: int = OCR_DEFAULT_DPI,
) -> dict[int, str]:
    """Run OCR on the requested pages and return a page→text mapping.

    Args:
        pdf_bytes: Raw PDF bytes. The full PDF is needed because
            ``pdf2image`` seeks within the source to render specific
            pages; passing only the pages-of-interest isn't possible.
        page_indices: Zero-based page indices to render and OCR. An
            empty list is a no-op and returns ``{}`` without touching
            Tesseract.
        langs: Tesseract language string (``+``-joined codes).
        dpi: Render resolution passed to ``pdf2image``.

    Returns:
        Mapping of each requested page index to the extracted text.

    Raises:
        OCRError: On any rendering or Tesseract failure. The caller is
            expected to translate this into an HTTP response.
    """
    if not page_indices:
        return {}

    result: dict[int, str] = {}
    for index in page_indices:
        try:
            image = _render_page(pdf_bytes, index, dpi)
        except OCRError:
            raise
        except Exception as exc:  # pdf2image raises various subclasses
            raise OCRError(f"Failed to render page {index}: {exc}") from exc
        result[index] = _run_tesseract(image, langs)
    return result


def healthcheck() -> bool:
    """Report whether tesseract + poppler are both on PATH.

    Called from ``/api/health`` to surface OCR subsystem readiness and
    cheap enough to poll. No subprocesses are invoked — just
    ``shutil.which`` lookups.
    """
    return (
        shutil.which("tesseract") is not None
        and shutil.which("pdftoppm") is not None
    )
