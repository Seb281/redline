# Redline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI contract clause analyzer — upload PDF/DOCX, get structured risk report with clause-by-clause analysis, risk levels, and negotiation suggestions.

**Architecture:** Monorepo with thin FastAPI backend (document parsing + LLM orchestration) and smart Next.js frontend (all UX, state management, Markdown export). Stateless — no database. Two-pass LLM pipeline with optional fan-out "Think Hard" mode.

**Tech Stack:** Python/FastAPI, Next.js/Tailwind, Anthropic API (Claude), pdfplumber, python-docx, WeasyPrint, pnpm

---

## File Structure

### Backend (`backend/`)

| File | Responsibility |
|---|---|
| `pyproject.toml` | Dependencies and project config |
| `app/__init__.py` | Package marker |
| `app/main.py` | FastAPI app, CORS, router mounting |
| `app/schemas.py` | All Pydantic models (single source of truth for request/response shapes) |
| `app/routers/__init__.py` | Package marker |
| `app/routers/upload.py` | `POST /api/upload` — file validation, text extraction |
| `app/routers/analyze.py` | `POST /api/analyze` — LLM pipeline trigger |
| `app/routers/export.py` | `POST /api/export/pdf` — PDF report generation |
| `app/services/__init__.py` | Package marker |
| `app/services/parser.py` | PDF/DOCX text extraction logic |
| `app/services/analyzer.py` | LLM pipeline orchestration (extract + analyze + summarize) |
| `app/services/exporter.py` | HTML template rendering + WeasyPrint PDF generation |
| `app/prompts/__init__.py` | Package marker |
| `app/prompts/extract.py` | Clause extraction system/user prompts + tool schema |
| `app/prompts/analyze.py` | Clause analysis system/user prompts + tool schemas |
| `tests/__init__.py` | Package marker |
| `tests/conftest.py` | Shared fixtures (sample PDF/DOCX bytes, mock LLM responses) |
| `tests/test_schemas.py` | Schema validation tests |
| `tests/test_parser.py` | Document parsing tests |
| `tests/test_upload.py` | Upload endpoint tests |
| `tests/test_analyzer.py` | Analyzer service tests (mocked LLM) |
| `tests/test_analyze_endpoint.py` | Analyze endpoint tests (mocked service) |
| `tests/test_exporter.py` | PDF/HTML export tests |
| `tests/test_export_endpoint.py` | Export endpoint tests |

### Frontend (`frontend/`)

| File | Responsibility |
|---|---|
| `src/types/index.ts` | TypeScript types mirroring backend Pydantic schemas |
| `src/lib/api.ts` | Backend API client (upload, analyze, exportPdf) |
| `src/lib/export.ts` | Client-side Markdown generation + PDF download trigger |
| `src/components/Disclaimer.tsx` | "Not legal advice" banner |
| `src/components/FileUpload.tsx` | Drag-and-drop upload zone |
| `src/components/TextPreview.tsx` | Extracted text preview + Analyze button + Think Hard toggle |
| `src/components/RiskBadge.tsx` | Color-coded risk level badge |
| `src/components/ClauseCard.tsx` | Individual clause card with expandable details |
| `src/components/ReportView.tsx` | Summary bar + top risks + clause card list + export buttons |
| `src/app/layout.tsx` | Root layout with fonts, metadata |
| `src/app/page.tsx` | Main page — state machine managing upload/preview/analyzing/report views |

---

## Task 1: Backend Scaffolding

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/prompts/__init__.py`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "redline-backend"
version = "0.1.0"
description = "AI contract clause analyzer — backend API"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "pdfplumber>=0.11.0",
    "python-docx>=1.1.0",
    "anthropic>=0.49.0",
    "weasyprint>=63.0",
    "python-multipart>=0.0.18",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24.0",
    "httpx>=0.27.0",
    "reportlab>=4.0",
]
```

- [ ] **Step 2: Create package structure**

`backend/app/__init__.py` — empty file.

`backend/app/routers/__init__.py` — empty file.

`backend/app/services/__init__.py` — empty file.

`backend/app/prompts/__init__.py` — empty file.

`backend/tests/__init__.py` — empty file.

- [ ] **Step 3: Create FastAPI app with CORS**

`backend/app/main.py`:

```python
"""FastAPI application for Redline contract analysis API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Redline",
    description="AI contract clause analyzer",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
```

- [ ] **Step 4: Install dependencies and verify server starts**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --port 8000
```

Expected: Server starts, `GET http://localhost:8000/api/health` returns `{"status": "ok"}`. Kill the server after verifying.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: backend scaffolding with FastAPI app and CORS"
```

---

## Task 2: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas.py`
- Create: `backend/tests/test_schemas.py`

- [ ] **Step 1: Write failing tests for schema validation**

`backend/tests/test_schemas.py`:

```python
"""Tests for Pydantic request/response schemas."""

import pytest
from pydantic import ValidationError

from app.schemas import (
    AnalyzedClause,
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisSummary,
    ClauseCategory,
    ExtractedClause,
    RiskBreakdown,
    RiskLevel,
    UploadResponse,
)


def test_upload_response_valid():
    """UploadResponse accepts valid data."""
    data = UploadResponse(
        filename="test.pdf",
        file_type="pdf",
        page_count=3,
        extracted_text="Some contract text here that is long enough.",
        char_count=45,
    )
    assert data.filename == "test.pdf"
    assert data.file_type == "pdf"


def test_upload_response_rejects_invalid_file_type():
    """UploadResponse rejects unsupported file types."""
    with pytest.raises(ValidationError):
        UploadResponse(
            filename="test.txt",
            file_type="txt",
            page_count=1,
            extracted_text="text",
            char_count=4,
        )


def test_analyze_request_defaults():
    """AnalyzeRequest defaults think_hard to False."""
    req = AnalyzeRequest(text="Some contract text")
    assert req.think_hard is False


def test_extracted_clause_optional_section():
    """ExtractedClause allows missing section_reference."""
    clause = ExtractedClause(clause_text="The consultant agrees...")
    assert clause.section_reference is None


def test_analyzed_clause_valid():
    """AnalyzedClause accepts a fully populated clause."""
    clause = AnalyzedClause(
        clause_text="The consultant agrees not to compete...",
        category=ClauseCategory.NON_COMPETE,
        title="Non-Compete Restriction",
        plain_english="You cannot work for competitors for 2 years.",
        risk_level=RiskLevel.HIGH,
        risk_explanation="2-year duration is unusually broad.",
        negotiation_suggestion="Request reduction to 6 months.",
    )
    assert clause.risk_level == RiskLevel.HIGH
    assert clause.negotiation_suggestion is not None


def test_analyzed_clause_low_risk_no_suggestion():
    """Low-risk clauses can omit negotiation_suggestion."""
    clause = AnalyzedClause(
        clause_text="This agreement is governed by Delaware law.",
        category=ClauseCategory.GOVERNING_LAW,
        title="Governing Law",
        plain_english="Delaware law applies.",
        risk_level=RiskLevel.LOW,
        risk_explanation="Standard governing law clause.",
        negotiation_suggestion=None,
    )
    assert clause.negotiation_suggestion is None


def test_analyze_response_complete():
    """AnalyzeResponse accepts a full report structure."""
    response = AnalyzeResponse(
        summary=AnalysisSummary(
            total_clauses=2,
            risk_breakdown=RiskBreakdown(high=1, medium=0, low=1),
            top_risks=["Non-compete is unusually broad"],
        ),
        clauses=[
            AnalyzedClause(
                clause_text="Non-compete clause text",
                category=ClauseCategory.NON_COMPETE,
                title="Non-Compete",
                plain_english="You cannot compete.",
                risk_level=RiskLevel.HIGH,
                risk_explanation="Too broad.",
                negotiation_suggestion="Negotiate down.",
            ),
            AnalyzedClause(
                clause_text="Governing law clause text",
                category=ClauseCategory.GOVERNING_LAW,
                title="Governing Law",
                plain_english="Delaware law.",
                risk_level=RiskLevel.LOW,
                risk_explanation="Standard.",
                negotiation_suggestion=None,
            ),
        ],
    )
    assert response.summary.total_clauses == 2
    assert len(response.clauses) == 2


def test_risk_breakdown_rejects_negative():
    """RiskBreakdown rejects negative counts."""
    with pytest.raises(ValidationError):
        RiskBreakdown(high=-1, medium=0, low=0)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_schemas.py -v
```

