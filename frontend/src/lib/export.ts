/** Client-side Markdown export and PDF download trigger. */

import type { AnalyzeResponse } from "@/types";
import { exportPdf } from "@/lib/api";
import { parseExplanation } from "@/lib/citations";

/** Generate a Markdown report string from analysis data. */
export function generateMarkdown(data: AnalyzeResponse): string {
  const lines: string[] = [
    "# Redline — Contract Analysis Report",
    "",
    "> **Disclaimer:** This tool provides analysis only — not legal advice.",
    "",
  ];

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

  lines.push(
    "## Summary",
    "",
    `- **Total Clauses:** ${data.summary.total_clauses}`,
    `- **High Risk:** ${data.summary.risk_breakdown.high}`,
    `- **Medium Risk:** ${data.summary.risk_breakdown.medium}`,
    `- **Low Risk:** ${data.summary.risk_breakdown.low}`,
    `- **Informational:** ${data.summary.risk_breakdown.informational}`,
    "",
  );

  if (data.summary.top_risks.length > 0) {
    lines.push("### Top Risks", "");
    for (const risk of data.summary.top_risks) {
      lines.push(`- ${risk}`);
    }
    lines.push("");
  }

  const unusualClauses = data.clauses.filter((c) => c.is_unusual);
  if (unusualClauses.length > 0) {
    lines.push("### Unusual Clauses", "");
    for (const clause of unusualClauses) {
      lines.push(`- **${clause.title}**: ${clause.unusual_explanation ?? "Atypical for its category."}`);
    }
    lines.push("");
  }

  lines.push("## Clauses", "");

  for (const clause of data.clauses) {
    const level = clause.risk_level.toUpperCase();
    const category = clause.category.replace(/_/g, " ").toUpperCase();
    lines.push(`### ${clause.title}`);
    lines.push(`**${level} RISK** · ${category}`, "");
    if (clause.is_unusual) {
      lines.push(`**ATYPICAL** — ${clause.unusual_explanation ?? "This clause is unusual for its category."}`, "");
    }
    lines.push(clause.plain_english, "");

    // Emit verified citations as Markdown footnotes. Unverified and orphan
    // entries are dropped silently — there is no UI to warn about them in
    // the exported document.
    const segments = parseExplanation(
      clause.plain_english,
      clause.citations,
      clause.clause_text,
    );
    const verifiedCites = segments.filter(
      (s): s is Extract<typeof s, { kind: "cite" }> =>
        s.kind === "cite" && s.verified && s.quotedText !== null,
    );
    if (verifiedCites.length > 0) {
      for (const c of verifiedCites) {
        lines.push(`[^${c.id}]: "${c.quotedText}"`);
      }
      lines.push("");
    }

    lines.push(`**Risk:** ${clause.risk_explanation}`, "");
    if (clause.negotiation_suggestion) {
      lines.push(`**Suggestion:** ${clause.negotiation_suggestion}`, "");
    }
    if (clause.jurisdiction_note) {
      lines.push(`**Jurisdiction:** ${clause.jurisdiction_note}`, "");
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
