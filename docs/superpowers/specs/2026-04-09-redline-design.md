# Redline — AI Contract Clause Analyzer

## Overview

A web app where users upload a contract (PDF or DOCX), and the system extracts, classifies, and analyzes every significant clause. For each clause it provides: a category label, a plain-English explanation, and a risk assessment with specific reasons. The output is a structured report the user can scan in under a minute to understand what they're signing.

**Target users:** Freelancers, founders, and non-lawyers who need to understand a contract quickly without paying a lawyer.

**Opinionated stance:** Risk assessment is always from the perspective of the weaker/non-drafting party (the freelancer, the employee, the smaller company). This is a deliberate product choice, not a limitation.

## Architecture

### Approach: Thin Backend, Smart Frontend

- **Backend (FastAPI):** Document parsing and LLM orchestration only. Pure API, no state, no sessions.
- **Frontend (Next.js + Tailwind):** Handles all UX — upload flow, processing states, report rendering, Markdown export.
- **Monorepo:** Single repo with `/backend` and `/frontend` directories, each running independently.
- **Stateless:** No database. Process and return.

### Tech Stack

- Backend: Python (FastAPI)
- Frontend: Next.js (App Router) + Tailwind CSS
- LLM: Anthropic API (Claude) with structured JSON output
- Document parsing: pdfplumber (PDF), python-docx (DOCX)
- PDF export: WeasyPrint (server-side)
- Package manager: pnpm (frontend)

## Project Structure

```
redline/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, routes
│   │   ├── routers/
│   │   │   ├── upload.py         # POST /api/upload
│   │   │   ├── analyze.py        # POST /api/analyze
│   │   │   └── export.py         # POST /api/export/pdf
│   │   ├── services/
│   │   │   ├── parser.py         # PDF/DOCX text extraction
│   │   │   ├── analyzer.py       # LLM pipeline orchestration
│   │   │   └── exporter.py       # PDF report generation
│   │   ├── prompts/
│   │   │   ├── extract.py        # Clause extraction prompt
│   │   │   └── analyze.py        # Clause analysis prompt
│   │   └── schemas.py            # Pydantic models for all I/O
│   ├── pyproject.toml
│   └── tests/
│       └── fixtures/             # Sample contracts for testing
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── page.tsx          # Upload screen
│   │   │   └── report/
│   │   │       └── page.tsx      # Report view
│   │   ├── components/
│   │   │   ├── FileUpload.tsx
│   │   │   ├── ClauseCard.tsx
│   │   │   ├── RiskBadge.tsx
│   │   │   ├── ReportView.tsx
│   │   │   └── Disclaimer.tsx
│   │   ├── lib/
│   │   │   └── api.ts            # Backend API client
│   │   └── types/
│   │       └── index.ts          # TypeScript types matching backend schemas
│   ├── package.json
│   └── tailwind.config.ts
└── README.md
```

- **`services/`** contains all business logic. Routers are thin wrappers.
- **`prompts/`** isolates LLM prompt templates from orchestration logic.
- **`schemas.py`** is the single source of truth for all request/response shapes.

## Core Flow

1. User uploads a PDF or DOCX contract
2. Backend extracts raw text (preserving clause structure)
3. User previews extracted text to verify quality
4. User clicks "Analyze" (optionally enabling "Think Hard" mode)
5. LLM pipeline processes the text in two passes
6. Frontend displays structured report with clause cards

## API Design

### `POST /api/upload`

Accepts multipart file upload. Extracts text. Returns structured metadata.

**Request:** `multipart/form-data` with `file` field.

**Response:**
```json
{
  "filename": "consulting-agreement.pdf",
  "file_type": "pdf",
  "page_count": 12,
  "extracted_text": "CONSULTING AGREEMENT\n\nThis Agreement is entered into...",
  "char_count": 24500
}
```

**Constraints:**
- Supported types: `.pdf`, `.docx`
- Max file size: 10MB
- Returns 422 for unsupported types

### `POST /api/analyze`

Takes extracted text, runs LLM pipeline, returns clause analysis.

**Request:**
```json
{
  "text": "CONSULTING AGREEMENT\n\nThis Agreement is entered into...",
  "think_hard": false
}
```

**Response:**
```json
{
  "summary": {
    "total_clauses": 14,
    "risk_breakdown": { "high": 3, "medium": 5, "low": 6 },
    "top_risks": [
      "Non-compete is unusually broad",
      "IP assignment covers pre-existing work"
    ]
  },
  "clauses": [
    {
      "clause_text": "The Consultant agrees not to...",
      "category": "non_compete",
      "title": "Non-Compete Restriction",
      "plain_english": "You cannot work for any competitor within Europe for 2 years after leaving.",
      "risk_level": "high",
      "risk_explanation": "2-year duration and Europe-wide geographic scope is unusually broad. Most enforceable non-competes are 6-12 months with a limited geographic area.",
      "negotiation_suggestion": "Request reduction to 6 months and limit geographic scope to the city or country where you worked."
    }
  ]
}
```

**`think_hard` toggle:**
- `false` (default): Two-pass pipeline. Extract all clauses in one call, analyze all in a second call.
- `true`: Extract all clauses in one call, then fan-out with parallel `asyncio.gather()` calls — one per clause. More thorough, more expensive.

### `POST /api/export/pdf`