Expected: ImportError — `app.schemas` does not exist yet.

- [ ] **Step 3: Implement all schemas**

`backend/app/schemas.py`:

```python
"""Pydantic models for all API request/response shapes."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class FileType(str, Enum):
    """Supported document file types."""

    PDF = "pdf"
    DOCX = "docx"


class UploadResponse(BaseModel):
    """Response from the upload endpoint after text extraction."""

    filename: str
    file_type: FileType
    page_count: int
    extracted_text: str
    char_count: int


class AnalyzeRequest(BaseModel):
    """Request body for the analyze endpoint."""

    text: str
    think_hard: bool = False


class RiskLevel(str, Enum):
    """Risk assessment level for a clause."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ClauseCategory(str, Enum):
    """Classification category for a contract clause."""

    NON_COMPETE = "non_compete"
    LIABILITY = "liability"
    TERMINATION = "termination"
    IP_ASSIGNMENT = "ip_assignment"
    CONFIDENTIALITY = "confidentiality"
    GOVERNING_LAW = "governing_law"
    INDEMNIFICATION = "indemnification"
    DATA_PROTECTION = "data_protection"
    PAYMENT_TERMS = "payment_terms"
    LIMITATION_OF_LIABILITY = "limitation_of_liability"
    FORCE_MAJEURE = "force_majeure"
    DISPUTE_RESOLUTION = "dispute_resolution"
    OTHER = "other"


class ExtractedClause(BaseModel):
    """A single clause extracted from a contract (Pass 1 output)."""

    clause_text: str
    section_reference: str | None = None


class AnalyzedClause(BaseModel):
    """A fully analyzed clause with risk assessment (Pass 2 output)."""

    clause_text: str
    category: ClauseCategory
    title: str
    plain_english: str
    risk_level: RiskLevel
    risk_explanation: str
    negotiation_suggestion: str | None = None


class RiskBreakdown(BaseModel):
    """Count of clauses by risk level."""

    high: int = Field(ge=0)
    medium: int = Field(ge=0)
    low: int = Field(ge=0)


class AnalysisSummary(BaseModel):
    """Summary statistics for the full contract analysis."""

    total_clauses: int
    risk_breakdown: RiskBreakdown
    top_risks: list[str]


class AnalyzeResponse(BaseModel):
    """Full response from the analyze endpoint."""

    summary: AnalysisSummary
    clauses: list[AnalyzedClause]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_schemas.py -v
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/tests/test_schemas.py
git commit -m "feat: add Pydantic schemas for all API request/response shapes"
```

---

## Task 3: Document Parser Service

**Files:**
- Create: `backend/app/services/parser.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_parser.py`

- [ ] **Step 1: Create test fixtures**

`backend/tests/conftest.py`:

```python
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
```

- [ ] **Step 2: Write failing parser tests**

`backend/tests/test_parser.py`:

```python
"""Tests for document parsing service."""

from app.services.parser import parse_pdf, parse_docx


def test_parse_pdf_extracts_text(sample_pdf_bytes: bytes):
    """PDF parser extracts readable text."""
    text, page_count = parse_pdf(sample_pdf_bytes)
    assert "CONSULTING AGREEMENT" in text
    assert "NON-COMPETE" in text
    assert page_count == 1


def test_parse_pdf_returns_page_count(sample_pdf_bytes: bytes):
    """PDF parser returns correct page count."""
    _, page_count = parse_pdf(sample_pdf_bytes)
    assert page_count >= 1


def test_parse_docx_extracts_text(sample_docx_bytes: bytes):
    """DOCX parser extracts readable text."""
    text, page_count = parse_docx(sample_docx_bytes)
    assert "CONSULTING AGREEMENT" in text
    assert "NON-COMPETE" in text


def test_parse_docx_estimates_page_count(sample_docx_bytes: bytes):
    """DOCX parser estimates at least 1 page."""
    _, page_count = parse_docx(sample_docx_bytes)
    assert page_count >= 1


def test_parse_pdf_empty_returns_empty_string(empty_pdf_bytes: bytes):
    """PDF parser returns empty string for blank PDF."""
    text, page_count = parse_pdf(empty_pdf_bytes)
    assert text == ""
    assert page_count == 1
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_parser.py -v
```

Expected: ImportError — `app.services.parser` does not exist yet.

- [ ] **Step 4: Implement parser service**

`backend/app/services/parser.py`:

```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_parser.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/parser.py backend/tests/conftest.py backend/tests/test_parser.py
git commit -m "feat: add PDF and DOCX text extraction parser service"
```

---

## Task 4: Upload Endpoint

**Files:**
- Create: `backend/app/routers/upload.py`
- Create: `backend/tests/test_upload.py`
- Modify: `backend/app/main.py` (add router)

- [ ] **Step 1: Write failing upload endpoint tests**

`backend/tests/test_upload.py`:

```python
"""Tests for the upload endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_upload_pdf_success(sample_pdf_bytes: bytes):
    """Uploading a valid PDF returns extracted text and metadata."""
    response = client.post(
        "/api/upload",
        files={"file": ("contract.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "contract.pdf"
    assert data["file_type"] == "pdf"
    assert data["page_count"] >= 1
    assert "CONSULTING AGREEMENT" in data["extracted_text"]
    assert data["char_count"] > 0


def test_upload_docx_success(sample_docx_bytes: bytes):
    """Uploading a valid DOCX returns extracted text and metadata."""
    response = client.post(
        "/api/upload",
        files={"file": ("contract.docx", sample_docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "contract.docx"
    assert data["file_type"] == "docx"
    assert "CONSULTING AGREEMENT" in data["extracted_text"]


def test_upload_unsupported_file_type():
    """Uploading an unsupported file type returns 422."""
    response = client.post(
        "/api/upload",
        files={"file": ("notes.txt", b"some text", "text/plain")},
    )
    assert response.status_code == 422
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_empty_pdf_returns_error(empty_pdf_bytes: bytes):
    """Uploading a PDF with no extractable text returns 422."""
    response = client.post(
        "/api/upload",
        files={"file": ("empty.pdf", empty_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 422
    assert "Could not extract" in response.json()["detail"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_upload.py -v
```

Expected: Failures — upload router not implemented, no route registered.

- [ ] **Step 3: Implement upload router**

`backend/app/routers/upload.py`:

```python
"""Upload endpoint — accepts PDF/DOCX, extracts text, returns metadata."""

from fastapi import APIRouter, HTTPException, UploadFile

from app.schemas import FileType, UploadResponse
from app.services.parser import parse_docx, parse_pdf

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/api/upload", response_model=UploadResponse)
async def upload_contract(file: UploadFile) -> UploadResponse:
    """Upload a contract file and extract its text content."""
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
```

- [ ] **Step 4: Mount router in main.py**

Add to `backend/app/main.py`, after the CORS middleware setup:

```python
from app.routers import upload

app.include_router(upload.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_upload.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/upload.py backend/tests/test_upload.py backend/app/main.py
git commit -m "feat: add upload endpoint with PDF/DOCX text extraction"
```

---

## Task 5: LLM Prompts and Analyzer Service

**Files:**
- Create: `backend/app/prompts/extract.py`
- Create: `backend/app/prompts/analyze.py`
- Create: `backend/app/services/analyzer.py`
- Create: `backend/tests/test_analyzer.py`
- Modify: `backend/tests/conftest.py` (add mock LLM fixtures)

- [ ] **Step 1: Create extraction prompt and tool schema**

`backend/app/prompts/extract.py`:

```python
"""Clause extraction prompt and tool schema for LLM Pass 1."""

EXTRACTION_SYSTEM_PROMPT = """\
You are a legal document analyzer. Your task is to identify and extract every \
significant clause from the provided contract text.

Rules:
- Extract the exact original text of each clause — do not paraphrase or summarize.
- Skip boilerplate: signature blocks, date lines, headers, recitals, and \
  definitions-only sections.
- Focus on substantive clauses that create obligations, restrictions, rights, \
  or liabilities for either party.
- Include the section reference (e.g., "Section 8.2") when identifiable from \
  the text.
- If a clause spans multiple paragraphs, include the full text as one clause.
"""

EXTRACTION_USER_PROMPT = """\
Extract all significant clauses from this contract:

{contract_text}"""

EXTRACTION_TOOL = {
    "name": "extract_clauses",
    "description": "Return all identified clauses from the contract.",
    "input_schema": {
        "type": "object",
        "properties": {
            "clauses": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "clause_text": {
                            "type": "string",
                            "description": "Exact original text of the clause.",
                        },
                        "section_reference": {
                            "type": "string",
                            "description": "Section number if identifiable (e.g., 'Section 3.1').",
                        },
                    },
                    "required": ["clause_text"],
                },
            },
        },
        "required": ["clauses"],
    },
}
```

- [ ] **Step 2: Create analysis prompts and tool schemas**

`backend/app/prompts/analyze.py`:

```python
"""Clause analysis prompts and tool schemas for LLM Pass 2."""

CATEGORY_ENUM = [
    "non_compete",
    "liability",
    "termination",
    "ip_assignment",
    "confidentiality",
    "governing_law",
    "indemnification",
    "data_protection",
    "payment_terms",
    "limitation_of_liability",
    "force_majeure",
    "dispute_resolution",
    "other",
]

ANALYSIS_SYSTEM_PROMPT = """\
You are a legal risk analyst. You assess contract clauses from the perspective \
of the weaker/non-drafting party — the freelancer, employee, or smaller company.

For each clause, provide:
1. A category from: {categories}
2. A short descriptive title (3-6 words)
3. A plain-English explanation (1-2 sentences, no legal jargon)
4. A risk level: low, medium, or high
5. A specific risk explanation — why this level, what makes it risky or safe
6. A negotiation suggestion — ONLY for medium and high risk clauses. \
   Set to null for low risk.

Risk calibration:
- non_compete: >12 months or nationwide/continental scope = high; \
  6-12 months local = medium; <6 months limited = low
- liability: unlimited liability = high; capped at contract value = medium; \
  reasonable caps with exclusions = low
- ip_assignment: covers pre-existing IP or work outside scope = high; \
  limited to deliverables created during engagement = low
- termination: no termination right or >90 days notice = high; \
  30-90 days = medium; <30 days mutual = low
- payment_terms: >60 days or no late payment provisions = high; \
  30-60 days = medium; <30 days with penalties = low
- indemnification: broad/uncapped indemnification by one party = high; \
  mutual and capped = low
- confidentiality: >5 years or perpetual with broad scope = high; \
  2-5 years reasonable scope = medium; standard NDA terms = low
- limitation_of_liability: excludes gross negligence/willful misconduct = high; \
  standard exclusions = low
- For other categories: assess how much the clause restricts the weaker party's \
  rights or creates asymmetric obligations.
""".format(categories=", ".join(CATEGORY_ENUM))

ANALYSIS_BATCH_USER_PROMPT = """\
Analyze all of the following contract clauses:

{clauses_json}"""

ANALYSIS_SINGLE_USER_PROMPT = """\
Analyze this contract clause:

{clause_json}"""

_ANALYZED_CLAUSE_SCHEMA = {
    "type": "object",
    "properties": {
        "clause_text": {"type": "string", "description": "Original clause text."},
        "category": {"type": "string", "enum": CATEGORY_ENUM},
        "title": {"type": "string", "description": "Short title (3-6 words)."},
        "plain_english": {
            "type": "string",
            "description": "Plain-English explanation (1-2 sentences).",
        },
        "risk_level": {"type": "string", "enum": ["low", "medium", "high"]},
        "risk_explanation": {"type": "string", "description": "Why this risk level."},
        "negotiation_suggestion": {
            "type": ["string", "null"],
            "description": "Suggestion for medium/high risk. Null for low risk.",
        },
    },
    "required": [
        "clause_text",
        "category",
        "title",
        "plain_english",
        "risk_level",
        "risk_explanation",
        "negotiation_suggestion",
    ],
}

ANALYSIS_BATCH_TOOL = {
    "name": "analyze_clauses",
    "description": "Return analysis for all clauses.",
    "input_schema": {
        "type": "object",
        "properties": {
            "clauses": {
                "type": "array",
                "items": _ANALYZED_CLAUSE_SCHEMA,
            },
        },
        "required": ["clauses"],
    },
}

ANALYSIS_SINGLE_TOOL = {
    "name": "analyze_clause",
    "description": "Return analysis for this single clause.",
    "input_schema": _ANALYZED_CLAUSE_SCHEMA,
}
```

- [ ] **Step 3: Add mock LLM fixtures to conftest.py**

Append to `backend/tests/conftest.py`:

```python
from app.schemas import AnalyzedClause, ClauseCategory, RiskLevel


MOCK_EXTRACTION_RESPONSE = {
    "clauses": [
        {
            "clause_text": "The Consultant agrees not to work for any competitor within Europe for a period of 2 years after termination.",
            "section_reference": "Section 1",
        },
        {
            "clause_text": "This Agreement shall be governed by the laws of the State of Delaware.",
            "section_reference": "Section 2",
        },
    ]
}

MOCK_ANALYSIS_RESPONSE = {
    "clauses": [
        {
            "clause_text": "The Consultant agrees not to work for any competitor within Europe for a period of 2 years after termination.",
            "category": "non_compete",
            "title": "Non-Compete Restriction",
            "plain_english": "You cannot work for competitors in Europe for 2 years after leaving.",
            "risk_level": "high",
            "risk_explanation": "2-year duration and Europe-wide scope is unusually broad.",
            "negotiation_suggestion": "Request reduction to 6 months and limit to your city.",
        },
        {
            "clause_text": "This Agreement shall be governed by the laws of the State of Delaware.",
            "category": "governing_law",
            "title": "Governing Law",
            "plain_english": "Delaware law applies to this contract.",
            "risk_level": "low",
            "risk_explanation": "Standard governing law clause. Delaware is a common and neutral choice.",
            "negotiation_suggestion": None,
        },
    ]
}

MOCK_SINGLE_ANALYSIS_RESPONSE = {
    "clause_text": "The Consultant agrees not to work for any competitor within Europe for a period of 2 years after termination.",
    "category": "non_compete",
    "title": "Non-Compete Restriction",
    "plain_english": "You cannot work for competitors in Europe for 2 years after leaving.",
    "risk_level": "high",
    "risk_explanation": "2-year duration and Europe-wide scope is unusually broad.",
    "negotiation_suggestion": "Request reduction to 6 months and limit to your city.",
}


@pytest.fixture
def mock_extraction_response():
    """Mock Anthropic API response for clause extraction."""
    return MOCK_EXTRACTION_RESPONSE


@pytest.fixture
def mock_analysis_response():
    """Mock Anthropic API response for batch clause analysis."""
    return MOCK_ANALYSIS_RESPONSE


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
        ),
        AnalyzedClause(
            clause_text="This Agreement shall be governed by the laws of the State of Delaware.",
            category=ClauseCategory.GOVERNING_LAW,
            title="Governing Law",
            plain_english="Delaware law applies to this contract.",
            risk_level=RiskLevel.LOW,
            risk_explanation="Standard governing law clause.",
            negotiation_suggestion=None,
        ),
    ]
```

- [ ] **Step 4: Write failing analyzer tests**

`backend/tests/test_analyzer.py`:

```python
"""Tests for the analyzer service with mocked Anthropic API."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas import AnalyzeResponse, ExtractedClause, RiskLevel
from app.services.analyzer import (
    analyze_contract,
    build_summary,
    extract_clauses,
)
from tests.conftest import (
    MOCK_ANALYSIS_RESPONSE,
    MOCK_EXTRACTION_RESPONSE,
    MOCK_SINGLE_ANALYSIS_RESPONSE,
)


def _make_tool_response(tool_name: str, tool_input: dict) -> SimpleNamespace:
    """Build a mock Anthropic response with a tool_use content block."""
    return SimpleNamespace(
        content=[
            SimpleNamespace(type="tool_use", name=tool_name, input=tool_input)
        ]
    )


@pytest.mark.asyncio
@patch("app.services.analyzer.client")
async def test_extract_clauses(mock_client):
    """extract_clauses returns parsed ExtractedClause list from LLM response."""
    mock_client.messages.create = AsyncMock(
        return_value=_make_tool_response("extract_clauses", MOCK_EXTRACTION_RESPONSE)
    )
    result = await extract_clauses("Some contract text")
    assert len(result) == 2
    assert isinstance(result[0], ExtractedClause)
    assert "non-compete" in result[0].clause_text.lower() or "competitor" in result[0].clause_text.lower()


@pytest.mark.asyncio
@patch("app.services.analyzer.client")
async def test_analyze_contract_default_mode(mock_client):
    """analyze_contract in default mode returns a valid AnalyzeResponse."""
    mock_client.messages.create = AsyncMock(
        side_effect=[
            _make_tool_response("extract_clauses", MOCK_EXTRACTION_RESPONSE),
            _make_tool_response("analyze_clauses", MOCK_ANALYSIS_RESPONSE),
        ]
    )
    result = await analyze_contract("Some contract text", think_hard=False)
    assert isinstance(result, AnalyzeResponse)
    assert result.summary.total_clauses == 2
    assert result.summary.risk_breakdown.high == 1
    assert result.summary.risk_breakdown.low == 1
    assert len(result.clauses) == 2


@pytest.mark.asyncio
@patch("app.services.analyzer.client")
async def test_analyze_contract_think_hard_mode(mock_client):
    """analyze_contract in think_hard mode fans out to per-clause calls."""
    mock_client.messages.create = AsyncMock(
        side_effect=[
            _make_tool_response("extract_clauses", MOCK_EXTRACTION_RESPONSE),
            _make_tool_response("analyze_clause", MOCK_SINGLE_ANALYSIS_RESPONSE),
            _make_tool_response("analyze_clause", {
                "clause_text": "This Agreement shall be governed by the laws of the State of Delaware.",
                "category": "governing_law",
                "title": "Governing Law",
                "plain_english": "Delaware law applies.",
                "risk_level": "low",
                "risk_explanation": "Standard clause.",
                "negotiation_suggestion": None,
            }),
        ]
    )
    result = await analyze_contract("Some contract text", think_hard=True)
    assert isinstance(result, AnalyzeResponse)
    assert result.summary.total_clauses == 2
    assert mock_client.messages.create.call_count == 3  # 1 extract + 2 analyze


def test_build_summary(sample_analyzed_clauses):
    """build_summary produces correct risk breakdown and top risks."""
    summary = build_summary(sample_analyzed_clauses)
    assert summary.total_clauses == 2
    assert summary.risk_breakdown.high == 1
    assert summary.risk_breakdown.medium == 0
    assert summary.risk_breakdown.low == 1
    assert len(summary.top_risks) == 1
    assert "Non-Compete" in summary.top_risks[0]
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_analyzer.py -v
```

Expected: ImportError — `app.services.analyzer` does not exist yet.

- [ ] **Step 6: Implement analyzer service**

`backend/app/services/analyzer.py`:

```python
"""LLM pipeline orchestration — clause extraction and analysis."""

import asyncio
import json
import os

from anthropic import AsyncAnthropic

from app.prompts.analyze import (
    ANALYSIS_BATCH_TOOL,
    ANALYSIS_BATCH_USER_PROMPT,
    ANALYSIS_SINGLE_TOOL,
    ANALYSIS_SINGLE_USER_PROMPT,
    ANALYSIS_SYSTEM_PROMPT,
)
from app.prompts.extract import (
    EXTRACTION_SYSTEM_PROMPT,
    EXTRACTION_TOOL,
    EXTRACTION_USER_PROMPT,
)
from app.schemas import (
    AnalyzedClause,
    AnalyzeResponse,
    AnalysisSummary,
    ExtractedClause,
    RiskBreakdown,
    RiskLevel,
)

client = AsyncAnthropic()
MODEL = os.environ.get("LLM_MODEL", "claude-sonnet-4-20250514")
DEFAULT_TIMEOUT = 60.0
FAN_OUT_TIMEOUT = 30.0


async def extract_clauses(text: str) -> list[ExtractedClause]:
    """Pass 1: Send full contract text, get back structured clause list."""
    response = await asyncio.wait_for(
        client.messages.create(
            model=MODEL,
            max_tokens=8192,
            system=EXTRACTION_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": EXTRACTION_USER_PROMPT.format(contract_text=text),
                }
            ],
            tools=[EXTRACTION_TOOL],
            tool_choice={"type": "tool", "name": "extract_clauses"},
        ),
        timeout=DEFAULT_TIMEOUT,
    )
    tool_block = next(b for b in response.content if b.type == "tool_use")
    return [ExtractedClause(**clause) for clause in tool_block.input["clauses"]]


async def _analyze_batch(clauses: list[ExtractedClause]) -> list[AnalyzedClause]:
    """Pass 2 (default): Analyze all clauses in a single LLM call."""
    clauses_json = json.dumps(
        [clause.model_dump() for clause in clauses], indent=2
    )
    response = await asyncio.wait_for(
        client.messages.create(
            model=MODEL,
            max_tokens=8192,
            system=ANALYSIS_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": ANALYSIS_BATCH_USER_PROMPT.format(
                        clauses_json=clauses_json
                    ),
                }
            ],
            tools=[ANALYSIS_BATCH_TOOL],
            tool_choice={"type": "tool", "name": "analyze_clauses"},
        ),
        timeout=DEFAULT_TIMEOUT,
    )
    tool_block = next(b for b in response.content if b.type == "tool_use")
    return [AnalyzedClause(**clause) for clause in tool_block.input["clauses"]]


async def _analyze_single(clause: ExtractedClause) -> AnalyzedClause:
    """Analyze a single clause (used in fan-out mode)."""
    clause_json = json.dumps(clause.model_dump(), indent=2)
    response = await asyncio.wait_for(
        client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=ANALYSIS_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": ANALYSIS_SINGLE_USER_PROMPT.format(
                        clause_json=clause_json
                    ),
                }
            ],
            tools=[ANALYSIS_SINGLE_TOOL],
            tool_choice={"type": "tool", "name": "analyze_clause"},
        ),
        timeout=FAN_OUT_TIMEOUT,
    )
    tool_block = next(b for b in response.content if b.type == "tool_use")
    return AnalyzedClause(**tool_block.input)


async def _analyze_fan_out(clauses: list[ExtractedClause]) -> list[AnalyzedClause]:
    """Pass 2 (think hard): Analyze each clause individually in parallel."""
    tasks = [_analyze_single(clause) for clause in clauses]
    return list(await asyncio.gather(*tasks))


def build_summary(clauses: list[AnalyzedClause]) -> AnalysisSummary:
    """Build summary statistics from analyzed clauses."""
    breakdown = RiskBreakdown(
        high=sum(1 for c in clauses if c.risk_level == RiskLevel.HIGH),
        medium=sum(1 for c in clauses if c.risk_level == RiskLevel.MEDIUM),
        low=sum(1 for c in clauses if c.risk_level == RiskLevel.LOW),
    )
    top_risks = [
        f"{c.title}: {c.risk_explanation}"
        for c in clauses
        if c.risk_level == RiskLevel.HIGH
    ]
    return AnalysisSummary(
        total_clauses=len(clauses),
        risk_breakdown=breakdown,
        top_risks=top_risks,
    )


async def analyze_contract(text: str, think_hard: bool = False) -> AnalyzeResponse:
    """Full pipeline: extract clauses, analyze them, build summary."""
    extracted = await extract_clauses(text)

    if think_hard:
        analyzed = await _analyze_fan_out(extracted)
    else:
        analyzed = await _analyze_batch(extracted)

    summary = build_summary(analyzed)
    return AnalyzeResponse(summary=summary, clauses=analyzed)
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_analyzer.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/prompts/ backend/app/services/analyzer.py backend/tests/test_analyzer.py backend/tests/conftest.py
git commit -m "feat: add LLM prompts and analyzer service with two-pass and fan-out modes"
```

---

## Task 6: Analyze Endpoint

**Files:**
- Create: `backend/app/routers/analyze.py`
- Create: `backend/tests/test_analyze_endpoint.py`
- Modify: `backend/app/main.py` (add router)

