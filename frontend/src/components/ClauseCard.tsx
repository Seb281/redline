/** Individual clause card with expandable risk details. */

"use client";

import { useId, useState } from "react";
import type { AnalyzedClause } from "@/types";
import { RiskBadge } from "@/components/RiskBadge";
import { ClauseExplanation } from "@/components/ClauseExplanation";

const BORDER_COLORS = {
  high: "border-l-[var(--risk-high)]",
  medium: "border-l-[var(--risk-medium)]",
  low: "border-l-[var(--risk-low)]",
  informational: "border-l-[var(--risk-info)]",
} as const;

interface ClauseCardProps {
  clause: AnalyzedClause;
  onAskAbout?: (clause: AnalyzedClause) => void;
}

/** Renders a single clause with risk badge, category, and expandable details. */
export function ClauseCard({ clause, onAskAbout }: ClauseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cardId = useId().replace(/:/g, "-");
  const categoryLabel = clause.category.replace(/_/g, " ").toUpperCase();
  const hasDetails =
    clause.risk_level !== "informational";

  return (
    <div
      className={`rounded border border-[var(--border-primary)] border-l-4 bg-[var(--bg-card)] p-5 theme-transition ${BORDER_COLORS[clause.risk_level]}`}
    >
      <div className="mb-2.5 flex items-start gap-2.5">
        <RiskBadge level={clause.risk_level} />
        <span className="rounded bg-[var(--bg-tertiary)] px-2.5 py-0.5 text-sm text-[var(--text-tertiary)] font-[var(--font-body)]">
          {categoryLabel}
        </span>
        {clause.is_unusual && (
          <span className="rounded border border-[var(--risk-unusual-border)] bg-[var(--risk-unusual-bg)] px-2.5 py-0.5 text-sm font-semibold text-[var(--risk-unusual)] font-[var(--font-body)]">
            ATYPICAL
          </span>
        )}
      </div>

      <h3 className="mb-1.5 text-lg font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
        {clause.title}
      </h3>

      <ClauseExplanation
        plainEnglish={clause.plain_english}
        citations={clause.citations}
        clauseText={clause.clause_text}
        cardId={cardId}
      />

      {hasDetails && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2.5 text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      )}

      {expanded && (
        <div className="mt-3.5 rounded bg-[var(--bg-secondary)] p-3.5 text-[15px] leading-relaxed text-[var(--text-secondary)] font-[var(--font-body)]">
          <p>
            <strong className="text-[var(--accent)]">Risk:</strong>{" "}
            {clause.risk_explanation}
          </p>
          {clause.negotiation_suggestion && (
            <p className="mt-2.5">
              <strong className="text-blue-600 dark:text-blue-400">Suggestion:</strong>{" "}
              {clause.negotiation_suggestion}
            </p>
          )}
          {clause.unusual_explanation && (
            <p className="mt-2.5">
              <strong className="text-[var(--risk-unusual)]">Unusual:</strong>{" "}
              {clause.unusual_explanation}
            </p>
          )}
          {clause.jurisdiction_note && (
            <p className="mt-2.5">
              <strong className="text-amber-600 dark:text-amber-400">Jurisdiction:</strong>{" "}
              {clause.jurisdiction_note}
            </p>
          )}
          <details className="mt-2.5">
            <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              Original clause text
            </summary>
            <p className="mt-1.5 whitespace-pre-wrap font-mono text-sm text-[var(--text-tertiary)]">
              {clause.clause_text}
            </p>
          </details>
          {onAskAbout && (
            <button
              type="button"
              onClick={() => onAskAbout(clause)}
              className="mt-3 text-[13px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
            >
              Ask about this clause →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