Takes the full analysis response JSON. Returns a styled PDF binary.

**Request:** Same shape as `/api/analyze` response body.
**Response:** `application/pdf` binary stream.

Generated via WeasyPrint from an HTML template. Includes disclaimer, summary, and all clause cards with color-coded risk levels.

Markdown export is handled client-side in the frontend (string formatting from the same data).

## LLM Pipeline

### Pass 1: Clause Extraction

Single API call. Full contract text in context window.

**Input:** Full contract text.
**Output:**
```json
{
  "clauses": [
    {
      "clause_text": "The Consultant agrees not to...",
      "section_reference": "Section 8.2"
    }
  ]
}
```

**Prompt behavior:**
- Preserve original clause text exactly (no paraphrasing)
- Skip boilerplate (signatures, dates, headers, recitals)
- Focus on substantive clauses with legal implications
- Uses structured JSON output (`response_format`) to guarantee valid JSON

### Pass 2: Clause Analysis

**Default mode:** Single API call with all extracted clauses. Classifies, summarizes, and risk-assesses every clause.

**Think Hard mode:** One API call per clause, run in parallel with `asyncio.gather()`. Same prompt, but Claude focuses on one clause at a time.

**Output per clause:**
```json
{
  "clause_text": "original text",
  "category": "non_compete",
  "title": "Non-Compete Restriction",
  "plain_english": "You cannot work for any competitor within Europe for 2 years after leaving.",
  "risk_level": "high",
  "risk_explanation": "2-year duration and Europe-wide scope is unusually broad...",
  "negotiation_suggestion": "Request reduction to 6 months and limit to your city."
}
```

### Prompt Design Principles

- **Perspective locked:** All risk assessment from the weaker/non-drafting party's perspective. Baked into system prompt.
- **Categories enumerated:** `non_compete`, `liability`, `termination`, `ip_assignment`, `confidentiality`, `governing_law`, `indemnification`, `data_protection`, `payment_terms`, `limitation_of_liability`, `force_majeure`, `dispute_resolution`, `other`.
- **Risk calibration:** Prompt includes brief guidance on what constitutes low/medium/high for each category (e.g., non-compete > 12 months or nationwide = high).
- **Negotiation suggestions:** Only generated for medium and high risk clauses. Low risk clauses get no suggestion.

## Frontend Design

### Visual Tone

Minimal/professional. Clean white background, sharp typography, subtle color accents. Trustworthy SaaS aesthetic.

### Screens

**Screen 1 — Upload:**
- Drag-and-drop zone with file type/size hint
- "Browse files" button fallback
- Disclaimer at the bottom

**Screen 2 — Preview (after upload):**
- Filename + metadata (pages, character count)
- Scrollable text preview of extracted content
- "Analyze Contract" button with "Think Hard" toggle
- "Upload different file" to go back

**Screen 3 — Report:**
- **Summary bar** at top: three cards showing high/medium/low risk counts (red/yellow/green)
- **Top risks callout:** red-tinted box listing the most significant risks
- **Clause cards:** scrollable list, each card showing:
  - Color-coded left border (red = high, yellow = medium, green = low)
  - Risk level badge + category badge
  - Clause title
  - Plain-English summary (always visible)
  - Risk explanation + negotiation suggestion (for medium/high risk, in expandable detail section)
- **Export buttons:** "Export Markdown" + "Export PDF"
- **"New Contract" link** to return to upload
- **Disclaimer** in footer

### Processing State

Between clicking "Analyze" and seeing the report, show a centered spinner/progress indicator with a message like "Analyzing clauses..." — no intermediate states needed since the response comes as one payload.

## Error Handling

| Scenario | Behavior |
|---|---|
| Unsupported file type | 422 response. Frontend validates extension pre-upload, backend also checks. |
| Empty/corrupt file | If extracted text < 50 characters, return error: "File may be scanned or image-based." |
| LLM timeout | 60s for default mode, 30s per clause for fan-out. Return partial results with `incomplete` flag. |
| LLM malformed output | Retry once. If still bad, return error. |
| File too large | 10MB limit at both frontend (pre-upload) and backend (FastAPI config). |
| No clauses found | Show message: "No significant clauses identified. Non-standard document format." |
| Unclassifiable clause | Assign category `other` rather than failing. |

No complex recovery — stateless app. If something fails, user re-uploads.

## Testing Strategy

- **Backend unit tests:** Document parsing (PDF + DOCX) with sample fixture files. Pydantic schema validation. Export generation (Markdown string, PDF binary).
- **Backend integration tests:** LLM pipeline with mocked Anthropic API responses (pre-recorded structured JSON). Verify two-pass and fan-out modes produce valid output shapes.
- **API endpoint tests:** FastAPI TestClient for each route — upload valid/invalid files, analyze valid/malformed input, export valid data.
- **Frontend:** Component rendering with sample data. No E2E in MVP.

Sample fixture contracts (2-3 short synthetic contracts with known clauses) in `backend/tests/fixtures/`.

## Out of Scope (MVP)

- User accounts / authentication
- Saved reports / history
- OCR for scanned PDFs
- Batch upload
- Clause comparison across contracts
- Contract templates
- Real-time collaboration

## Disclaimer

"This is not legal advice" — visible on every screen. Upload page, preview page, report page, and exported PDFs all include this disclaimer.
