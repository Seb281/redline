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
