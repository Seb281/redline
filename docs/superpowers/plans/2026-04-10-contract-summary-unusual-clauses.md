# Contract Summary & Unusual Clauses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a contract overview (Pass 0) and per-clause unusualness detection to both frontend and backend analysis pipelines, with corresponding UI components.

**Architecture:** A new LLM pass (Pass 0) extracts contract metadata before clause extraction. The existing Pass 2 analysis prompt is extended with two new output fields (`is_unusual`, `unusual_explanation`). New UI components render the overview card and unusual clauses callout in the report view.

**Tech Stack:** Vercel AI SDK + OpenAI (frontend), Anthropic SDK (backend), React, Pydantic, Zod

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/app/schemas.py` | Add `ContractOverview` model, add `is_unusual`/`unusual_explanation` to `AnalyzedClause`, add `overview` to `AnalyzeResponse` |
| Create | `backend/app/prompts/overview.py` | Overview system prompt, user prompt, and tool schema |
| Modify | `backend/app/prompts/analyze.py` | Add `is_unusual`/`unusual_explanation` to analysis tool schemas and system prompt |
| Modify | `backend/app/services/analyzer.py` | Add `extract_overview()`, wire it into `analyze_contract()` |
| Modify | `backend/app/services/exporter.py` | Add overview card and unusual badge to PDF template |
| Modify | `backend/tests/conftest.py` | Update mock responses with new fields |
| Modify | `backend/tests/test_schemas.py` | Add tests for new models |
| Modify | `backend/tests/test_analyzer.py` | Add test for overview extraction, update existing tests |
| Modify | `frontend/src/types/index.ts` | Add `ContractOverview` interface, extend `AnalyzedClause`, extend `AnalyzeResponse` |
| Modify | `frontend/src/lib/analyzer.ts` | Add overview Zod schema and Pass 0, extend analysis schema |
| Create | `frontend/src/components/ContractOverview.tsx` | Overview card component |
| Create | `frontend/src/components/UnusualClausesCallout.tsx` | Unusual clauses summary section |
| Modify | `frontend/src/components/ClauseCard.tsx` | Add "Atypical" badge |
| Modify | `frontend/src/components/ReportView.tsx` | Integrate overview card and unusual callout |
| Modify | `frontend/src/lib/export.ts` | Add overview and unusual indicators to Markdown export |

---

### Task 1: Extend Backend Schemas

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/tests/test_schemas.py`

- [ ] **Step 1: Write failing tests for new schemas**

Add to `backend/tests/test_schemas.py`:

```python
from app.schemas import ContractOverview


def test_contract_overview_valid():
    """ContractOverview accepts fully populated data."""
    overview = ContractOverview(
        contract_type="Freelance Services Agreement",
        parties=["Acme Corp", "Jane Doe"],
        effective_date="2026-01-15",
        duration="12 months",
        total_value="$120,000",
        governing_jurisdiction="State of California",
        key_terms=[
            "Non-compete clause for 2 years",
            "IP assignment of all deliverables",
            "Net-60 payment terms",
        ],
    )
    assert overview.contract_type == "Freelance Services Agreement"
    assert len(overview.parties) == 2
    assert len(overview.key_terms) == 3


def test_contract_overview_nullable_fields():
    """ContractOverview allows null optional fields."""
    overview = ContractOverview(
        contract_type="NDA",
        parties=["Company A", "Company B"],
        effective_date=None,
        duration=None,
        total_value=None,
        governing_jurisdiction=None,
        key_terms=["Mutual confidentiality obligations"],
    )
    assert overview.effective_date is None
    assert overview.total_value is None


def test_analyzed_clause_with_unusual_fields():
    """AnalyzedClause accepts is_unusual and unusual_explanation."""
    clause = AnalyzedClause(
        clause_text="The consultant assigns all IP including pre-existing work.",
        category=ClauseCategory.IP_ASSIGNMENT,
        title="Broad IP Assignment",
        plain_english="You give up all IP, even work you did before this contract.",
        risk_level=RiskLevel.HIGH,
        risk_explanation="Covers pre-existing IP which is unusually aggressive.",
        negotiation_suggestion="Limit to deliverables created during engagement.",
        is_unusual=True,
        unusual_explanation="Most IP clauses only cover work created during the engagement, not pre-existing IP.",
    )
    assert clause.is_unusual is True
    assert clause.unusual_explanation is not None


def test_analyzed_clause_unusual_defaults_to_false():
    """AnalyzedClause defaults is_unusual to False for backward compatibility."""
    clause = AnalyzedClause(
        clause_text="Delaware law applies.",
        category=ClauseCategory.GOVERNING_LAW,
        title="Governing Law",
        plain_english="Delaware law applies.",
        risk_level=RiskLevel.LOW,
        risk_explanation="Standard clause.",
        negotiation_suggestion=None,
    )
    assert clause.is_unusual is False
    assert clause.unusual_explanation is None


def test_analyze_response_with_overview():
    """AnalyzeResponse includes the contract overview."""
    response = AnalyzeResponse(
        overview=ContractOverview(
            contract_type="Services Agreement",
            parties=["Acme Corp", "Jane Doe"],
            effective_date="2026-01-15",
            duration="12 months",
            total_value="$120,000",
            governing_jurisdiction="State of Delaware",
            key_terms=["Non-compete", "IP assignment"],
        ),
        summary=AnalysisSummary(
            total_clauses=1,
            risk_breakdown=RiskBreakdown(high=0, medium=0, low=1),
            top_risks=[],
        ),
        clauses=[
            AnalyzedClause(
                clause_text="Delaware law applies.",
                category=ClauseCategory.GOVERNING_LAW,
                title="Governing Law",
                plain_english="Delaware law applies.",
                risk_level=RiskLevel.LOW,
                risk_explanation="Standard.",
                negotiation_suggestion=None,
            ),
        ],
    )
    assert response.overview.contract_type == "Services Agreement"
    assert len(response.overview.parties) == 2
```