- [ ] **Step 1: Write failing analyze endpoint tests**

`backend/tests/test_analyze_endpoint.py`:

```python
"""Tests for the analyze endpoint."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import MOCK_ANALYSIS_RESPONSE, MOCK_EXTRACTION_RESPONSE

client = TestClient(app)


def _make_tool_response(tool_name: str, tool_input: dict) -> SimpleNamespace:
    """Build a mock Anthropic response with a tool_use content block."""
    return SimpleNamespace(
        content=[
            SimpleNamespace(type="tool_use", name=tool_name, input=tool_input)
        ]
    )


@patch("app.services.analyzer.client")
def test_analyze_returns_report(mock_client):
    """POST /api/analyze returns a structured analysis report."""
    mock_client.messages.create = AsyncMock(
        side_effect=[
            _make_tool_response("extract_clauses", MOCK_EXTRACTION_RESPONSE),
            _make_tool_response("analyze_clauses", MOCK_ANALYSIS_RESPONSE),
        ]
    )
    response = client.post(
        "/api/analyze",
        json={"text": "Full contract text here...", "think_hard": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "clauses" in data
    assert data["summary"]["total_clauses"] == 2
    assert len(data["clauses"]) == 2


@patch("app.services.analyzer.client")
def test_analyze_think_hard(mock_client):
    """POST /api/analyze with think_hard=true uses fan-out mode."""
    mock_client.messages.create = AsyncMock(
        side_effect=[
            _make_tool_response("extract_clauses", MOCK_EXTRACTION_RESPONSE),
            _make_tool_response("analyze_clause", MOCK_ANALYSIS_RESPONSE["clauses"][0]),
            _make_tool_response("analyze_clause", MOCK_ANALYSIS_RESPONSE["clauses"][1]),
        ]
    )
    response = client.post(
        "/api/analyze",
        json={"text": "Full contract text here...", "think_hard": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["total_clauses"] == 2


def test_analyze_empty_text():
    """POST /api/analyze with empty text returns 422."""
    response = client.post(
        "/api/analyze",
        json={"text": "", "think_hard": False},
    )
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_analyze_endpoint.py -v
```

Expected: Failures — analyze router not implemented.

- [ ] **Step 3: Implement analyze router**

`backend/app/routers/analyze.py`:

```python
"""Analyze endpoint — runs LLM pipeline on extracted contract text."""

from fastapi import APIRouter, HTTPException

from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.analyzer import analyze_contract

router = APIRouter()


@router.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """Run clause extraction and risk analysis on contract text."""
    if not request.text.strip():
        raise HTTPException(status_code=422, detail="Contract text is empty.")

    return await analyze_contract(request.text, think_hard=request.think_hard)
```

- [ ] **Step 4: Mount router in main.py**

Add to `backend/app/main.py`:

```python
from app.routers import analyze

app.include_router(analyze.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_analyze_endpoint.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/analyze.py backend/tests/test_analyze_endpoint.py backend/app/main.py
git commit -m "feat: add analyze endpoint wiring LLM pipeline to API"
```

---

## Task 7: PDF Exporter and Export Endpoint

**Files:**
- Create: `backend/app/services/exporter.py`
- Create: `backend/app/routers/export.py`
- Create: `backend/tests/test_exporter.py`
- Create: `backend/tests/test_export_endpoint.py`
- Modify: `backend/app/main.py` (add router)

- [ ] **Step 1: Write failing exporter tests**

`backend/tests/test_exporter.py`:

```python
"""Tests for the PDF/HTML report exporter."""

from app.schemas import (
    AnalyzedClause,
    AnalyzeResponse,
    AnalysisSummary,
    ClauseCategory,
    RiskBreakdown,
    RiskLevel,
)
from app.services.exporter import generate_pdf, render_report_html


def _make_sample_response() -> AnalyzeResponse:
    """Build a sample AnalyzeResponse for testing."""
    return AnalyzeResponse(
        summary=AnalysisSummary(
            total_clauses=2,
            risk_breakdown=RiskBreakdown(high=1, medium=0, low=1),
            top_risks=["Non-Compete Restriction: 2-year scope is broad."],
        ),
        clauses=[
            AnalyzedClause(
                clause_text="The Consultant agrees not to compete...",
                category=ClauseCategory.NON_COMPETE,
                title="Non-Compete Restriction",
                plain_english="You cannot work for competitors for 2 years.",
                risk_level=RiskLevel.HIGH,
                risk_explanation="2-year duration is unusually broad.",
                negotiation_suggestion="Request reduction to 6 months.",
            ),
            AnalyzedClause(
                clause_text="Governed by Delaware law.",
                category=ClauseCategory.GOVERNING_LAW,
                title="Governing Law",
                plain_english="Delaware law applies.",
                risk_level=RiskLevel.LOW,
                risk_explanation="Standard clause.",
                negotiation_suggestion=None,
            ),
        ],
    )


def test_render_report_html_contains_key_elements():
    """Rendered HTML includes disclaimer, summary, and clause content."""
    data = _make_sample_response()
    html = render_report_html(data)
    assert "not legal advice" in html.lower()
    assert "Non-Compete Restriction" in html
    assert "Governing Law" in html
    assert "HIGH" in html.upper()
    assert "LOW" in html.upper()
    assert "Request reduction to 6 months" in html


def test_render_report_html_omits_suggestion_for_low_risk():
    """Low-risk clauses do not show a negotiation suggestion block."""
    data = _make_sample_response()
    html = render_report_html(data)
    # The low-risk clause should NOT have a suggestion section
    # Split by clause cards and check the governing law one
    assert "Governing Law" in html


def test_generate_pdf_returns_bytes():
    """generate_pdf returns valid PDF bytes."""
    data = _make_sample_response()
    pdf_bytes = generate_pdf(data)
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes[:5] == b"%PDF-"
    assert len(pdf_bytes) > 100
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_exporter.py -v
```

Expected: ImportError — `app.services.exporter` does not exist yet.

- [ ] **Step 3: Implement exporter service**

`backend/app/services/exporter.py`:

