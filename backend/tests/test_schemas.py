"""Tests for Pydantic request/response schemas."""

import pytest
from pydantic import ValidationError

from app.schemas import (
    AnalyzedClause,
    AnalyzeResponse,
    AnalysisSummary,
    ApplicableLaw,
    ClauseCategory,
    ContractOverview,
    ExtractedClause,
    Party,
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
        overview=ContractOverview(
            contract_type="Consulting Agreement",
            parties=[Party(name="Acme Corp"), Party(name="Consultant")],
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


def test_risk_breakdown_rejects_negative():
    """RiskBreakdown rejects negative counts."""
    with pytest.raises(ValidationError):
        RiskBreakdown(high=-1, medium=0, low=0)


def test_contract_overview_valid():
    """ContractOverview accepts fully populated data."""
    overview = ContractOverview(
        contract_type="Freelance Services Agreement",
        parties=[Party(name="Acme Corp"), Party(name="Jane Doe")],
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
        parties=[Party(name="Company A"), Party(name="Company B")],
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
            parties=[Party(name="Acme Corp"), Party(name="Jane Doe")],
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


# --- SP-1.9 Party schema regression tests ---


def test_party_roundtrip_with_role_label():
    """Party accepts both legal name and defined-term role label."""
    party = Party(name="ACME Corp", role_label="Provider")
    assert party.name == "ACME Corp"
    assert party.role_label == "Provider"


def test_party_role_label_nullable():
    """role_label is optional — contracts that skip defined terms still validate."""
    party = Party(name="ACME Corp", role_label=None)
    assert party.role_label is None


def test_party_role_label_default_none():
    """Omitting role_label defaults to None (so existing payloads stay valid)."""
    party = Party(name="ACME Corp")
    assert party.role_label is None


def test_contract_overview_parties_are_party_objects():
    """ContractOverview.parties coerces dicts into Party objects."""
    overview = ContractOverview(
        contract_type="Services Agreement",
        parties=[
            {"name": "ACME Corp", "role_label": "Provider"},
            {"name": "Beta LLC", "role_label": None},
        ],
        key_terms=["term1"],
    )
    assert isinstance(overview.parties[0], Party)
    assert overview.parties[0].role_label == "Provider"
    assert overview.parties[1].role_label is None


def test_contract_overview_rejects_bare_string_parties():
    """SP-1.9 is a clean break — plain strings are no longer accepted."""
    with pytest.raises(ValidationError):
        ContractOverview(
            contract_type="Services Agreement",
            parties=["ACME Corp", "Beta LLC"],
            key_terms=[],
        )


# --- SP-1.5 text_source regression tests ---


def test_upload_response_defaults_text_source_native():
    """SP-1.5: UploadResponse defaults text_source to 'native' when omitted."""
    response = UploadResponse(
        filename="x.pdf",
        file_type="pdf",
        page_count=1,
        extracted_text="x" * 100,
        char_count=100,
    )
    assert response.text_source == "native"


def test_upload_response_accepts_ocr_text_source():
    """SP-1.5: UploadResponse carries text_source='ocr' end-to-end."""
    response = UploadResponse(
        filename="scan.pdf",
        file_type="pdf",
        page_count=3,
        extracted_text="y" * 100,
        char_count=100,
        text_source="ocr",
    )
    assert response.text_source == "ocr"


def test_upload_response_accepts_hybrid_text_source():
    """SP-1.5: UploadResponse carries text_source='hybrid' end-to-end."""
    response = UploadResponse(
        filename="mix.pdf",
        file_type="pdf",
        page_count=5,
        extracted_text="z" * 100,
        char_count=100,
        text_source="hybrid",
    )
    assert response.text_source == "hybrid"


def test_upload_response_rejects_unknown_text_source():
    """Unknown text_source values fail validation."""
    with pytest.raises(ValidationError):
        UploadResponse(
            filename="x.pdf",
            file_type="pdf",
            page_count=1,
            extracted_text="x" * 100,
            char_count=100,
            text_source="scanned",
        )


def test_provenance_model_accepts_text_source():
    """SP-1.5: ProvenanceModel accepts optional text_source."""
    from app.schemas import ProvenanceModel, ReasoningEffortPerPass

    p = ProvenanceModel(
        provider="mistral",
        model="mistral-small-4",
        snapshot="mistral-small-2503",
        region="eu-west",
        reasoning_effort_per_pass=ReasoningEffortPerPass(
            overview="low", extraction="medium", risk="high", think_hard="high"
        ),
        prompt_template_version="1.0",
        timestamp="2026-04-17T00:00:00Z",
        text_source="hybrid",
    )
    assert p.text_source == "hybrid"


def test_provenance_model_text_source_defaults_none():
    """Legacy provenance payloads without text_source deserialize unchanged."""
    from app.schemas import ProvenanceModel, ReasoningEffortPerPass

    p = ProvenanceModel(
        provider="mistral",
        model="mistral-small-4",
        snapshot="mistral-small-2503",
        region="eu-west",
        reasoning_effort_per_pass=ReasoningEffortPerPass(
            overview="low", extraction="medium", risk="high", think_hard="high"
        ),
        prompt_template_version="1.0",
        timestamp="2026-04-17T00:00:00Z",
    )
    assert p.text_source is None


# --- SP-1.7 JurisdictionEvidence + ApplicableLaw regression tests ---


class TestJurisdictionEvidence:
    """Contract-level jurisdiction grounding — shape and defaults."""

    def test_stated_with_source_text_accepted(self):
        """Pass 0 'stated' evidence round-trips intact."""
        o = ContractOverview(
            contract_type="x",
            parties=[],
            key_terms=[],
            governing_jurisdiction="Netherlands",
            jurisdiction_evidence={
                "source_type": "stated",
                "source_text": "\u00a714 Governing Law",
            },
        )
        assert o.jurisdiction_evidence is not None
        assert o.jurisdiction_evidence.source_type == "stated"

    def test_unknown_with_null_source_text_accepted(self):
        """Pass 0 'unknown' evidence coexists with a null country."""
        o = ContractOverview(
            contract_type="x",
            parties=[],
            key_terms=[],
            governing_jurisdiction=None,
            jurisdiction_evidence={
                "source_type": "unknown",
                "source_text": None,
            },
        )
        assert o.jurisdiction_evidence is not None
        assert o.jurisdiction_evidence.source_type == "unknown"

    def test_missing_jurisdiction_evidence_defaults_to_none(self):
        """Legacy rows (pre-SP-1.7) that omit the field deserialize intact."""
        o = ContractOverview(contract_type="x", parties=[], key_terms=[])
        assert o.jurisdiction_evidence is None


class TestApplicableLaw:
    """Clause-level legal grounding — invariants + whitelist enforcement."""

    def test_statute_cited_with_citations_accepted(self):
        """statute_cited + at least one citation is valid."""
        a = ApplicableLaw(
            observation="void under German law",
            source_type="statute_cited",
            citations=[{"code": "DE_BGB_276"}],
        )
        assert a.citations[0].code == "DE_BGB_276"

    def test_general_principle_with_empty_citations_accepted(self):
        """general_principle + empty citations is valid."""
        a = ApplicableLaw(
            observation="general EU principle",
            source_type="general_principle",
            citations=[],
        )
        assert a.source_type == "general_principle"

    def test_statute_cited_with_no_citations_rejected(self):
        """statute_cited without citations violates the invariant."""
        with pytest.raises(ValidationError):
            ApplicableLaw(
                observation="x",
                source_type="statute_cited",
                citations=[],
            )

    def test_general_principle_with_citations_rejected(self):
        """general_principle with citations violates the invariant."""
        with pytest.raises(ValidationError):
            ApplicableLaw(
                observation="x",
                source_type="general_principle",
                citations=[{"code": "EU_GDPR"}],
            )

    def test_off_enum_code_rejected(self):
        """Citations must cite codes from the whitelist — freeform rejected."""
        with pytest.raises(ValidationError):
            ApplicableLaw(
                observation="x",
                source_type="statute_cited",
                citations=[{"code": "NOT_A_STATUTE"}],
            )


class TestAnalyzedClauseSP17:
    """AnalyzedClause carries the new applicable_law field."""

    def test_applicable_law_null_accepted(self):
        """Most clauses have no applicable_law — null round-trips."""
        c = AnalyzedClause(
            clause_text="x",
            category="other",
            title="t",
            plain_english="p",
            risk_level="low",
            risk_explanation="r",
            applicable_law=None,
        )
        assert c.applicable_law is None

    def test_applicable_law_populated_accepted(self):
        """A clause with applicable_law round-trips through validation."""
        c = AnalyzedClause(
            clause_text="x",
            category="other",
            title="t",
            plain_english="p",
            risk_level="low",
            risk_explanation="r",
            applicable_law={
                "observation": "o",
                "source_type": "general_principle",
                "citations": [],
            },
        )
        assert c.applicable_law is not None
        assert c.applicable_law.observation == "o"