Update the existing import block at the top to include `ContractOverview`:

```python
from app.schemas import (
    AnalyzedClause,
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisSummary,
    ClauseCategory,
    ContractOverview,
    ExtractedClause,
    RiskBreakdown,
    RiskLevel,
    UploadResponse,
)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_schemas.py -v`
Expected: FAIL — `ContractOverview` not importable, `is_unusual` not a valid field

- [ ] **Step 3: Add ContractOverview model and extend AnalyzedClause and AnalyzeResponse**

In `backend/app/schemas.py`, add the `ContractOverview` model after `ExtractedClause`:

```python
class ContractOverview(BaseModel):
    """High-level contract metadata extracted in Pass 0."""

    contract_type: str
    parties: list[str]
    effective_date: str | None = None
    duration: str | None = None
    total_value: str | None = None
    governing_jurisdiction: str | None = None
    key_terms: list[str]
```

Add two fields to `AnalyzedClause`:

```python
    is_unusual: bool = False
    unusual_explanation: str | None = None
```

Add `overview` field to `AnalyzeResponse`:

```python
class AnalyzeResponse(BaseModel):
    """Full response from the analyze endpoint."""

    overview: ContractOverview
    summary: AnalysisSummary
    clauses: list[AnalyzedClause]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_schemas.py -v`
Expected: PASS (new tests pass; existing `test_analyze_response_complete` will FAIL — fix in next step)

- [ ] **Step 5: Fix existing test_analyze_response_complete**

Update the existing `test_analyze_response_complete` in `backend/tests/test_schemas.py` to include `overview`:

```python
def test_analyze_response_complete():
    """AnalyzeResponse accepts a full report structure."""
    response = AnalyzeResponse(
        overview=ContractOverview(
            contract_type="Consulting Agreement",
            parties=["Acme Corp", "Consultant"],
            effective_date=None,
            duration=None,
            total_value=None,
            governing_jurisdiction="Delaware",
            key_terms=["Non-compete", "Governing law"],
        ),
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
    assert response.overview.contract_type == "Consulting Agreement"
```

- [ ] **Step 6: Run all schema tests**

Run: `cd backend && python -m pytest tests/test_schemas.py -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
cd backend
git add app/schemas.py tests/test_schemas.py
git commit -m "feat: add ContractOverview schema and unusual clause fields"
```

---

### Task 2: Add Backend Overview Prompt

**Files:**
- Create: `backend/app/prompts/overview.py`

- [ ] **Step 1: Create overview prompt module**

Create `backend/app/prompts/overview.py`:

```python
"""Contract overview prompt and tool schema for LLM Pass 0."""

OVERVIEW_SYSTEM_PROMPT = """\
You are a legal document analyst. Your task is to extract high-level metadata \
from a contract. Identify the type of contract, the parties involved, key dates, \
financial terms, and the most important terms at a glance.

Rules:
- Extract only what is explicitly stated in the text. Do not infer or guess.
- If a field is not clearly stated, set it to null.
- For key_terms, list 3-5 of the most important substantive terms — the things \
  someone would want to know before reading the full contract.
- Keep key_terms concise: one sentence each, plain English, no legal jargon.
"""

OVERVIEW_USER_PROMPT = """\
Extract the high-level overview from this contract:

{contract_text}"""

OVERVIEW_TOOL = {
    "name": "extract_overview",
    "description": "Return high-level metadata about the contract.",
    "input_schema": {
        "type": "object",
        "properties": {
            "contract_type": {
                "type": "string",
                "description": "Type of contract (e.g., 'Freelance Services Agreement', 'NDA', 'Employment Contract').",
            },
            "parties": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Names of the parties involved.",
            },
            "effective_date": {
                "type": ["string", "null"],
                "description": "Effective or start date if stated.",
            },
            "duration": {
                "type": ["string", "null"],
                "description": "Contract duration if stated (e.g., '12 months').",
            },
            "total_value": {
                "type": ["string", "null"],
                "description": "Total contract value if stated (e.g., '$120,000').",
            },
            "governing_jurisdiction": {
                "type": ["string", "null"],
                "description": "Governing law jurisdiction if stated.",
            },
            "key_terms": {
                "type": "array",
                "items": {"type": "string"},
                "description": "3-5 most important terms, one sentence each, plain English.",
            },
        },
        "required": ["contract_type", "parties", "key_terms"],
    },
}
```

