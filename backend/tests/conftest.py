"""Shared test fixtures for Redline backend tests."""

from io import BytesIO

import pytest
from docx import Document
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


SAMPLE_CONTRACT_TEXT = (
    "CONSULTING AGREEMENT\n\n"
    "1. NON-COMPETE\n"
    "The Consultant agrees not to work for any competitor "
    "within Europe for a period of 2 years after termination.\n\n"
    "2. GOVERNING LAW\n"
    "This Agreement shall be governed by the laws of the State of Delaware."
)


@pytest.fixture
def sample_pdf_bytes() -> bytes:
    """Generate a minimal PDF with sample contract text."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    y = 720
    for line in SAMPLE_CONTRACT_TEXT.split("\n"):
        c.drawString(72, y, line)
        y -= 18
    c.showPage()
    c.save()
    return buffer.getvalue()


@pytest.fixture
def sample_docx_bytes() -> bytes:
    """Generate a minimal DOCX with sample contract text."""
    doc = Document()
    for paragraph in SAMPLE_CONTRACT_TEXT.split("\n"):
        if paragraph.strip():
            doc.add_paragraph(paragraph)
    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


@pytest.fixture
def empty_pdf_bytes() -> bytes:
    """Generate a PDF with no text content."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.showPage()
    c.save()
    return buffer.getvalue()
