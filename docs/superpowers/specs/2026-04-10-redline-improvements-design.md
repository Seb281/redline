# Redline Improvements: Contract Summary, UX Redesign & Testing

**Date:** 2026-04-10
**Status:** Approved
**Tracks:** 3 sequential — Feature → UX → Testing

---

## Overview

Three improvement tracks for Redline, executed sequentially:

1. **Contract Summary & Unusual Clauses** — new LLM pass + per-clause unusualness detection
2. **UX Redesign** — professional SaaS aesthetic (Linear/Notion + Stripe data density)
3. **Full Test Suite** — unit, component, and E2E coverage

---

## Track 1: Contract Summary & Unusual Clauses

### LLM Pipeline Changes

**New Pass 0 (Contract Overview):** Runs before clause extraction. Receives full contract text and returns a structured overview of the contract itself.

**Pass 2 Enhancement (Unusual Detection):** The existing analysis prompt (Pass 2) is extended to also assess unusualness. Each clause gets two additional fields — whether the clause is unusual for its category, and an explanation of what's atypical. This is NOT a separate LLM call; it's additional output fields in the same analysis call.

The LLM assesses unusualness based on its training knowledge of standard contract language (no explicit baseline definitions or historical comparison needed).

### Data Model Additions

Both `frontend/src/types/index.ts` and `backend/app/schemas.py` must stay in sync.

```
ContractOverview {
  contract_type: string           // e.g., "Freelance Services Agreement"
  parties: string[]               // e.g., ["Acme Corp", "Jane Doe"]
  effective_date: string | null   // e.g., "2026-01-15"
  duration: string | null         // e.g., "12 months"
  total_value: string | null      // e.g., "$120,000"
  governing_jurisdiction: string | null  // e.g., "State of California"
  key_terms: string[]             // 3-5 bullet points of most important terms
}

AnalyzedClause (add two fields):
  is_unusual: boolean
  unusual_explanation: string | null

AnalyzeResponse (add one field):
  overview: ContractOverview
```

### Both Pipelines Updated

- **Frontend** (`frontend/src/lib/analyzer.ts`): Add a new `generateObject` call before extraction for the overview. Add `is_unusual` and `unusual_explanation` to the analyzed clause Zod schema.
- **Backend** (`backend/app/services/analyzer.py`): Add a new Anthropic API call before extraction. Add new fields to Pydantic models. Add new prompt in `backend/app/prompts/`.

### Report UI Integration

- **Contract overview card** renders at the top of the report, above the risk summary bar. Structured layout showing contract type, parties, dates, value, jurisdiction, and key terms.
- **Unusual clauses callout** renders below the top risks section. Lists all clauses where `is_unusual === true` with their unusual explanations.
- **Clause cards** get a small "Atypical" badge when `is_unusual` is true. The unusual explanation appears in the expanded details section.

---

## Track 2: UX Redesign

### Design Language

Clean professional SaaS (Linear/Notion) with data-dense report views (Stripe). Color is reserved for risk indicators and interactive elements. Neutral grays for all chrome.

### Global Changes

- **Dark mode** via CSS variables + toggle in header. Respects `prefers-color-scheme` as default, manual toggle overrides.
- **Typography:** System font stack (Geist is fine), tighter tracking, stronger weight hierarchy with better sizing/spacing.
- **Color palette:** Consistent neutral grays for chrome. Color only for risk indicators (red/yellow/green) and interactive elements (blue).
- **Transitions:** Subtle fade between view states, smooth card expand/collapse animations.
- **Responsive:** Proper responsive layout replacing the hardcoded `max-w-4xl`.

### Header

Persistent top bar: Redline wordmark (left), dark mode toggle (right). Minimal — no navigation.

### Upload Screen

- Sharper drop zone: refined border radius, subtle shadow, SVG icon replacing emoji
- File type pills (PDF, DOCX) as visual indicators
- Upload progress bar replacing "Uploading..." text