- [ ] **Step 2: Verify file imports cleanly**

Run: `cd backend && python -c "from app.prompts.overview import OVERVIEW_SYSTEM_PROMPT, OVERVIEW_USER_PROMPT, OVERVIEW_TOOL; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd backend
git add app/prompts/overview.py
git commit -m "feat: add contract overview LLM prompt and tool schema"
```

---

### Task 3: Extend Backend Analysis Prompt with Unusual Fields

**Files:**
- Modify: `backend/app/prompts/analyze.py`

- [ ] **Step 1: Add unusual detection to system prompt**

In `backend/app/prompts/analyze.py`, append to `ANALYSIS_SYSTEM_PROMPT` (before the closing `"""`):

```
7. Whether this clause is unusual compared to standard contracts of this type. \
   A clause is unusual if its terms, scope, duration, or obligations deviate \
   significantly from what is typical for its category.
8. If unusual, a brief explanation of what specifically is atypical and why it \
   matters. Set to null if the clause is not unusual.
```

The full updated prompt instruction list becomes items 1-8 (the existing items 1-6 stay, items 7-8 are added).

- [ ] **Step 2: Add unusual fields to the analyzed clause tool schema**

In `backend/app/prompts/analyze.py`, add two properties to `_ANALYZED_CLAUSE_SCHEMA["properties"]`:

```python
        "is_unusual": {
            "type": "boolean",
            "description": "True if this clause deviates from standard contract norms for its category.",
        },
        "unusual_explanation": {
            "type": ["string", "null"],
            "description": "What is atypical and why it matters. Null if not unusual.",
        },
```

Add both field names to the `"required"` list:

```python
    "required": [
        "clause_text",
        "category",
        "title",
        "plain_english",
        "risk_level",
        "risk_explanation",
        "negotiation_suggestion",
        "is_unusual",
        "unusual_explanation",
    ],
```

- [ ] **Step 3: Verify file imports cleanly**

Run: `cd backend && python -c "from app.prompts.analyze import ANALYSIS_BATCH_TOOL, ANALYSIS_SINGLE_TOOL; print(ANALYSIS_BATCH_TOOL['input_schema']['properties']['clauses']['items']['properties'].keys())"`
Expected: Output includes `is_unusual` and `unusual_explanation`

- [ ] **Step 4: Commit**

```bash
cd backend
git add app/prompts/analyze.py
git commit -m "feat: add unusual clause detection to analysis prompt"
```

---

### Task 4: Wire Overview into Backend Analyzer Service

**Files:**
- Modify: `backend/app/services/analyzer.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Update mock fixtures in conftest.py**

In `backend/tests/conftest.py`, add a new mock response and update existing ones.

Add at module level:

```python
MOCK_OVERVIEW_RESPONSE = {
    "contract_type": "Consulting Agreement",
    "parties": ["Acme Corp", "The Consultant"],
    "effective_date": None,
    "duration": None,
    "total_value": None,
    "governing_jurisdiction": "State of Delaware",
    "key_terms": [
        "Non-compete restriction covering Europe for 2 years",
        "Governed by Delaware law",
    ],
}
```

Add `is_unusual` and `unusual_explanation` to `MOCK_ANALYSIS_RESPONSE` clauses:

```python
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
            "is_unusual": True,
            "unusual_explanation": "Most non-competes are limited to 6-12 months and a specific region, not an entire continent.",
        },
        {
            "clause_text": "This Agreement shall be governed by the laws of the State of Delaware.",
            "category": "governing_law",
            "title": "Governing Law",
            "plain_english": "Delaware law applies to this contract.",
            "risk_level": "low",
            "risk_explanation": "Standard governing law clause. Delaware is a common and neutral choice.",
            "negotiation_suggestion": None,
            "is_unusual": False,
            "unusual_explanation": None,
        },
    ]
}
```

Update `MOCK_SINGLE_ANALYSIS_RESPONSE`:

```python
MOCK_SINGLE_ANALYSIS_RESPONSE = {
    "clause_text": "The Consultant agrees not to work for any competitor within Europe for a period of 2 years after termination.",
    "category": "non_compete",
    "title": "Non-Compete Restriction",
    "plain_english": "You cannot work for competitors in Europe for 2 years after leaving.",
    "risk_level": "high",
    "risk_explanation": "2-year duration and Europe-wide scope is unusually broad.",
    "negotiation_suggestion": "Request reduction to 6 months and limit to your city.",
    "is_unusual": True,
    "unusual_explanation": "Most non-competes are limited to 6-12 months and a specific region, not an entire continent.",
}
```

Update the `sample_analyzed_clauses` fixture to include the new fields:

```python
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
```

Add a fixture for the overview response:

```python
@pytest.fixture
def mock_overview_response():
    """Mock Anthropic API response for contract overview."""
    return MOCK_OVERVIEW_RESPONSE
