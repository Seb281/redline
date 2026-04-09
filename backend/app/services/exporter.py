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
