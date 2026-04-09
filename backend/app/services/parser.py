"""Document text extraction for PDF and DOCX files."""

from io import BytesIO

import pdfplumber
from docx import Document


def parse_pdf(content: bytes) -> tuple[str, int]:
    """Extract text and page count from PDF bytes.

    Returns a tuple of (extracted_text, page_count). Pages are joined
    with double newlines. Empty pages produce empty strings.
    """
    with pdfplumber.open(BytesIO(content)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
        text = "\n\n".join(pages).strip()
        return text, len(pdf.pages)


def parse_docx(content: bytes) -> tuple[str, int]:
    """Extract text and page count estimate from DOCX bytes.

    Returns a tuple of (extracted_text, estimated_page_count). Since DOCX
    files don't store page breaks explicitly, page count is estimated
    from character count (~3000 chars per page).
    """
    doc = Document(BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    text = "\n\n".join(paragraphs).strip()
    page_count = max(1, len(text) // 3000)
    return text, page_count
