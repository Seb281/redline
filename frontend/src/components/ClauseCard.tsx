/** Individual clause card with expandable risk details. */

"use client";

import { useState } from "react";
import type { AnalyzedClause } from "@/types";
import { RiskBadge } from "@/components/RiskBadge";

const BORDER_COLORS = {
  high: "border-l-[var(--risk-high)]",
  medium: "border-l-[var(--risk-medium)]",
  low: "border-l-[var(--risk-low)]",
} as const;

interface ClauseCardProps {
  clause: AnalyzedClause;
}

/** Renders a single clause with risk badge, category, and expandable details. */
export function ClauseCard({ clause }: ClauseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const categoryLabel = clause.category.replace(/_/g, " ").toUpperCase();
  const hasDetails =
    clause.risk_level !== "low" || clause.risk_explanation.length > 0;

  return (
    <div
      className={`rounded border border-[var(--border-primary)] border-l-4 bg-[var(--bg-card)] p-4 theme-transition ${BORDER_COLORS[clause.risk_level]}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <RiskBadge level={clause.risk_level} />
        <span className="rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)] font-[var(--font-body)]">
          {categoryLabel}
        </span>
        {clause.is_unusual && (
          <span className="rounded border border-[var(--risk-unusual-border)] bg-[var(--risk-unusual-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--risk-unusual)] font-[var(--font-body)]">
            ATYPICAL
          </span>
        )}
      </div>

      <h3 className="mb-1 text-[15px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
        {clause.title}
      </h3>
      <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] font-[var(--font-body)]">
        {clause.plain_english}
      </p>

      {hasDetails && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-[var(--accent)] font-[var(--font-body)] hover:underline"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      )}

      {expanded && (
        <div className="mt-3 rounded bg-[var(--bg-secondary)] p-3 text-xs leading-relaxed text-[var(--text-secondary)] font-[var(--font-body)]">
          <p>
            <strong className="text-[var(--accent)]">Risk:</strong>{" "}
            {clause.risk_explanation}
          </p>
          {clause.negotiation_suggestion && (
            <p className="mt-2">
              <strong className="text-blue-600 dark:text-blue-400">Suggestion:</strong>{" "}
              {clause.negotiation_suggestion}
            </p>
          )}
          {clause.unusual_explanation && (
            <p className="mt-2">
              <strong className="text-[var(--risk-unusual)]">Unusual:</strong>{" "}
              {clause.unusual_explanation}
            </p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              Original clause text
            </summary>
            <p className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-[var(--text-tertiary)]">
              {clause.clause_text}
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
