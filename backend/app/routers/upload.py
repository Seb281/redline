"""Upload endpoint — accepts PDF/DOCX, extracts text, returns metadata.

SP-1.5: PDF uploads may trigger on-device OCR for sparse pages. The
``text_source`` field in the response tells the frontend whether OCR
ran so the analysis footer can surface the fact.
"""

import logging

from fastapi import APIRouter, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas import FileType, UploadResponse
from app.services.ocr import OCRError
from app.services.parser import OCRLimitExceeded, parse_docx, parse_pdf

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MIN_EXTRACTED_CHARS = 50


@router.post("/api/upload", response_model=UploadResponse)
@limiter.limit("10/hour")
async def upload_contract(request: Request, file: UploadFile) -> UploadResponse:
    """Upload a contract file and extract its text content.

    Accepts PDF or DOCX files up to 10 MB. Extracts text via pdfplumber
    (PDF) with a Tesseract fallback for scanned pages, or python-docx
    (DOCX). Raises 422 for unsupported types, oversized files, scanned
    contracts over the 50-page OCR cap, or documents whose extracted
    text falls below :data:`MIN_EXTRACTED_CHARS`.
    """
    if not file.filename:
        raise HTTPException(status_code=422, detail="No filename provided.")

    extension = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if extension not in ("pdf", "docx"):
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type: .{extension}. Upload a PDF or DOCX.",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=422, detail="File exceeds 10MB limit.")

    text_source: str = "native"

    if extension == "pdf":
        try:
            result = parse_pdf(content)
        except OCRLimitExceeded:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Scanned contracts over 50 pages aren't supported yet — "
                    "try splitting the document."
                ),
            )
        except OCRError as exc:
            logger.error("OCR subsystem failure: %s", exc)
            raise HTTPException(
                status_code=500,
                detail="OCR service unavailable. Please try again.",
            )
        text, page_count, text_source = (
            result.text,
            result.page_count,
            result.text_source,
        )
        logger.info(
            "upload parsed: pages=%d sparse=%d text_source=%s",
            result.page_count,
            len(result.ocr_page_indices),
            result.text_source,
        )
    else:
        # DOCX has no OCR path — text_source is always "native" here.
        text, page_count = parse_docx(content)
        text_source = "native"

    if len(text) < MIN_EXTRACTED_CHARS:
        detail = (
            "Could not extract sufficient text. Scan quality may be too low."
            if text_source in ("ocr", "hybrid")
            else "Could not extract sufficient text. File may be scanned or image-based."
        )
        raise HTTPException(status_code=422, detail=detail)

    return UploadResponse(
        filename=file.filename,
        file_type=FileType(extension),
        page_count=page_count,
        extracted_text=text,
        char_count=len(text),
        text_source=text_source,
    )
