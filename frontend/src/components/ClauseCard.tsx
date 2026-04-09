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
      className={`rounded-lg border border-gray-200 border-l-4 bg-white p-4 ${BORDER_COLORS[clause.risk_level]}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <RiskBadge level={clause.risk_level} />
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {categoryLabel}
        </span>
      </div>

      <h3 className="mb-1 text-sm font-semibold text-gray-800">
        {clause.title}
      </h3>
      <p className="text-sm leading-relaxed text-gray-600">
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
        <div className="mt-3 rounded-md bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
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
          <details className="mt-2">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
              Original clause text
            </summary>
            <p className="mt-1 whitespace-pre-wrap font-mono text-gray-500">
              {clause.clause_text}
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
