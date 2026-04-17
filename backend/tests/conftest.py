"""Shared test fixtures for Redline backend tests."""

from io import BytesIO

import pytest
from docx import Document
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.schemas import AnalyzedClause, ClauseCategory, RiskLevel


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


# --- SP-1.5 scanned-PDF fixtures ---
#
# These PDFs are rendered as raster images (text drawn onto a PIL canvas,
# then saved as a PDF), so pdfplumber extracts zero text from them and
# the parser's OCR fallback is exercised. Arial is preferred for OCR
# legibility; a default bitmap font is used when Arial isn't present
# (Linux CI).


def _load_font(size: int = 48) -> ImageFont.ImageFont:
    """Load a legible TTF font, falling back to the PIL default bitmap.

    Arial ships on macOS and most Linux distributions via the msttcore
    package; CI without it falls back to a smaller bitmap font — still
    OCR-legible at these sizes because we render short uppercase text.
    """
    for path in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _raster_pdf_page(draw_text: str) -> Image.Image:
    """Return a single PIL image representing one rendered PDF page."""
    img = Image.new("RGB", (1200, 1600), "white")
    draw = ImageDraw.Draw(img)
    font = _load_font(48)
    draw.text((100, 100), draw_text, fill="black", font=font)
    return img


@pytest.fixture
def scan_short_pdf_bytes() -> bytes:
    """Single-page raster PDF containing 'LEASE AGREEMENT' as an image.

    pdfplumber extracts no text; Tesseract must see the pixels.
    Used by OCR tests (live + mocked via conftest coupling) and parser
    tests.
    """
    img = _raster_pdf_page("LEASE AGREEMENT")
    buffer = BytesIO()
    img.save(buffer, format="PDF", resolution=200.0)
    return buffer.getvalue()


@pytest.fixture
def hybrid_pdf_bytes() -> bytes:
    """5-page PDF: 3 native-text pages + 2 rendered-image pages.

    Exercises the per-page merge path in ``parser.parse_pdf``: the
    parser keeps pdfplumber output for native pages and only sends
    sparse pages through Tesseract.
    """
    from pypdf import PdfReader, PdfWriter

    # Native pages 1-3 via reportlab.
    native_buffer = BytesIO()
    c = canvas.Canvas(native_buffer, pagesize=letter)
    for idx in range(3):
        c.drawString(72, 720, f"NATIVE PAGE {idx + 1} contract preamble and signatures text")
        c.showPage()
    c.save()

    # Pages 4-5 as rendered images wrapped in a PDF.
    scanned_buffer = BytesIO()
    img_a = _raster_pdf_page("SCANNED PAGE ONE LEASE TERMS")
    img_b = _raster_pdf_page("SCANNED PAGE TWO SIGNATURES")
    img_a.save(
        scanned_buffer,
        format="PDF",
        resolution=200.0,
        save_all=True,
        append_images=[img_b],
    )

    # Concatenate with pypdf.
    writer = PdfWriter()
    for src in (native_buffer.getvalue(), scanned_buffer.getvalue()):
        reader = PdfReader(BytesIO(src))
        for page in reader.pages:
            writer.add_page(page)
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


@pytest.fixture
def scan_large_pdf_bytes() -> bytes:
    """51-page raster PDF. Exercises the 50-page OCR cap."""
    pages = [_raster_pdf_page(f"SCANNED PAGE {i + 1}") for i in range(51)]
    buffer = BytesIO()
    pages[0].save(
        buffer,
        format="PDF",
        resolution=100.0,
        save_all=True,
        append_images=pages[1:],
    )
    return buffer.getvalue()


@pytest.fixture
def scan_blank_pdf_bytes() -> bytes:
    """Near-empty raster PDF. Exercises the post-OCR <50-chars fallback."""
    img = Image.new("RGB", (1200, 1600), "white")
    # A single pixel — pdfplumber sees nothing, Tesseract sees nothing.
    ImageDraw.Draw(img).point((600, 800), fill="black")
    buffer = BytesIO()
    img.save(buffer, format="PDF", resolution=200.0)
    return buffer.getvalue()


@pytest.fixture
def sample_analyzed_clauses() -> list[AnalyzedClause]:
    """Pre-built analyzed clauses for testing."""
    return [
        AnalyzedClause(
            clause_text="The Consultant agrees not to work for any competitor within Europe for a period of 2 years after termination.",
            category=ClauseCategory.NON_COMPETE,
            title="Non-Compete Restriction",
            plain_english="You cannot work for competitors in Europe for 2 years after leaving.",
            risk_level=RiskLevel.HIGH,
            risk_explanation="2-year duration and Europe-wide scope is unusually broad.",
            negotiation_suggestion="Request reduction to 6 months and limit to your city.",
            is_unusual=True,
            unusual_explanation="Most non-competes are limited to 6-12 months and a specific region.",
        ),
        AnalyzedClause(
            clause_text="This Agreement shall be governed by the laws of the State of Delaware.",
            category=ClauseCategory.GOVERNING_LAW,
            title="Governing Law",
            plain_english="Delaware law applies to this contract.",
            risk_level=RiskLevel.LOW,
            risk_explanation="Standard governing law clause.",
            negotiation_suggestion=None,
            is_unusual=False,
            unusual_explanation=None,
        ),
    ]
