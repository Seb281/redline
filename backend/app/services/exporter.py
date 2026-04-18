"""PDF report generation via HTML template + WeasyPrint."""

import html as html_module

from weasyprint import HTML

from app.schemas import AnalyzeResponse, RiskLevel

_RISK_COLORS = {
    RiskLevel.HIGH: {"bg": "#fef2f2", "border": "#fecaca", "text": "#dc2626"},
    RiskLevel.MEDIUM: {"bg": "#fefce8", "border": "#fef08a", "text": "#ca8a04"},
    RiskLevel.LOW: {"bg": "#f0fdf4", "border": "#bbf7d0", "text": "#16a34a"},
    RiskLevel.INFORMATIONAL: {"bg": "#f9fafb", "border": "#e5e7eb", "text": "#6b7280"},
}

_RISK_BORDER = {
    RiskLevel.HIGH: "#ef4444",
    RiskLevel.MEDIUM: "#eab308",
    RiskLevel.LOW: "#22c55e",
    RiskLevel.INFORMATIONAL: "#9ca3af",
}

# SP-1.7 — canonical statute labels. Must mirror
# frontend/src/lib/applicable-law.ts STATUTE_LABELS exactly so exported
# PDFs and UI cards surface identical citation strings.
_STATUTE_LABELS: dict[str, str] = {
    "DE_BGB_276": "BGB §276 — German Civil Code",
    "DE_ARBNERFG": "Arbeitnehmererfindungsgesetz — German Employee Invention Law",
    "DE_KARENZENTSCHAEDIGUNG": "HGB §74 — German non-compete compensation requirement",
    "NL_BW_7_650": "BW 7:650 — Dutch Civil Code (non-compete form)",
    "NL_BW_7_653": "BW 7:653 — Dutch Civil Code (non-compete validity)",
    "FR_CODE_TRAVAIL_NONCOMPETE":
        "Code du Travail — French non-compete compensation (contrepartie financière)",
    "EU_GDPR": "GDPR — Regulation (EU) 2016/679",
    "EU_DIR_93_13_EEC": "Directive 93/13/EEC — EU Unfair Terms",
}

# SP-1.7 — pill palette keyed by jurisdiction_evidence.source_type.
# Tuple shape: (background, text, border).
_PILL_COLORS: dict[str, tuple[str, str, str]] = {
    "stated": ("#d1fae5", "#065f46", "#a7f3d0"),
    "inferred": ("#fef3c7", "#92400e", "#fde68a"),
    "unknown": ("#f3f4f6", "#6b7280", "#e5e7eb"),
}


def render_report_html(data: AnalyzeResponse) -> str:
    """Render the analysis data as an HTML report for PDF conversion.

    Builds a fully self-contained HTML string (inline styles) that WeasyPrint
    can convert to a PDF. Includes:
      - Disclaimer banner
      - Contract overview card (type, parties, metadata, key terms)
      - Risk summary cards and top-risks list
      - Clause cards with risk badge, category label, optional ATYPICAL badge,
        negotiation suggestion, and unusual-clause explanation
    """
    # Build overview section
    # SP-1.9 — `parties` carries `Party` objects (name + optional role_label).
    # Render `role (name)` when a role_label is present, else just the name.
    def _party_display(party) -> str:
        """Format a single party for the PDF header."""
        if party.role_label:
            return f"{party.role_label} ({party.name})"
        return party.name

    parties_html = ", ".join(
        html_module.escape(_party_display(p)) for p in data.overview.parties
    )
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
    # SP-1.7 — render jurisdiction as a pill showing provenance
    # (stated / inferred / unknown). Em-dash stands in when
    # governing_jurisdiction is null (unknown is the only source_type
    # permitted to pair with a null country).
    if data.overview.jurisdiction_evidence is not None:
        jev = data.overview.jurisdiction_evidence
        country = (
            html_module.escape(data.overview.governing_jurisdiction)
            if data.overview.governing_jurisdiction
            else "—"
        )
        bg, txt, br = _PILL_COLORS[jev.source_type]
        pill_html = (
            f'<span style="display:inline-block;padding:2px 8px;border-radius:4px;'
            f'font-size:11px;font-weight:600;background:{bg};color:{txt};'
            f'border:1px solid {br};margin-left:6px;" '
            f'title="{html_module.escape(jev.source_text or "")}">'
            f"{jev.source_type.upper()}</span>"
        )
        overview_details.append(
            f"<span><strong>Jurisdiction:</strong> {country}{pill_html}</span>"
        )
    details_html = " &middot; ".join(overview_details) if overview_details else ""

    overview_html = f"""
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
    """

    # Build clause cards
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

        # ATYPICAL badge shown when the clause deviates from market norms
        unusual_badge_html = ""
        if clause.is_unusual:
            unusual_badge_html = (
                '<span style="display:inline-block;padding:2px 8px;border-radius:4px;'
                'font-size:11px;font-weight:600;background:#ede9fe;'
                'color:#7c3aed;margin-left:6px;">ATYPICAL</span>'
            )

        # Additional detail block for unusual-clause rationale
        unusual_detail_html = ""
        if clause.unusual_explanation:
            unusual_detail_html = (
                f'<p style="margin-top:8px;color:#7c3aed;">'
                f"<strong>Unusual:</strong> "
                f"{html_module.escape(clause.unusual_explanation)}</p>"
            )

        # SP-1.7 — structured applicable_law replaces the free-text
        # jurisdiction_note. The observation prints as an amber block;
        # when citations exist they resolve through _STATUTE_LABELS to
        # match the frontend UI and markdown export verbatim.
        applicable_law_html = ""
        if clause.applicable_law:
            labels_html = ""
            if clause.applicable_law.citations:
                labels = "; ".join(
                    html_module.escape(_STATUTE_LABELS[c.code])
                    for c in clause.applicable_law.citations
                )
                labels_html = (
                    f'<p style="margin-top:4px;color:#6b7280;font-size:11px;'
                    f'font-family:monospace;">Cited: {labels}</p>'
                )
            applicable_law_html = (
                f'<p style="margin-top:8px;color:#d97706;">'
                f"<strong>Jurisdiction:</strong> "
                f"{html_module.escape(clause.applicable_law.observation)}"
                f"</p>{labels_html}"
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
                {unusual_badge_html}
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
            {unusual_detail_html}
            {applicable_law_html}
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

    {overview_html}

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
        <div class="summary-card" style="background:#f9fafb;border:1px solid #e5e7eb;">
            <div class="count" style="color:#6b7280;">{data.summary.risk_breakdown.informational}</div>
            <div class="label" style="color:#9ca3af;">Info</div>
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
