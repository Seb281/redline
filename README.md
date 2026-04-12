# Redline

AI-powered contract clause analyzer. Upload a contract, get risk-assessed clause analysis with plain-English explanations.

**[Live Demo](https://redline.giupana.com)**

## What It Does

Upload a contract (PDF or DOCX) and Redline runs a three-pass LLM pipeline to extract clauses, assess risk, and generate actionable analysis. The result is an interactive report with filtering, sorting, and export to Markdown or PDF.

## How It Works

```
Contract (PDF/DOCX)
       │
  [ Backend API ]  ─── file parsing (pdfplumber / python-docx)
       │
  Extracted text
       │
  [ Frontend LLM Pipeline ]  ─── Vercel AI SDK + OpenAI
       │
  Pass 0: Overview ──── metadata, parties, jurisdiction, clause inventory
  Pass 1: Extraction ── structured clauses anchored to inventory
  Pass 2: Analysis ──── risk level, plain English, negotiation suggestions
       │
  [ Interactive Report ]
       │
  ├── Markdown export (client-side)
  └── PDF export (Backend → WeasyPrint)
```

## Analysis Pipeline

Redline uses a three-pass architecture for deterministic clause extraction:

1. **Overview** extracts contract metadata and builds a clause inventory — an anchor list that makes subsequent extraction consistent and repeatable.
2. **Extraction** pulls verbatim clause text tied to inventory items, rejecting boilerplate (signature blocks, recitals).
3. **Analysis** classifies each clause by category, assesses risk from the weaker party's perspective (tenant, freelancer, employee), generates plain-English explanations, and flags unusual terms.

Risk calibration uses specific thresholds: non-compete clauses exceeding 12 months or nationwide scope are flagged high risk; payment terms beyond 60 days without late fees are medium-to-high; IP assignment covering pre-existing work is high. Each threshold reflects standard contract review practice.

**Think Hard mode** fans out analysis to one LLM call per clause in parallel, trading cost for depth — useful for complex agreements where batch analysis might miss nuance.

Unusual clause detection flags terms that deviate from market norms for the contract type and jurisdiction. Citations link each finding back to the exact quoted text, with orphaned citations (where the quote can't be verified against the clause) silently dropped.

## Tech Stack

- **Frontend:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Vercel AI SDK
- **Backend:** FastAPI · Python 3.11+ · pdfplumber · WeasyPrint

## Getting Started

### Frontend

```bash
cd frontend
pnpm install
cp .env.example .env.local   # add your OPENAI_API_KEY
pnpm dev                     # http://localhost:3000
```

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8001
```

## License

[MIT](LICENSE)