### Preview Screen

- Code-block style text preview with line numbers and syntax-highlighted section headers
- Compact info bar for file metadata (filename, pages, characters, file type icon)
- Tooltip on "Think Hard" toggle explaining what it does

### Analyzing State

- Multi-step progress indicator: "Extracting clauses..." → "Analyzing risk..."
- Skeleton cards as placeholder for results (visual prep for future streaming)

### Report Screen

- **Contract overview card** at top (from Track 1 data)
- **Risk summary bar** refined: larger cards, subtle gradients, mini donut/ring chart for risk distribution
- **Unusual clauses callout** below top risks
- **Clause cards** refined: better typography hierarchy, category as colored pill, "Atypical" badge, smoother expand/collapse animation
- **Sticky export bar** at bottom — always visible when scrolling
- **Filter/sort controls** above clause list: filter by risk level and category, sort by risk (high-first default)

### Component Architecture

Reskin and enhancement of existing components, not a restructure. Same component boundaries, same state machine in `page.tsx`.

---

## Track 3: Testing

### Framework & Tooling

- **Vitest** — unit and component tests
- **React Testing Library** — component rendering and interaction
- **Playwright** — E2E browser tests
- **MSW (Mock Service Worker)** — API mocking for component and E2E tests

### Unit Tests (`__tests__/unit/`)

| Test file | Coverage |
|---|---|
| `analyzer.test.ts` | Mock Vercel AI SDK. Verify batch + fan-out paths produce correct `AnalyzeResponse` shape. Verify contract overview pass. Verify `is_unusual` field handling. |
| `export.test.ts` | Verify Markdown includes overview section and unusual clause indicators. Verify PDF download trigger. |

### Component Tests (`__tests__/components/`)

| Test file | Coverage |
|---|---|
| `FileUpload.test.tsx` | Drag-and-drop, file picker, type validation (reject non-PDF/DOCX), size validation (reject >10MB), uploading state, error display. |
| `TextPreview.test.tsx` | Renders file metadata and text content. Think Hard toggle state. Triggers analyze callback. |
| `ReportView.test.tsx` | Renders overview card, risk summary, unusual clauses callout, clause cards, filter/sort controls, export buttons. |
| `ClauseCard.test.tsx` | Expand/collapse. Risk badge colors. Unusual badge rendering. Negotiation suggestion conditional display. |
| `DarkModeToggle.test.tsx` | Theme switching applies correct CSS variables. |

### API Route Tests (`__tests__/api/`)

| Test file | Coverage |
|---|---|
| `analyze.route.test.ts` | Happy path. Empty text rejection (422). LLM error handling (500). Response shape validation. |

### E2E Tests (`e2e/`)

| Test file | Coverage |
|---|---|
| `upload-to-report.spec.ts` | Full flow: upload fixture PDF → preview → analyze (mocked LLM) → report renders with overview, risk summary, clause cards, unusual indicators. |
| `export.spec.ts` | From rendered report: trigger Markdown download (verify contents), trigger PDF export (verify blob). |
| `error-handling.spec.ts` | Upload invalid file type. Upload oversized file. API failure during analysis (graceful recovery to preview). |
| `dark-mode.spec.ts` | Toggle dark mode. Verify visual state persists across views. |
| `filter-sort.spec.ts` | Filter clauses by risk level and category. Sort by risk. Verify correct cards shown/hidden. |

### Test Fixtures

- Sample `AnalyzeResponse` JSON with full shape: overview, unusual clauses, all risk levels.
- Small fixture PDF and DOCX files for E2E upload tests.

---

## Execution Order

1. **Track 1** — Contract Summary & Unusual Clauses (both pipelines + report UI)
2. **Track 2** — UX Redesign (all screens, dark mode, filter/sort)
3. **Track 3** — Testing (unit → component → E2E, written against final UI)

This ordering ensures tests are written against the finished product with no rework, and the UX redesign already accounts for the summary feature's layout needs.