```

- [ ] **Step 2: Write failing test for extract_overview**

Add to `backend/tests/test_analyzer.py`:

```python
from app.schemas import ContractOverview
from tests.conftest import MOCK_OVERVIEW_RESPONSE


@pytest.mark.asyncio
@patch("app.services.analyzer.client")
async def test_extract_overview(mock_client):
    """extract_overview returns parsed ContractOverview from LLM response."""
    mock_client.messages.create = AsyncMock(
        return_value=_make_tool_response("extract_overview", MOCK_OVERVIEW_RESPONSE)
    )
    result = await extract_overview("Some contract text")
    assert isinstance(result, ContractOverview)
    assert result.contract_type == "Consulting Agreement"
    assert len(result.parties) == 2
    assert len(result.key_terms) == 2
```

Update the import to include `extract_overview`:

```python
from app.services.analyzer import (
    analyze_contract,
    build_summary,
    extract_clauses,
    extract_overview,
)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_analyzer.py::test_extract_overview -v`
Expected: FAIL — `extract_overview` not importable

- [ ] **Step 4: Implement extract_overview in analyzer service**

In `backend/app/services/analyzer.py`, add the import:

```python
from app.prompts.overview import (
    OVERVIEW_SYSTEM_PROMPT,
    OVERVIEW_TOOL,
    OVERVIEW_USER_PROMPT,
)
from app.schemas import ContractOverview
```

(Add `ContractOverview` to the existing `app.schemas` import block.)

Add the function after the existing `extract_clauses`:

```python
async def extract_overview(text: str) -> ContractOverview:
    """Pass 0: Extract high-level contract metadata."""
    response = await asyncio.wait_for(
        client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=OVERVIEW_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": OVERVIEW_USER_PROMPT.format(contract_text=text),
                }
            ],
            tools=[OVERVIEW_TOOL],
            tool_choice={"type": "tool", "name": "extract_overview"},
        ),
        timeout=DEFAULT_TIMEOUT,
    )
    tool_block = next(b for b in response.content if b.type == "tool_use")
    return ContractOverview(**tool_block.input)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_analyzer.py::test_extract_overview -v`
Expected: PASS

- [ ] **Step 6: Update existing analyzer tests for the new overview call**

The existing `test_analyze_contract_default_mode` and `test_analyze_contract_think_hard_mode` need an additional mock response for the overview call (which now runs first).

Update `test_analyze_contract_default_mode`:

```python
@pytest.mark.asyncio
@patch("app.services.analyzer.client")
async def test_analyze_contract_default_mode(mock_client):
    """analyze_contract in default mode returns a valid AnalyzeResponse."""
    mock_client.messages.create = AsyncMock(
        side_effect=[
            _make_tool_response("extract_overview", MOCK_OVERVIEW_RESPONSE),
            _make_tool_response("extract_clauses", MOCK_EXTRACTION_RESPONSE),
            _make_tool_response("analyze_clauses", MOCK_ANALYSIS_RESPONSE),
        ]
    )
    result = await analyze_contract("Some contract text", think_hard=False)
    assert isinstance(result, AnalyzeResponse)
    assert result.overview.contract_type == "Consulting Agreement"
    assert result.summary.total_clauses == 2
    assert result.summary.risk_breakdown.high == 1
    assert result.summary.risk_breakdown.low == 1
    assert len(result.clauses) == 2
    assert result.clauses[0].is_unusual is True
    assert result.clauses[1].is_unusual is False
```

Update `test_analyze_contract_think_hard_mode`:

```python
@pytest.mark.asyncio
@patch("app.services.analyzer.client")
async def test_analyze_contract_think_hard_mode(mock_client):
    """analyze_contract in think_hard mode fans out to per-clause calls."""
    mock_client.messages.create = AsyncMock(
        side_effect=[
            _make_tool_response("extract_overview", MOCK_OVERVIEW_RESPONSE),
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
                "is_unusual": False,
                "unusual_explanation": None,
            }),
        ]
    )
    result = await analyze_contract("Some contract text", think_hard=True)
    assert isinstance(result, AnalyzeResponse)
    assert result.overview.contract_type == "Consulting Agreement"
    assert result.summary.total_clauses == 2
    assert mock_client.messages.create.call_count == 4  # 1 overview + 1 extract + 2 analyze
```

- [ ] **Step 7: Wire overview into analyze_contract function**

Update `analyze_contract` in `backend/app/services/analyzer.py`:

```python
async def analyze_contract(text: str, think_hard: bool = False) -> AnalyzeResponse:
    """Full pipeline: overview, extract clauses, analyze them, build summary."""
    overview = await extract_overview(text)
    extracted = await extract_clauses(text)

    if think_hard:
        analyzed = await _analyze_fan_out(extracted)
    else:
        analyzed = await _analyze_batch(extracted)

    summary = build_summary(analyzed)
    return AnalyzeResponse(overview=overview, summary=summary, clauses=analyzed)