```python
"""PDF report generation via HTML template + WeasyPrint."""

import html as html_module

from weasyprint import HTML

from app.schemas import AnalyzeResponse, RiskLevel

_RISK_COLORS = {
    RiskLevel.HIGH: {"bg": "#fef2f2", "border": "#fecaca", "text": "#dc2626"},
    RiskLevel.MEDIUM: {"bg": "#fefce8", "border": "#fef08a", "text": "#ca8a04"},
    RiskLevel.LOW: {"bg": "#f0fdf4", "border": "#bbf7d0", "text": "#16a34a"},
}

_RISK_BORDER = {
    RiskLevel.HIGH: "#ef4444",
    RiskLevel.MEDIUM: "#eab308",
    RiskLevel.LOW: "#22c55e",
}


def render_report_html(data: AnalyzeResponse) -> str:
    """Render the analysis data as an HTML report for PDF conversion."""
    clauses_html = ""
    for clause in data.clauses:
        colors = _RISK_COLORS[clause.risk_level]
        border_color = _RISK_BORDER[clause.risk_level]
        category_label = clause.category.value.upper().replace("_", " ")

        suggestion_html = ""
        if clause.negotiation_suggestion:
            suggestion_html = (
                f'<p style="margin-top:8px;color:#2563eb;">'
                f"<strong>Suggestion:</strong> "
                f"{html_module.escape(clause.negotiation_suggestion)}</p>"
            )

        clauses_html += f"""
        <div style="border:1px solid #e5e5e5;border-left:4px solid {border_color};
                    border-radius:8px;padding:16px;margin-bottom:12px;">
            <div style="margin-bottom:8px;">
                <span style="display:inline-block;padding:2px 8px;border-radius:4px;
                            font-size:11px;font-weight:600;background:{colors['bg']};
                            color:{colors['text']};">
                    {clause.risk_level.value.upper()} RISK
                </span>
                <span style="display:inline-block;padding:2px 8px;border-radius:4px;
                            font-size:11px;background:#f3f4f6;color:#6b7280;margin-left:6px;">
                    {category_label}
                </span>
            </div>
            <h3 style="margin:0 0 6px 0;font-size:15px;">
                {html_module.escape(clause.title)}
            </h3>
            <p style="color:#4b5563;font-size:13px;line-height:1.5;margin:0 0 8px 0;">
                {html_module.escape(clause.plain_english)}
            </p>
            <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:0;">
                <strong style="color:{colors['text']};">Risk:</strong>
                {html_module.escape(clause.risk_explanation)}
            </p>
            {suggestion_html}
        </div>
        """

    top_risks_html = "".join(
        f"<li>{html_module.escape(risk)}</li>" for risk in data.summary.top_risks
    )

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    body {{
        font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
        margin: 40px;
        color: #1a1a1a;
        font-size: 14px;
        line-height: 1.6;
    }}
    h1 {{
        font-size: 22px;
        margin: 0 0 4px 0;
    }}
    .disclaimer {{
        background: #f9fafb;
        padding: 10px 14px;
        border-left: 3px solid #9ca3af;
        margin-bottom: 24px;
        font-size: 12px;
        color: #6b7280;
    }}
    .summary {{
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
    }}
    .summary-card {{
        flex: 1;
        text-align: center;
        padding: 12px;
        border-radius: 8px;
    }}
    .summary-card .count {{
        font-size: 28px;
        font-weight: 700;
    }}
    .summary-card .label {{
        font-size: 12px;
        margin-top: 2px;
    }}
    .top-risks {{
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 24px;
    }}
    .top-risks h4 {{
        margin: 0 0 6px 0;
        font-size: 12px;
        text-transform: uppercase;
        color: #dc2626;
    }}
    .top-risks ul {{
        margin: 0;
        padding-left: 20px;
        font-size: 13px;
        color: #4b5563;
    }}
</style>
</head>
<body>
    <h1>Redline — Contract Analysis Report</h1>
    <div class="disclaimer">
        This tool provides analysis only — not legal advice.
        Consult a qualified lawyer before making legal decisions.
    </div>

    <div class="summary">
        <div class="summary-card" style="background:#fef2f2;border:1px solid #fecaca;">
            <div class="count" style="color:#dc2626;">{data.summary.risk_breakdown.high}</div>
            <div class="label" style="color:#ef4444;">High Risk</div>
        </div>
        <div class="summary-card" style="background:#fefce8;border:1px solid #fef08a;">
            <div class="count" style="color:#ca8a04;">{data.summary.risk_breakdown.medium}</div>
            <div class="label" style="color:#eab308;">Medium Risk</div>
        </div>
        <div class="summary-card" style="background:#f0fdf4;border:1px solid #bbf7d0;">
            <div class="count" style="color:#16a34a;">{data.summary.risk_breakdown.low}</div>
            <div class="label" style="color:#22c55e;">Low Risk</div>
        </div>
    </div>

    <div class="top-risks">
        <h4>Top Risks</h4>
        <ul>{top_risks_html}</ul>
    </div>

    {clauses_html}
</body>
</html>"""


def generate_pdf(data: AnalyzeResponse) -> bytes:
    """Generate a styled PDF report from the analysis response."""
    html_content = render_report_html(data)
    return HTML(string=html_content).write_pdf()
```

- [ ] **Step 4: Run exporter tests**

