"""Document text extraction for PDF and DOCX files.

SP-1.5 introduces a per-page OCR fallback: pdfplumber runs first, then
pages with fewer than :data:`SPARSE_PAGE_CHARS` characters are sent to
:func:`app.services.ocr.ocr_pages`. Callers receive a
:class:`PdfParseResult` with a ``text_source`` tag so provenance can
record whether OCR ran and which pages were OCR'd.

The OCR queue is capped by :data:`OCR_PAGE_CAP`. When a PDF would send
more sparse pages than the cap, :class:`OCRLimitExceeded` is raised so
the upload router can surface a clear user-facing message instead of
burning minutes on a runaway Tesseract loop.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO
from typing import Literal

import pdfplumber
from docx import Document

from app.services import ocr

SPARSE_PAGE_CHARS = 50
"""Per-page character threshold below which we treat a page as scanned."""

OCR_PAGE_CAP = 50
"""Hard cap on the number of pages sent to OCR for a single PDF."""

TextSource = Literal["native", "ocr", "hybrid"]


class OCRLimitExceeded(Exception):
    """Raised when the count of sparse pages exceeds :data:`OCR_PAGE_CAP`.

    The caller (upload router) translates this to an HTTP 422 so the
    user sees a clear message instead of a Tesseract-bound timeout.
    """


@dataclass
class PdfParseResult:
    """Outcome of :func:`parse_pdf`.

    Attributes:
        text: Merged text across all pages, joined with double newlines.
        page_count: Total page count from pdfplumber.
        text_source: ``"native"`` when no OCR ran, ``"ocr"`` when every
            page was OCR'd, ``"hybrid"`` when only some pages were.
        ocr_page_indices: Zero-based indices of pages sent through OCR.
    """

    text: str
    page_count: int
    text_source: TextSource
    ocr_page_indices: list[int] = field(default_factory=list)


def parse_pdf(content: bytes) -> PdfParseResult:
    """Extract text from PDF bytes with per-page OCR fallback.

    pdfplumber extracts every page first. Any page under
    :data:`SPARSE_PAGE_CHARS` characters is queued for OCR; the queue is
    capped by :data:`OCR_PAGE_CAP`. OCR output replaces the sparse pages
    and the result is merged back in original page order so citations
    and snippets keep their positions.

    Raises:
        OCRLimitExceeded: When more than :data:`OCR_PAGE_CAP` pages
            would be sent to OCR.
    """
    with pdfplumber.open(BytesIO(content)) as pdf:
        native_pages = [(page.extract_text() or "").strip() for page in pdf.pages]

    sparse_indices = [
        i for i, page_text in enumerate(native_pages) if len(page_text) < SPARSE_PAGE_CHARS
    ]

    if not sparse_indices:
        merged = "\n\n".join(native_pages).strip()
        return PdfParseResult(
            text=merged,
            page_count=len(native_pages),
            text_source="native",
            ocr_page_indices=[],
        )

    if len(sparse_indices) > OCR_PAGE_CAP:
        raise OCRLimitExceeded(
            f"{len(sparse_indices)} scanned pages exceeds cap of {OCR_PAGE_CAP}"
        )

    ocr_text = ocr.ocr_pages(content, sparse_indices)

    # If OCR silently omits a requested index, fall back to the sparse
    # native string for that page — then drop empty pages from the merge.
    merged_pages = [
        ocr_text.get(i, "").strip() if i in ocr_text else native_pages[i]
        for i in range(len(native_pages))
    ]
    merged = "\n\n".join(p for p in merged_pages if p).strip()

    # Classify by actual OCR coverage (keys returned), not the request.
    # A partial result means some pages stayed native → "hybrid".
    text_source: TextSource = (
        "ocr" if len(ocr_text) == len(native_pages) else "hybrid"
    )

    return PdfParseResult(
        text=merged,
        page_count=len(native_pages),
        text_source=text_source,
        ocr_page_indices=sparse_indices,
    )


def parse_docx(content: bytes) -> tuple[str, int]:
    """Extract text and a page-count estimate from DOCX bytes.

    DOCX does not store page breaks, so page count is estimated from
    character count (~3000 chars per page). OCR never applies here.
    """
    doc = Document(BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    text = "\n\n".join(paragraphs).strip()
    page_count = max(1, len(text) // 3000)
    return text, page_count