```

- [ ] **Step 8: Run all analyzer tests**

Run: `cd backend && python -m pytest tests/test_analyzer.py -v`
Expected: All PASS

- [ ] **Step 9: Run full backend test suite to catch cascading breakage**

Run: `cd backend && python -m pytest -v`
Expected: Some failures in `test_analyze_endpoint.py` and `test_exporter.py` due to `AnalyzeResponse` now requiring `overview`. These will be fixed in subsequent tasks.

- [ ] **Step 10: Commit**

```bash
cd backend
git add app/services/analyzer.py tests/conftest.py tests/test_analyzer.py
git commit -m "feat: wire contract overview extraction into analyzer pipeline"
```

---

### Task 5: Fix Remaining Backend Test Breakage

**Files:**
- Modify: `backend/tests/test_analyze_endpoint.py`
- Modify: `backend/tests/test_exporter.py`

- [ ] **Step 1: Read current test files to understand what needs fixing**

Read `backend/tests/test_analyze_endpoint.py` and `backend/tests/test_exporter.py` to identify all places where `AnalyzeResponse` is constructed without `overview`.

- [ ] **Step 2: Fix test_analyze_endpoint.py**

Any place that constructs `AnalyzeResponse` or mocks the `analyze_contract` return value needs to include the `overview` field. Add the `MOCK_OVERVIEW_RESPONSE` import and include it. The mock for `analyze_contract` should include an `overview` call in its `side_effect` if it patches the client, or include `overview` in the return value if it patches `analyze_contract` directly.

Pattern for constructing overview in tests:

```python
from app.schemas import ContractOverview
from tests.conftest import MOCK_OVERVIEW_RESPONSE

# Wherever AnalyzeResponse is constructed:
overview = ContractOverview(**MOCK_OVERVIEW_RESPONSE)
# Then pass overview=overview to AnalyzeResponse(...)
```

- [ ] **Step 3: Fix test_exporter.py**

Same pattern — any `AnalyzeResponse` construction in exporter tests needs the `overview` field.

- [ ] **Step 4: Run full backend test suite**

Run: `cd backend && python -m pytest -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd backend
git add tests/test_analyze_endpoint.py tests/test_exporter.py
git commit -m "fix: update endpoint and exporter tests for overview field"
```

---

### Task 6: Update Backend PDF Exporter

**Files:**
- Modify: `backend/app/services/exporter.py`

- [ ] **Step 1: Write failing test for overview in PDF**

Add to `backend/tests/test_exporter.py` (or update an existing test):

```python
def test_render_report_html_includes_overview(sample_analyzed_clauses):
    """PDF HTML template includes contract overview section."""
    from app.schemas import ContractOverview

    overview = ContractOverview(
        contract_type="Consulting Agreement",
        parties=["Acme Corp", "The Consultant"],
        effective_date="2026-01-15",
        duration="12 months",
        total_value="$120,000",
        governing_jurisdiction="State of Delaware",
        key_terms=["Non-compete for 2 years", "IP assignment of all work"],
    )
    data = AnalyzeResponse(
        overview=overview,
        summary=build_summary(sample_analyzed_clauses),
        clauses=sample_analyzed_clauses,
    )
    html = render_report_html(data)
    assert "Consulting Agreement" in html
    assert "Acme Corp" in html
    assert "The Consultant" in html
    assert "$120,000" in html
    assert "Non-compete for 2 years" in html


def test_render_report_html_includes_unusual_badge(sample_analyzed_clauses):
    """PDF HTML template shows ATYPICAL badge for unusual clauses."""
    from app.schemas import ContractOverview

    overview = ContractOverview(
        contract_type="Agreement",
        parties=["A", "B"],
        effective_date=None,
        duration=None,
        total_value=None,
        governing_jurisdiction=None,
        key_terms=["Term 1"],
    )
    data = AnalyzeResponse(
        overview=overview,
        summary=build_summary(sample_analyzed_clauses),
        clauses=sample_analyzed_clauses,
    )
    html = render_report_html(data)
    assert "ATYPICAL" in html