```bash
cd backend
pytest tests/test_exporter.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Write failing export endpoint tests**

`backend/tests/test_export_endpoint.py`:

```python
"""Tests for the export endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _sample_request_body() -> dict:
    """Build a valid request body matching AnalyzeResponse shape."""
    return {
        "summary": {
            "total_clauses": 1,
            "risk_breakdown": {"high": 1, "medium": 0, "low": 0},
            "top_risks": ["Non-compete is broad"],
        },
        "clauses": [
            {
                "clause_text": "You shall not compete.",
                "category": "non_compete",
                "title": "Non-Compete",
                "plain_english": "You cannot work for competitors.",
                "risk_level": "high",
                "risk_explanation": "Too broad.",
                "negotiation_suggestion": "Narrow the scope.",
            }
        ],
    }


def test_export_pdf_returns_pdf():
    """POST /api/export/pdf returns a PDF binary response."""
    response = client.post("/api/export/pdf", json=_sample_request_body())
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content[:5] == b"%PDF-"


def test_export_pdf_invalid_body():
    """POST /api/export/pdf with invalid body returns 422."""
    response = client.post("/api/export/pdf", json={"bad": "data"})
    assert response.status_code == 422
```

- [ ] **Step 6: Implement export router**

`backend/app/routers/export.py`:

```python
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
```

- [ ] **Step 7: Mount router in main.py**

Add to `backend/app/main.py`:

```python
from app.routers import export

app.include_router(export.router)
```

- [ ] **Step 8: Run all export tests**

```bash
cd backend
pytest tests/test_export_endpoint.py tests/test_exporter.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 9: Run full backend test suite**

```bash
cd backend
pytest -v
```

Expected: All tests PASS (schemas + parser + upload + analyzer + analyze endpoint + exporter + export endpoint).

- [ ] **Step 10: Commit**

```bash
git add backend/app/services/exporter.py backend/app/routers/export.py backend/tests/test_exporter.py backend/tests/test_export_endpoint.py backend/app/main.py
git commit -m "feat: add PDF report exporter and export endpoint"
```

---

## Task 8: Frontend Scaffolding

**Files:**
- Create: `frontend/` (via create-next-app)
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /path/to/redline
pnpm create next-app frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

Accept defaults. This creates the full Next.js + Tailwind project structure.

- [ ] **Step 2: Create TypeScript types matching backend schemas**

`frontend/src/types/index.ts`:

```typescript
/** Supported document file types. */
export type FileType = "pdf" | "docx";

/** Response from POST /api/upload. */
export interface UploadResponse {
  filename: string;
  file_type: FileType;
  page_count: number;
  extracted_text: string;
  char_count: number;
}

/** Request body for POST /api/analyze. */
export interface AnalyzeRequest {
  text: string;
  think_hard: boolean;
}

/** Risk assessment level for a clause. */
export type RiskLevel = "low" | "medium" | "high";

/** Classification category for a contract clause. */
export type ClauseCategory =
  | "non_compete"
  | "liability"
  | "termination"
  | "ip_assignment"
  | "confidentiality"
  | "governing_law"
  | "indemnification"
  | "data_protection"
  | "payment_terms"
  | "limitation_of_liability"
  | "force_majeure"
  | "dispute_resolution"
  | "other";

/** A fully analyzed clause with risk assessment. */
export interface AnalyzedClause {
  clause_text: string;
  category: ClauseCategory;
  title: string;
  plain_english: string;
  risk_level: RiskLevel;
  risk_explanation: string;
  negotiation_suggestion: string | null;
}

/** Count of clauses by risk level. */
export interface RiskBreakdown {
  high: number;
  medium: number;
  low: number;
}

/** Summary statistics for the full contract analysis. */
export interface AnalysisSummary {
  total_clauses: number;
  risk_breakdown: RiskBreakdown;
  top_risks: string[];
}

/** Full response from POST /api/analyze. */
export interface AnalyzeResponse {
  summary: AnalysisSummary;
  clauses: AnalyzedClause[];
}
```

- [ ] **Step 3: Create API client**

`frontend/src/lib/api.ts`:

```typescript
/** Backend API client for Redline. */

import type { AnalyzeResponse, UploadResponse } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Upload a contract file and extract text. */
export async function uploadContract(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail ?? "Upload failed");
  }

  return res.json();
}

/** Run clause extraction and risk analysis on contract text. */
export async function analyzeContract(
  text: string,
  thinkHard: boolean
): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, think_hard: thinkHard }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Analysis failed" }));
    throw new Error(error.detail ?? "Analysis failed");
  }

  return res.json();
}

/** Generate and download a PDF report from analysis data. */
export async function exportPdf(data: AnalyzeResponse): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error("PDF export failed");
  }

  return res.blob();
}
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd frontend
pnpm dev
```

Expected: Next.js dev server starts on `http://localhost:3000`. Kill after verifying.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffolding with Next.js, types, and API client"
```

---

## Task 9: Upload Screen

**Files:**
- Create: `frontend/src/components/Disclaimer.tsx`
- Create: `frontend/src/components/FileUpload.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Create Disclaimer component**

`frontend/src/components/Disclaimer.tsx`:

```tsx
/** Legal disclaimer banner — displayed on every screen. */

export function Disclaimer() {
  return (
    <div className="mt-8 mx-auto max-w-2xl border-l-[3px] border-gray-400 bg-gray-50 px-4 py-3 text-sm text-gray-500">
      This tool provides analysis only — not legal advice. Consult a qualified
      lawyer before making legal decisions.
    </div>
  );
}
```

- [ ] **Step 2: Create FileUpload component**

`frontend/src/components/FileUpload.tsx`:

```tsx
/** Drag-and-drop file upload zone for contract documents. */

"use client";

import { useCallback, useRef, useState } from "react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  isUploading: boolean;
  error: string | null;
}

export function FileUpload({
  onFileSelected,
  isUploading,
  error,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return;
      }
      if (file.size > MAX_SIZE) {
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  return (
    <div className="flex flex-col items-center">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`w-full max-w-lg rounded-xl border-2 border-dashed px-10 py-16 text-center transition-colors ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        <div className="mb-3 text-4xl">📄</div>
        <p className="mb-1 text-lg font-semibold text-gray-800">
          Drop your contract here
        </p>
        <p className="mb-4 text-sm text-gray-500">PDF or DOCX — up to 10 MB</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Browse files"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleChange}
          className="hidden"
        />
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update layout.tsx**

Replace the contents of `frontend/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Redline — AI Contract Analyzer",
  description: "Upload a contract. Understand what you're signing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Wire upload state into page.tsx**

Replace the contents of `frontend/src/app/page.tsx`:

```tsx
/** Main page — state machine managing upload/preview/analyzing/report views. */

"use client";

import { useCallback, useState } from "react";

import { Disclaimer } from "@/components/Disclaimer";
import { FileUpload } from "@/components/FileUpload";
import { uploadContract } from "@/lib/api";
import type { AnalyzeResponse, UploadResponse } from "@/types";

type AppState =
  | { view: "upload" }
  | { view: "preview"; upload: UploadResponse }
  | { view: "analyzing"; upload: UploadResponse }
  | { view: "report"; upload: UploadResponse; analysis: AnalyzeResponse };

export default function Home() {
  const [state, setState] = useState<AppState>({ view: "upload" });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadContract(file);
      setState({ view: "preview", upload: result });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setState({ view: "upload" });
    setError(null);
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Redline</h1>
        <p className="mt-1 text-gray-500">
          Upload a contract. Understand what you&apos;re signing.
        </p>
      </header>

      {state.view === "upload" && (
        <FileUpload
          onFileSelected={handleFileSelected}
          isUploading={isUploading}
          error={error}
        />
      )}

      {/* Preview, analyzing, and report views added in subsequent tasks */}
      {state.view === "preview" && (
        <div className="text-center text-gray-500">
          Preview screen — coming next.
          <button onClick={handleReset} className="ml-4 text-blue-600 underline">
            Back
          </button>
        </div>
      )}

      <Disclaimer />
    </main>
  );
}
```

- [ ] **Step 5: Verify in browser**

```bash
cd frontend
pnpm dev
```

Open `http://localhost:3000`. Verify: header, drag-and-drop zone, "Browse files" button, and disclaimer are visible. Kill after verifying.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Disclaimer.tsx frontend/src/components/FileUpload.tsx frontend/src/app/page.tsx frontend/src/app/layout.tsx
git commit -m "feat: add upload screen with drag-and-drop file upload"
```

---

## Task 10: Preview and Analyzing Screens

**Files:**
- Create: `frontend/src/components/TextPreview.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Create TextPreview component**

`frontend/src/components/TextPreview.tsx`:

```tsx
/** Extracted text preview with Analyze button and Think Hard toggle. */

"use client";

import { useState } from "react";
import type { UploadResponse } from "@/types";

interface TextPreviewProps {
  data: UploadResponse;
  onAnalyze: (thinkHard: boolean) => void;
  onReset: () => void;
  isAnalyzing: boolean;
}

export function TextPreview({
  data,
  onAnalyze,
  onReset,
  isAnalyzing,
}: TextPreviewProps) {
  const [thinkHard, setThinkHard] = useState(false);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">{data.filename}</p>
          <p className="text-sm text-gray-500">
            {data.page_count} {data.page_count === 1 ? "page" : "pages"} ·{" "}
            {data.char_count.toLocaleString()} characters
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
        >
          ← Upload different file
        </button>
      </div>

      <div className="mb-6 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 font-mono text-sm leading-relaxed text-gray-600">
        {data.extracted_text}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onAnalyze(thinkHard)}
          disabled={isAnalyzing}
          className="rounded-md bg-blue-600 px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Contract"}
        </button>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500">
          <button
            type="button"
            role="switch"
            aria-checked={thinkHard}
            onClick={() => setThinkHard(!thinkHard)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              thinkHard ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                thinkHard ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
          Think Hard
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire preview and analyzing states into page.tsx**

Update `frontend/src/app/page.tsx` — add the TextPreview import and replace the placeholder preview block with full preview/analyzing logic:

Add import at the top:

```tsx
import { TextPreview } from "@/components/TextPreview";
import { analyzeContract } from "@/lib/api";
```

Add the analyze handler after `handleReset`:

```tsx
  const handleAnalyze = useCallback(
    async (thinkHard: boolean) => {
      if (state.view !== "preview") return;
      setState({ view: "analyzing", upload: state.upload });
      try {
        const analysis = await analyzeContract(state.upload.extracted_text, thinkHard);
        setState({ view: "report", upload: state.upload, analysis });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
        setState({ view: "preview", upload: state.upload });
      }
    },
    [state]
  );
```

Replace the preview placeholder and add analyzing state in the JSX:

```tsx
      {state.view === "preview" && (
        <TextPreview
          data={state.upload}
          onAnalyze={handleAnalyze}
          onReset={handleReset}
          isAnalyzing={false}
        />
      )}

      {state.view === "analyzing" && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          <p className="text-gray-500">Analyzing clauses...</p>
        </div>
      )}

      {state.view === "report" && (
        <div className="text-center text-gray-500">
          Report screen — coming next.
          <button onClick={handleReset} className="ml-4 text-blue-600 underline">
            New contract
          </button>
        </div>
      )}
```

- [ ] **Step 3: Verify in browser**

Start both backend and frontend:

```bash
# Terminal 1:
cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8000

# Terminal 2:
cd frontend && pnpm dev
```

Open `http://localhost:3000`. Upload a sample PDF/DOCX. Verify: file metadata displayed, extracted text visible in scrollable area, "Analyze Contract" button + "Think Hard" toggle present, "Upload different file" button works.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TextPreview.tsx frontend/src/app/page.tsx
git commit -m "feat: add preview screen with text display and analyze controls"
```

---

## Task 11: Report Screen

**Files:**
- Create: `frontend/src/components/RiskBadge.tsx`
- Create: `frontend/src/components/ClauseCard.tsx`
- Create: `frontend/src/components/ReportView.tsx`
- Create: `frontend/src/lib/export.ts`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Create RiskBadge component**

`frontend/src/components/RiskBadge.tsx`:

```tsx
/** Color-coded risk level badge. */

import type { RiskLevel } from "@/types";

const STYLES: Record<RiskLevel, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

interface RiskBadgeProps {
  level: RiskLevel;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase ${STYLES[level]}`}
    >
      {level} risk
    </span>
  );
}
```

- [ ] **Step 2: Create ClauseCard component**

`frontend/src/components/ClauseCard.tsx`:

```tsx
/** Individual clause card with expandable risk details. */

"use client";

import { useState } from "react";
import type { AnalyzedClause } from "@/types";
import { RiskBadge } from "@/components/RiskBadge";

const BORDER_COLORS = {
  high: "border-l-red-500",
  medium: "border-l-yellow-500",
  low: "border-l-green-500",
} as const;

interface ClauseCardProps {
  clause: AnalyzedClause;
}

export function ClauseCard({ clause }: ClauseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const categoryLabel = clause.category.replace(/_/g, " ").toUpperCase();
  const hasDetails =
    clause.risk_level !== "low" || clause.risk_explanation.length > 0;

  return (
    <div
      className={`rounded-lg border border-gray-200 border-l-4 bg-white p-4 ${BORDER_COLORS[clause.risk_level]}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <RiskBadge level={clause.risk_level} />
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {categoryLabel}
        </span>
      </div>

      <h3 className="mb-1 text-sm font-semibold text-gray-800">
        {clause.title}
      </h3>
      <p className="text-sm leading-relaxed text-gray-600">
        {clause.plain_english}
      </p>

      {hasDetails && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      )}

      {expanded && (
        <div className="mt-3 rounded-md bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
          <p>
            <strong className="text-red-600">Risk:</strong>{" "}
            {clause.risk_explanation}
          </p>
          {clause.negotiation_suggestion && (
            <p className="mt-2">
              <strong className="text-blue-600">Suggestion:</strong>{" "}
              {clause.negotiation_suggestion}
            </p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
              Original clause text
            </summary>
            <p className="mt-1 whitespace-pre-wrap font-mono text-gray-500">
              {clause.clause_text}
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create export utility**

`frontend/src/lib/export.ts`:

```typescript
/** Client-side Markdown export and PDF download trigger. */

import type { AnalyzeResponse } from "@/types";
import { exportPdf } from "@/lib/api";

/** Generate a Markdown report string from analysis data. */
export function generateMarkdown(data: AnalyzeResponse): string {
  const lines: string[] = [
    "# Redline — Contract Analysis Report",
    "",
    "> **Disclaimer:** This tool provides analysis only — not legal advice.",
    "",
    "## Summary",
    "",
    `- **Total Clauses:** ${data.summary.total_clauses}`,
    `- **High Risk:** ${data.summary.risk_breakdown.high}`,
    `- **Medium Risk:** ${data.summary.risk_breakdown.medium}`,
    `- **Low Risk:** ${data.summary.risk_breakdown.low}`,
    "",
  ];

  if (data.summary.top_risks.length > 0) {
    lines.push("### Top Risks", "");
    for (const risk of data.summary.top_risks) {
      lines.push(`- ${risk}`);
    }
    lines.push("");
  }

  lines.push("## Clauses", "");

  for (const clause of data.clauses) {
    const level = clause.risk_level.toUpperCase();
    const category = clause.category.replace(/_/g, " ").toUpperCase();
    lines.push(`### ${clause.title}`);
    lines.push(`**${level} RISK** · ${category}`, "");
    lines.push(clause.plain_english, "");
    lines.push(`**Risk:** ${clause.risk_explanation}`, "");
    if (clause.negotiation_suggestion) {
      lines.push(`**Suggestion:** ${clause.negotiation_suggestion}`, "");
    }
    lines.push("<details><summary>Original clause text</summary>", "");
    lines.push(clause.clause_text, "");
    lines.push("</details>", "", "---", "");
  }

  return lines.join("\n");
}

/** Download a string as a file. */
function downloadString(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download a Blob as a file. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export analysis as Markdown and trigger download. */
export function downloadMarkdown(data: AnalyzeResponse) {
  const md = generateMarkdown(data);
  downloadString(md, "redline-report.md", "text/markdown");
}

/** Export analysis as PDF via backend and trigger download. */
export async function downloadPdf(data: AnalyzeResponse) {
  const blob = await exportPdf(data);
  downloadBlob(blob, "redline-report.pdf");
}
```

- [ ] **Step 4: Create ReportView component**

`frontend/src/components/ReportView.tsx`:

```tsx
/** Full report view — summary bar, top risks, clause cards, export buttons. */

"use client";

import { useState } from "react";
import type { AnalyzeResponse } from "@/types";
import { ClauseCard } from "@/components/ClauseCard";
import { downloadMarkdown, downloadPdf } from "@/lib/export";

interface ReportViewProps {
  data: AnalyzeResponse;
  onReset: () => void;
}

export function ReportView({ data, onReset }: ReportViewProps) {
  const [exporting, setExporting] = useState(false);
  const { summary, clauses } = data;

  const handlePdfExport = async () => {
    setExporting(true);
    try {
      await downloadPdf(data);
    } catch {
      alert("PDF export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-3xl font-bold text-red-600">
            {summary.risk_breakdown.high}
          </p>
          <p className="text-xs text-red-500">High Risk</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
          <p className="text-3xl font-bold text-yellow-600">
            {summary.risk_breakdown.medium}
          </p>
          <p className="text-xs text-yellow-500">Medium Risk</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-3xl font-bold text-green-600">
            {summary.risk_breakdown.low}
          </p>
          <p className="text-xs text-green-500">Low Risk</p>
        </div>
      </div>

      {/* Top risks callout */}
      {summary.top_risks.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase text-red-600">
            Top Risks
          </p>
          <ul className="text-sm text-gray-700">
            {summary.top_risks.map((risk, i) => (
              <li key={i}>• {risk}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Clause cards */}
      <div className="space-y-3">
        {clauses.map((clause, i) => (
          <ClauseCard key={i} clause={clause} />
        ))}
      </div>

      {/* Export bar */}
      <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadMarkdown(data)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Export Markdown
          </button>
          <button
            type="button"
            onClick={handlePdfExport}
            disabled={exporting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            {exporting ? "Generating..." : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-md px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100"
          >
            ← New Contract
          </button>
        </div>
        <span className="text-xs text-gray-400">Not legal advice</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire report view into page.tsx**

Add import at the top of `frontend/src/app/page.tsx`:

```tsx
import { ReportView } from "@/components/ReportView";
```

Replace the report placeholder in the JSX:

```tsx
      {state.view === "report" && (
        <ReportView data={state.analysis} onReset={handleReset} />
      )}
```

- [ ] **Step 6: Verify in browser**

Start both servers. Upload a contract, click Analyze. Verify: summary bar with risk counts, top risks callout, clause cards with expandable details, export buttons, "New Contract" link, disclaimer.

If the backend requires an `ANTHROPIC_API_KEY` for real analysis, set it:

```bash
ANTHROPIC_API_KEY=sk-... uvicorn app.main:app --port 8000
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/RiskBadge.tsx frontend/src/components/ClauseCard.tsx frontend/src/components/ReportView.tsx frontend/src/lib/export.ts frontend/src/app/page.tsx
git commit -m "feat: add report screen with clause cards, risk summary, and export"
```

---

## Task 12: Final Integration and Cleanup

**Files:**
- Modify: `frontend/src/app/page.tsx` (error display for analyze failures)
- Verify: full end-to-end flow

- [ ] **Step 1: Add error display for analysis failures**

In `frontend/src/app/page.tsx`, make sure the error state is displayed below the preview when analysis fails. The `handleAnalyze` callback already sets `error` on failure and reverts to preview state. Add the error display inside the preview block:

Verify the preview section passes `error` through — the `TextPreview` component already shows the state, and the error from the parent `page.tsx` is shown separately. Add below the `TextPreview` in the JSX:

```tsx
      {state.view === "preview" && (
        <>
          <TextPreview
            data={state.upload}
            onAnalyze={handleAnalyze}
            onReset={handleReset}
            isAnalyzing={false}
          />
          {error && (
            <p className="mt-4 text-center text-sm text-red-600">{error}</p>
          )}
        </>
      )}
```

- [ ] **Step 2: Run full backend test suite**

```bash
cd backend
pytest -v
```

Expected: All tests PASS.

- [ ] **Step 3: Verify full end-to-end flow**

Start both servers:

```bash
# Terminal 1 (with API key):
cd backend && source .venv/bin/activate
ANTHROPIC_API_KEY=sk-... uvicorn app.main:app --port 8000

# Terminal 2:
cd frontend && pnpm dev
```

Test the complete flow:
1. Open `http://localhost:3000`
2. Upload a PDF or DOCX contract
3. Verify extracted text appears in preview
4. Click "Analyze Contract"
5. Verify spinner shows during analysis
6. Verify report displays with risk summary and clause cards
7. Click "Export Markdown" — verify download
8. Click "Export PDF" — verify download
9. Click "New Contract" — verify return to upload screen
10. Verify disclaimer is visible on all screens

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: final integration with error handling for analysis failures"
```

- [ ] **Step 5: Run all tests one final time**

```bash
cd backend && pytest -v
```

Expected: All tests PASS. Frontend verified manually.
