"""Export endpoint — generates PDF report from analysis data."""

from fastapi import APIRouter
from fastapi.responses import Response

from app.schemas import AnalyzeResponse
from app.services.exporter import generate_pdf

router = APIRouter()


@router.post("/api/export/pdf")
async def export_pdf(data: AnalyzeResponse) -> Response:
    """Generate a PDF report from the analysis response."""
    pdf_bytes = generate_pdf(data)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=redline-report.pdf"},
    )