```

Make sure to import `render_report_html` and `build_summary`:

```python
from app.services.exporter import render_report_html
from app.services.analyzer import build_summary
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_exporter.py -v -k "overview or unusual"`
Expected: FAIL — overview section not in HTML output

- [ ] **Step 3: Add overview card to PDF template**

In `backend/app/services/exporter.py`, update `render_report_html` to add an overview section after the disclaimer and before the summary. Insert this block in the HTML template string:

```python
    # Build overview HTML
    parties_html = ", ".join(html_module.escape(p) for p in data.overview.parties)
    key_terms_html = "".join(
        f"<li>{html_module.escape(term)}</li>" for term in data.overview.key_terms
    )

    overview_details = []
    if data.overview.effective_date:
        overview_details.append(
            f"<span><strong>Effective:</strong> {html_module.escape(data.overview.effective_date)}</span>"
        )
    if data.overview.duration:
        overview_details.append(
            f"<span><strong>Duration:</strong> {html_module.escape(data.overview.duration)}</span>"
        )
    if data.overview.total_value:
        overview_details.append(
            f"<span><strong>Value:</strong> {html_module.escape(data.overview.total_value)}</span>"
        )
    if data.overview.governing_jurisdiction:
        overview_details.append(
            f"<span><strong>Jurisdiction:</strong> {html_module.escape(data.overview.governing_jurisdiction)}</span>"
        )
    details_html = " · ".join(overview_details) if overview_details else ""
```

Add the overview HTML block to the template between the disclaimer and summary divs:

```html
    <div style="background:#f9fafb;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin-bottom:24px;">
        <h2 style="margin:0 0 8px 0;font-size:16px;">
            {html_module.escape(data.overview.contract_type)}
        </h2>
        <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;">
            <strong>Parties:</strong> {parties_html}
        </p>
        {f'<p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;">{details_html}</p>' if details_html else ''}
        <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#6b7280;">KEY TERMS</p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#4b5563;">{key_terms_html}</ul>
    </div>
```

- [ ] **Step 4: Add unusual badge to clause cards in PDF**

In the clause card rendering loop in `render_report_html`, add an "ATYPICAL" badge after the category badge when `clause.is_unusual` is True:

```python
        unusual_badge_html = ""
        if clause.is_unusual:
            unusual_badge_html = (
                '<span style="display:inline-block;padding:2px 8px;border-radius:4px;'
                'font-size:11px;font-weight:600;background:#ede9fe;'
                'color:#7c3aed;margin-left:6px;">ATYPICAL</span>'
            )
```

Insert `{unusual_badge_html}` after the category span in the clause card template.

Also, if `clause.unusual_explanation` is set, add it to the details:

```python
        unusual_detail_html = ""
        if clause.unusual_explanation:
            unusual_detail_html = (
                f'<p style="margin-top:8px;color:#7c3aed;">'
                f"<strong>Unusual:</strong> "
                f"{html_module.escape(clause.unusual_explanation)}</p>"
            )
```

Insert `{unusual_detail_html}` after the suggestion block in the clause card template.

- [ ] **Step 5: Run exporter tests**

Run: `cd backend && python -m pytest tests/test_exporter.py -v`
Expected: All PASS

- [ ] **Step 6: Run full backend suite**

Run: `cd backend && python -m pytest -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
cd backend
git add app/services/exporter.py tests/test_exporter.py
git commit -m "feat: add overview card and unusual badge to PDF report"
```

---

### Task 7: Extend Frontend Types

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add ContractOverview interface and extend existing types**

In `frontend/src/types/index.ts`, add the `ContractOverview` interface after `AnalyzeRequest`:

```typescript
/** High-level contract metadata extracted in Pass 0. */
export interface ContractOverview {
  contract_type: string;
  parties: string[];
  effective_date: string | null;
  duration: string | null;
  total_value: string | null;
  governing_jurisdiction: string | null;
  key_terms: string[];
}
```

Add two fields to `AnalyzedClause`:

```typescript
  is_unusual: boolean;
  unusual_explanation: string | null;
```

Add `overview` to `AnalyzeResponse`:

```typescript
export interface AnalyzeResponse {
  overview: ContractOverview;
  summary: AnalysisSummary;
  clauses: AnalyzedClause[];
}
```

- [ ] **Step 2: Verify the build still compiles**

Run: `cd frontend && pnpm build`
Expected: Build will fail because `analyzer.ts` doesn't return `overview` yet and components don't match. This is expected — the type changes are correct and will be satisfied by subsequent tasks.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/types/index.ts
git commit -m "feat: add ContractOverview type and unusual clause fields"
```

---

### Task 8: Extend Frontend Analyzer Pipeline

**Files:**
- Modify: `frontend/src/lib/analyzer.ts`

- [ ] **Step 1: Add overview Zod schema**

In `frontend/src/lib/analyzer.ts`, add after the existing `extractionResultSchema`:

```typescript
const contractOverviewSchema = z.object({
  contract_type: z
    .string()
    .describe("Type of contract, e.g. 'Freelance Services Agreement'"),
  parties: z
    .array(z.string())
    .describe("Names of the parties involved"),
  effective_date: z
    .string()
    .nullable()
    .describe("Effective or start date if stated"),
  duration: z
    .string()
    .nullable()
    .describe("Contract duration if stated, e.g. '12 months'"),
  total_value: z
    .string()
    .nullable()
    .describe("Total contract value if stated, e.g. '$120,000'"),
  governing_jurisdiction: z
    .string()
    .nullable()
    .describe("Governing law jurisdiction if stated"),
  key_terms: z
    .array(z.string())
    .describe("3-5 most important terms, one sentence each, plain English"),
});
```

