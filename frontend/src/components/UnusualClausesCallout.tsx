/** Callout section listing clauses flagged as unusual/atypical. */

import type { AnalyzedClause } from "@/types";

interface UnusualClausesCalloutProps {
  clauses: AnalyzedClause[];
}

/** Renders a summary of unusual clauses below the top risks section. */
export function UnusualClausesCallout({ clauses }: UnusualClausesCalloutProps) {
  const unusualClauses = clauses.filter((c) => c.is_unusual);

  if (unusualClauses.length === 0) return null;

  return (
    <div className="mb-7 rounded border border-[var(--risk-unusual-border)] bg-[var(--risk-unusual-bg)] px-5 py-3.5 theme-transition">
      <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--risk-unusual)] font-[var(--font-body)]">
        Unusual Clauses
      </p>
      <ul className="text-[15px] text-[var(--text-secondary)] font-[var(--font-body)]">
        {unusualClauses.map((clause, i) => (
          <li key={i}>
            • <span className="font-medium">{clause.title}</span>
            {clause.unusual_explanation && (
              <span className="text-[var(--text-tertiary)]">
                {" "}— {clause.unusual_explanation}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
