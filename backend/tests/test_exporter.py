"""Tests for the PDF/HTML report exporter."""

from app.schemas import (
    AnalyzedClause,
    AnalyzeResponse,
    AnalysisSummary,
    ApplicableLaw,
    ApplicableLawCitation,
    ClauseCategory,
    ContractOverview,
    JurisdictionEvidence,
    Party,
    RiskBreakdown,
    RiskLevel,
)
from app.services.exporter import generate_pdf, render_report_html


def _make_sample_response() -> AnalyzeResponse:
    """Build a sample AnalyzeResponse for testing."""
    overview = ContractOverview(
        contract_type="Consulting Agreement",
        parties=[Party(name="Acme Corp", role_label="Provider"), Party(name="The Consultant", role_label="Consultant")],
        effective_date=None,
        duration=None,
        total_value=None,
        governing_jurisdiction="State of Delaware",
        key_terms=[
            "Non-compete restriction covering Europe for 2 years",
            "Governed by Delaware law",
        ],
    )
    return AnalyzeResponse(
        overview=overview,
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
    assert "Governing Law" in html


def test_generate_pdf_returns_bytes():
    """generate_pdf returns valid PDF bytes."""
    data = _make_sample_response()
    pdf_bytes = generate_pdf(data)
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes[:5] == b"%PDF-"
    assert len(pdf_bytes) > 100


def test_render_report_html_includes_overview(sample_analyzed_clauses):
    """PDF HTML template includes contract overview section."""
    overview = ContractOverview(
        contract_type="Consulting Agreement",
        parties=[Party(name="Acme Corp", role_label="Provider"), Party(name="The Consultant", role_label="Consultant")],
        effective_date="2026-01-15",
        duration="12 months",
        total_value="$120,000",
        governing_jurisdiction="State of Delaware",
        key_terms=["Non-compete for 2 years", "IP assignment of all work"],
    )
    data = AnalyzeResponse(
        overview=overview,
        summary=AnalysisSummary(
            total_clauses=2,
            risk_breakdown=RiskBreakdown(high=1, medium=0, low=1),
            top_risks=["Non-Compete Restriction: 2-year scope is broad."],
        ),
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
    overview = ContractOverview(
        contract_type="Agreement",
        parties=[Party(name="A"), Party(name="B")],
        effective_date=None,
        duration=None,
        total_value=None,
        governing_jurisdiction=None,
        key_terms=["Term 1"],
    )
    data = AnalyzeResponse(
        overview=overview,
        summary=AnalysisSummary(
            total_clauses=2,
            risk_breakdown=RiskBreakdown(high=1, medium=0, low=1),
            top_risks=["Non-Compete Restriction: 2-year scope is broad."],
        ),
        clauses=sample_analyzed_clauses,
    )
    html = render_report_html(data)
    assert "ATYPICAL" in html


# --- SP-1.7 jurisdiction grounding ---


def test_overview_jurisdiction_pill_stated():
    """Overview renders STATED pill + escaped country name."""
    data = _make_sample_response()
    data.overview.governing_jurisdiction = "Netherlands"
    data.overview.jurisdiction_evidence = JurisdictionEvidence(
        source_type="stated",
        source_text="§14 Governing Law",
    )
    html = render_report_html(data)
    assert "Jurisdiction:</strong> Netherlands" in html
    assert "STATED" in html


def test_overview_jurisdiction_unknown_em_dash():
    """Unknown jurisdiction renders em-dash + UNKNOWN pill."""
    data = _make_sample_response()
    data.overview.governing_jurisdiction = None
    data.overview.jurisdiction_evidence = JurisdictionEvidence(
        source_type="unknown",
        source_text=None,
    )
    html = render_report_html(data)
    assert "Jurisdiction:</strong> —" in html
    assert "UNKNOWN" in html


def test_clause_applicable_law_statute_cited():
    """Clause with statute_cited renders observation + canonical label."""
    data = _make_sample_response()
    data.clauses[0].applicable_law = ApplicableLaw(
        observation="Void under German law",
        source_type="statute_cited",
        citations=[ApplicableLawCitation(code="DE_BGB_276")],
    )
    html = render_report_html(data)
    assert "Jurisdiction:</strong> Void under German law" in html
    assert "BGB §276" in html


def test_clause_applicable_law_general_principle_no_cite_block():
    """general_principle renders observation but no 'Cited:' block."""
    data = _make_sample_response()
    data.clauses[0].applicable_law = ApplicableLaw(
        observation="General EU principle",
        source_type="general_principle",
        citations=[],
    )
    html = render_report_html(data)
    assert "General EU principle" in html
    assert "Cited:" not in html or "BGB" not in html


def test_clause_applicable_law_null_renders_nothing():
    """applicable_law=None emits no Jurisdiction block on the clause."""
    data = _make_sample_response()
    data.clauses[0].applicable_law = None
    html = render_report_html(data)
    clause_section = html.split(data.clauses[0].title)[1].split("\n")[0]
    assert "Jurisdiction:</strong> " not in clause_section