- [ ] **Step 2: Add unusual fields to analyzed clause schema**

Add to `analyzedClauseSchema`:

```typescript
  is_unusual: z
    .boolean()
    .describe("True if this clause deviates from standard contract norms"),
  unusual_explanation: z
    .string()
    .nullable()
    .describe("What is atypical and why it matters. Null if not unusual."),
```

- [ ] **Step 3: Add overview system prompt**

Add after the existing `ANALYSIS_SYSTEM_PROMPT`:

```typescript
const OVERVIEW_SYSTEM_PROMPT = `\
You are a legal document analyst. Your task is to extract high-level metadata \
from a contract. Identify the type of contract, the parties involved, key dates, \
financial terms, and the most important terms at a glance.

Rules:
- Extract only what is explicitly stated in the text. Do not infer or guess.
- If a field is not clearly stated, set it to null.
- For key_terms, list 3-5 of the most important substantive terms — the things \
  someone would want to know before reading the full contract.
- Keep key_terms concise: one sentence each, plain English, no legal jargon.`;
```

- [ ] **Step 4: Update analysis system prompt**

Append to `ANALYSIS_SYSTEM_PROMPT` (before the closing backtick):

```
7. Whether this clause is unusual compared to standard contracts of this type. \
   A clause is unusual if its terms, scope, duration, or obligations deviate \
   significantly from what is typical for its category.
8. If unusual, a brief explanation of what specifically is atypical and why it \
   matters. Set to null if the clause is not unusual.
```

- [ ] **Step 5: Add Pass 0 to analyzeContract function**

In the `analyzeContract` function, add the overview call before Pass 1:

```typescript
  // Pass 0 — extract contract overview
  const { object: overview } = await generateObject({
    model,
    schema: contractOverviewSchema,
    system: OVERVIEW_SYSTEM_PROMPT,
    prompt: `Extract the high-level overview from this contract:\n\n${text}`,
  });
```

Update the return statement to include `overview`:

```typescript
  return { overview, summary, clauses: analyzedClauses };
```

- [ ] **Step 6: Verify the analyzer file compiles**

Run: `cd frontend && pnpm exec tsc --noEmit src/lib/analyzer.ts 2>&1 || echo "Type errors expected — components not updated yet"`
Expected: May have type errors in other files; `analyzer.ts` itself should be clean.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/lib/analyzer.ts
git commit -m "feat: add overview pass and unusual fields to frontend analyzer"
```

---

### Task 9: Create ContractOverview Component

**Files:**
- Create: `frontend/src/components/ContractOverview.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/ContractOverview.tsx`:

```tsx
/** Contract overview card — shows high-level contract metadata. */

import type { ContractOverview as ContractOverviewType } from "@/types";

interface ContractOverviewProps {
  overview: ContractOverviewType;
}

