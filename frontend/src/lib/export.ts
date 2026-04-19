/**
 * Client-side Markdown export and PDF download trigger.
 *
 * `generateMarkdown` stays a pure function — it does not call
 * `useTranslations` directly (that would couple it to React) nor
 * import `next-intl` (which would make unit tests pull in the full
 * runtime). Instead callers resolve a `MarkdownLabels` bag via the
 * `Export` namespace and hand it in. Tests pass the English defaults
 * exported from this module so they keep working without an intl
 * provider.
 */

import type { AnalyzeResponse, RiskLevel } from "@/types";
import { exportPdf } from "@/lib/api";
import { parseExplanation } from "@/lib/citations";
import { STATUTE_LABELS } from "@/lib/applicable-law";

/** All heading/prose strings used by the Markdown exporter. */
export interface MarkdownLabels {
  title: string;
  disclaimerLabel: string;
  disclaimerBody: string;
  contractOverview: string;
  type: string;
  parties: string;
  effectiveDate: string;
  duration: string;
  value: string;
  jurisdiction: string;
  keyTerms: string;
  summary: string;
  totalClauses: string;
  highRisk: string;
  mediumRisk: string;
  lowRisk: string;
  informational: string;
  topRisks: string;
  unusualClauses: string;
  atypicalDefault: string;
  atypicalGeneric: string;
  clauses: string;
  riskSuffix: string;
  atypicalBadge: string;
  risk: string;
  suggestion: string;
  cited: string;
  originalClauseText: string;
  riskLevel: Record<RiskLevel, string>;
}

/**
 * English defaults for `MarkdownLabels`. Kept in sync with the
 * `Export` namespace in `messages/en.json`; unit tests import these
 * directly so they don't need an intl provider.
 */
export const DEFAULT_MARKDOWN_LABELS: MarkdownLabels = {
  title: "Redline — Contract Analysis Report",
  disclaimerLabel: "Disclaimer",
  disclaimerBody: "This tool provides analysis only — not legal advice.",
  contractOverview: "Contract Overview",
  type: "Type",
  parties: "Parties",
  effectiveDate: "Effective Date",
  duration: "Duration",
  value: "Value",
  jurisdiction: "Jurisdiction",
  keyTerms: "Key Terms",
  summary: "Summary",
  totalClauses: "Total Clauses",
  highRisk: "High Risk",
  mediumRisk: "Medium Risk",
  lowRisk: "Low Risk",
  informational: "Informational",
  topRisks: "Top Risks",
  unusualClauses: "Unusual Clauses",
  atypicalDefault: "Atypical for its category.",
  atypicalGeneric: "This clause is unusual for its category.",
  clauses: "Clauses",
  riskSuffix: "RISK",
  atypicalBadge: "ATYPICAL",
  risk: "Risk",
  suggestion: "Suggestion",
  cited: "Cited",
  originalClauseText: "Original clause text",
  riskLevel: {
    high: "HIGH",
    medium: "MEDIUM",
    low: "LOW",
    informational: "INFORMATIONAL",
  },
};

/** Generate a Markdown report string from analysis data. */
export function generateMarkdown(
  data: AnalyzeResponse,
  labels: MarkdownLabels = DEFAULT_MARKDOWN_LABELS,
): string {
  const lines: string[] = [
    `# ${labels.title}`,
    "",
    `> **${labels.disclaimerLabel}:** ${labels.disclaimerBody}`,
    "",
  ];

  // Overview section
  lines.push(`## ${labels.contractOverview}`, "");
  lines.push(`**${labels.type}:** ${data.overview.contract_type}`);
  lines.push(`**${labels.parties}:** ${data.overview.parties.join(", ")}`);
  if (data.overview.effective_date) {
    lines.push(`**${labels.effectiveDate}:** ${data.overview.effective_date}`);
  }
  if (data.overview.duration) {
    lines.push(`**${labels.duration}:** ${data.overview.duration}`);
  }
  if (data.overview.total_value) {
    lines.push(`**${labels.value}:** ${data.overview.total_value}`);
  }
  if (data.overview.governing_jurisdiction) {
    lines.push(`**${labels.jurisdiction}:** ${data.overview.governing_jurisdiction}`);
  }
  lines.push("");
  lines.push(`### ${labels.keyTerms}`, "");
  for (const term of data.overview.key_terms) {
    lines.push(`- ${term}`);
  }
  lines.push("");

  lines.push(
    `## ${labels.summary}`,
    "",
    `- **${labels.totalClauses}:** ${data.summary.total_clauses}`,
    `- **${labels.highRisk}:** ${data.summary.risk_breakdown.high}`,
    `- **${labels.mediumRisk}:** ${data.summary.risk_breakdown.medium}`,
    `- **${labels.lowRisk}:** ${data.summary.risk_breakdown.low}`,
    `- **${labels.informational}:** ${data.summary.risk_breakdown.informational}`,
    "",
  );

  if (data.summary.top_risks.length > 0) {
    lines.push(`### ${labels.topRisks}`, "");
    for (const risk of data.summary.top_risks) {
      lines.push(`- ${risk}`);
    }
    lines.push("");
  }

  const unusualClauses = data.clauses.filter((c) => c.is_unusual);
  if (unusualClauses.length > 0) {
    lines.push(`### ${labels.unusualClauses}`, "");
    for (const clause of unusualClauses) {
      lines.push(
        `- **${clause.title}**: ${clause.unusual_explanation ?? labels.atypicalDefault}`,
      );
    }
    lines.push("");
  }

  lines.push(`## ${labels.clauses}`, "");

  for (const clause of data.clauses) {
    const level = labels.riskLevel[clause.risk_level];
    const category = clause.category.replace(/_/g, " ").toUpperCase();
    lines.push(`### ${clause.title}`);
    lines.push(`**${level} ${labels.riskSuffix}** · ${category}`, "");
    if (clause.is_unusual) {
      lines.push(
        `**${labels.atypicalBadge}** — ${clause.unusual_explanation ?? labels.atypicalGeneric}`,
        "",
      );
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

    lines.push(`**${labels.risk}:** ${clause.risk_explanation}`, "");
    if (clause.negotiation_suggestion) {
      lines.push(`**${labels.suggestion}:** ${clause.negotiation_suggestion}`, "");
    }
    if (clause.applicable_law) {
      lines.push(
        `**${labels.jurisdiction}:** ${clause.applicable_law.observation}`,
        "",
      );
      if (clause.applicable_law.citations.length > 0) {
        const statutes = clause.applicable_law.citations
          .map((c) => STATUTE_LABELS[c.code])
          .join("; ");
        lines.push(`${labels.cited}: ${statutes}`, "");
      }
    }
    lines.push(`<details><summary>${labels.originalClauseText}</summary>`, "");
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
export function downloadMarkdown(
  data: AnalyzeResponse,
  labels: MarkdownLabels = DEFAULT_MARKDOWN_LABELS,
) {
  const md = generateMarkdown(data, labels);
  downloadString(md, "redline-report.md", "text/markdown");
}

/** Export analysis as PDF via backend and trigger download. */
export async function downloadPdf(data: AnalyzeResponse) {
  const blob = await exportPdf(data);
  downloadBlob(blob, "redline-report.pdf");
}
