/** Individual clause card with expandable risk details. */

"use client";

import { useState } from "react";
import type { AnalyzedClause } from "@/types";
import { RiskBadge } from "@/components/RiskBadge";

const BORDER_COLORS = {
  high: "border-l-red-500",
  medium: "border-l-yellow-500",
  low: "border-l-green-500",
} as const;

interface ClauseCardProps {
  clause: AnalyzedClause;
}

export function ClauseCard({ clause }: ClauseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const categoryLabel = clause.category.replace(/_/g, " ").toUpperCase();
  const hasDetails =
    clause.risk_level !== "low" || clause.risk_explanation.length > 0;

  return (
    <div
      className={`rounded-lg border border-[var(--border-primary)] border-l-4 bg-[var(--bg-card)] p-4 theme-transition ${BORDER_COLORS[clause.risk_level]}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <RiskBadge level={clause.risk_level} />
        <span className="rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
          {categoryLabel}
        </span>
        {clause.is_unusual && (
          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
            ATYPICAL
          </span>
        )}
      </div>

      <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
        {clause.title}
      </h3>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        {clause.plain_english}
      </p>

      {hasDetails && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      )}

      {expanded && (
        <div className="mt-3 rounded-md bg-[var(--bg-secondary)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>
            <strong className="text-red-600">Risk:</strong>{" "}
            {clause.risk_explanation}
          </p>
          {clause.negotiation_suggestion && (
            <p className="mt-2">
              <strong className="text-blue-600">Suggestion:</strong>{" "}
              {clause.negotiation_suggestion}
            </p>
          )}
          {clause.unusual_explanation && (
            <p className="mt-2">
              <strong className="text-purple-600">Unusual:</strong>{" "}
              {clause.unusual_explanation}
            </p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              Original clause text
            </summary>
            <p className="mt-1 whitespace-pre-wrap font-mono text-[var(--text-tertiary)]">
              {clause.clause_text}
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
