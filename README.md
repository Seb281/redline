# Redline

AI-powered contract clause analyzer. Upload a contract, get risk-assessed clause analysis with plain-English explanations.

**[Live Demo](https://redline.giupana.com)**

## What It Does

Upload a contract (PDF or DOCX) and Redline runs a three-pass LLM pipeline to extract clauses, assess risk, and generate actionable analysis. Results stream in real time as an interactive report with filtering, sorting, clause chat, and export to Markdown or PDF.

Authenticated users can save analyses and revisit them from a history page.

## How It Works

```
Contract (PDF/DOCX)
       │
  [ Backend API ]  ─── file parsing (pdfplumber / python-docx)
       │
  Extracted text
       │
  [ Frontend LLM Pipeline ]  ─── Vercel AI SDK + OpenAI (streaming)
       │
  Pass 0: Overview ──── metadata, parties, jurisdiction, clause inventory
       │
  User picks role ──── which party are you? (tenant, employee, etc.)
       │
  Pass 1: Extraction ── structured clauses anchored to inventory
  Pass 2: Analysis ──── risk level, plain English, negotiation suggestions
       │                (jurisdiction-aware — EU member state rules applied)
       │
  [ Interactive Report ]
       │
  ├── Clause chat (RAG-based context selection)
  ├── Save to account (magic-link auth)
  ├── Markdown export (client-side)
  └── PDF export (Backend → WeasyPrint)
```

## Analysis Pipeline

Redline uses a three-pass architecture for deterministic clause extraction:

1. **Overview** extracts contract metadata and builds a clause inventory — an anchor list that makes subsequent extraction consistent and repeatable.
2. **Extraction** pulls verbatim clause text tied to inventory items, rejecting boilerplate (signature blocks, recitals).
3. **Analysis** classifies each clause by category, assesses risk from the weaker party's perspective, generates plain-English explanations, and flags unusual terms. Analysis is jurisdiction-aware — contracts under EU member state law get jurisdiction-specific notes.

Results stream to the client as they're produced. A progress stepper shows which pass is running and how many clauses have been processed.

**Think Hard mode** fans out analysis to one LLM call per clause in parallel, trading cost for depth — useful for complex agreements where batch analysis might miss nuance.

### Clause Chat

After analysis completes, users can ask follow-up questions about the contract. The chat endpoint uses keyword-based RAG to select the most relevant clauses (top 5) rather than sending the full contract, keeping token usage efficient.

### Unusual Clause Detection

Flags terms that deviate from market norms for the contract type and jurisdiction. Citations link each finding back to the exact quoted text, with orphaned citations silently dropped.

## Architecture

Monorepo with two independent apps:

- **`frontend/`** — Next.js 16 (App Router), React 19, Tailwind CSS 4, Vercel AI SDK
- **`backend/`** — FastAPI, Python 3.11+, Neon Postgres, WeasyPrint

### Frontend

All LLM analysis runs in the frontend via Vercel AI SDK + OpenAI. The frontend manages a state machine (`idle → analyzing_overview → awaiting_role → analyzing → complete`) and streams results into the UI as they arrive.

### Backend

The backend handles file parsing, auth, persistence, and PDF export:

- **File upload** — PDF/DOCX parsing (pdfplumber / python-docx), 10MB limit, rejects scanned/image-only PDFs
- **Auth** — passwordless magic-link login via email (Resend), hashed session tokens in cookies
- **Persistence** — save/list/delete analyses (Neon Postgres), owner-only access
- **PDF export** — HTML-to-PDF via WeasyPrint
- **Rate limiting** — per-endpoint throttling (upload 10/hr, auth 5/hr, save 20/hr)

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
cp .env.example .env          # configure DATABASE_URL, RESEND_API_KEY, etc.
uvicorn app.main:app --reload --port 8001
```

The backend works without a database — auth and persistence features are disabled when `DATABASE_URL` is unset.

## License

[MIT](LICENSE)
