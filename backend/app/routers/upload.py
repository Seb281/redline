"""Upload endpoint — accepts PDF/DOCX, extracts text, returns metadata."""

from fastapi import APIRouter, HTTPException, UploadFile

from app.schemas import FileType, UploadResponse
from app.services.parser import parse_docx, parse_pdf

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/api/upload", response_model=UploadResponse)
async def upload_contract(file: UploadFile) -> UploadResponse:
    """Upload a contract file and extract its text content.

    Accepts PDF or DOCX files up to 10 MB. Extracts text via pdfplumber
    (PDF) or python-docx (DOCX). Raises 422 for unsupported types,
    oversized files, or documents with insufficient extractable text
    (e.g. scanned/image-based PDFs).
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

    if extension == "pdf":
        text, page_count = parse_pdf(content)
    else:
        text, page_count = parse_docx(content)

    if len(text) < 50:
        raise HTTPException(
            status_code=422,
            detail="Could not extract sufficient text. File may be scanned or image-based.",
        )

    return UploadResponse(
        filename=file.filename,
        file_type=FileType(extension),
        page_count=page_count,
        extracted_text=text,
        char_count=len(text),
    )