/** Renders structured contract metadata at the top of the report. */
export function ContractOverview({ overview }: ContractOverviewProps) {
  const details: string[] = [];
  if (overview.effective_date) details.push(`Effective: ${overview.effective_date}`);
  if (overview.duration) details.push(`Duration: ${overview.duration}`);
  if (overview.total_value) details.push(`Value: ${overview.total_value}`);
  if (overview.governing_jurisdiction) {
    details.push(`Jurisdiction: ${overview.governing_jurisdiction}`);
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
      <h2 className="mb-1 text-lg font-semibold text-gray-800">
        {overview.contract_type}
      </h2>
      <p className="mb-3 text-sm text-gray-500">
        {overview.parties.join(" · ")}
      </p>

      {details.length > 0 && (
        <p className="mb-3 text-sm text-gray-600">
          {details.join(" · ")}
        </p>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-gray-400">
          Key Terms
        </p>
        <ul className="space-y-1 text-sm text-gray-600">
          {overview.key_terms.map((term, i) => (
            <li key={i}>• {term}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: May still have errors in other files (ReportView not updated), but `ContractOverview.tsx` itself should be clean.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/ContractOverview.tsx
git commit -m "feat: add ContractOverview component"
```

---

### Task 10: Create UnusualClausesCallout Component

**Files:**
- Create: `frontend/src/components/UnusualClausesCallout.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/UnusualClausesCallout.tsx`:

```tsx
/** Callout section listing clauses flagged as unusual/atypical. */

import type { AnalyzedClause } from "@/types";

interface UnusualClausesCalloutProps {
  clauses: AnalyzedClause[];
}

/** Renders a summary of unusual clauses below the top risks section. */
export function UnusualClausesCallout({ clauses }: UnusualClausesCalloutProps) {
  const unusualClauses = clauses.filter((c) => c.is_unusual);

  if (unusualClauses.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
      <p className="mb-1 text-xs font-semibold uppercase text-purple-600">
        Unusual Clauses
      </p>
      <ul className="text-sm text-gray-700">
        {unusualClauses.map((clause, i) => (
          <li key={i}>
            • <span className="font-medium">{clause.title}</span>
            {clause.unusual_explanation && (
              <span className="text-gray-500">
                {" "}— {clause.unusual_explanation}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/UnusualClausesCallout.tsx
git commit -m "feat: add UnusualClausesCallout component"
```

---

### Task 11: Add Atypical Badge to ClauseCard

**Files:**
- Modify: `frontend/src/components/ClauseCard.tsx`

- [ ] **Step 1: Add atypical badge**

In `frontend/src/components/ClauseCard.tsx`, add an "Atypical" badge in the badge row (inside the `div` with `className="mb-2 flex items-start gap-2"`), after the category span:

```tsx
        {clause.is_unusual && (
          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
            ATYPICAL
          </span>
        )}
```

- [ ] **Step 2: Add unusual explanation to expanded details**

In the expanded details section (inside the `{expanded && (` block), add the unusual explanation after the negotiation suggestion:

```tsx
          {clause.unusual_explanation && (
            <p className="mt-2">
              <strong className="text-purple-600">Unusual:</strong>{" "}
              {clause.unusual_explanation}
            </p>
          )}
```

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/ClauseCard.tsx
git commit -m "feat: add atypical badge and unusual explanation to ClauseCard"
```

---

### Task 12: Integrate New Components into ReportView

**Files:**
- Modify: `frontend/src/components/ReportView.tsx`

- [ ] **Step 1: Add imports**

Add to the imports in `frontend/src/components/ReportView.tsx`:

```tsx
import { ContractOverview } from "@/components/ContractOverview";
import { UnusualClausesCallout } from "@/components/UnusualClausesCallout";
```

- [ ] **Step 2: Add overview card above summary bar**

Insert before the summary bar `div` (before `{/* Summary bar */}`):

```tsx
      {/* Contract overview */}
      <ContractOverview overview={data.overview} />
```

- [ ] **Step 3: Add unusual callout after top risks**

Insert after the top risks callout block (after the `{summary.top_risks.length > 0 && (` block's closing `)}`:

```tsx
      {/* Unusual clauses */}
      <UnusualClausesCallout clauses={clauses} />
```

- [ ] **Step 4: Verify the full build compiles**

Run: `cd frontend && pnpm build`
Expected: PASS — all types should align now

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/ReportView.tsx
git commit -m "feat: integrate overview card and unusual callout into report"
```

---

### Task 13: Update Markdown Export

**Files:**
- Modify: `frontend/src/lib/export.ts`

- [ ] **Step 1: Add overview section to Markdown**

In `frontend/src/lib/export.ts`, update `generateMarkdown` to add the overview section. After the disclaimer line and before `## Summary`, insert:

```typescript
  // Overview section
  lines.push("## Contract Overview", "");
  lines.push(`**Type:** ${data.overview.contract_type}`);
  lines.push(`**Parties:** ${data.overview.parties.join(", ")}`);
  if (data.overview.effective_date) {
    lines.push(`**Effective Date:** ${data.overview.effective_date}`);
  }
  if (data.overview.duration) {
    lines.push(`**Duration:** ${data.overview.duration}`);
  }
  if (data.overview.total_value) {
    lines.push(`**Value:** ${data.overview.total_value}`);
  }
  if (data.overview.governing_jurisdiction) {
    lines.push(`**Jurisdiction:** ${data.overview.governing_jurisdiction}`);
  }
  lines.push("");
  lines.push("### Key Terms", "");
  for (const term of data.overview.key_terms) {
    lines.push(`- ${term}`);
  }
  lines.push("");
```

- [ ] **Step 2: Add unusual indicator to clause entries**

In the clause loop, after the `**${level} RISK** · ${category}` line, add:

```typescript
    if (clause.is_unusual) {
      lines.push(`**ATYPICAL** — ${clause.unusual_explanation ?? "This clause is unusual for its category."}`, "");
    }
```

- [ ] **Step 3: Add unusual clauses summary**

After the top risks block and before `## Clauses`, add:

```typescript
  const unusualClauses = data.clauses.filter((c) => c.is_unusual);
  if (unusualClauses.length > 0) {
    lines.push("### Unusual Clauses", "");
    for (const clause of unusualClauses) {
      lines.push(`- **${clause.title}**: ${clause.unusual_explanation ?? "Atypical for its category."}`);
    }
    lines.push("");
  }
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/lib/export.ts
git commit -m "feat: add overview and unusual indicators to Markdown export"
```

---

### Task 14: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && python -m pytest -v`
Expected: All PASS

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && pnpm build`
Expected: PASS

- [ ] **Step 3: Run frontend linter**

Run: `cd frontend && pnpm lint`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 4: Manual smoke test (optional)**

Start both servers and upload a test contract to verify the overview card and unusual badges render correctly in the report.

- [ ] **Step 5: Final commit if any lint fixes were needed**

```bash
git add -A
git commit -m "chore: lint fixes for contract summary feature"
```
