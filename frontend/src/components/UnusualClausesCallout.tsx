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
    <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-900 dark:bg-purple-950/30 theme-transition">
      <p className="mb-1 text-xs font-semibold uppercase text-purple-600 dark:text-purple-400">
        Unusual Clauses
      </p>
      <ul className="text-sm text-[var(--text-secondary)]">
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
