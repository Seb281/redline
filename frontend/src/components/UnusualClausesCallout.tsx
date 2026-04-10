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
    <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
      <p className="mb-1 text-xs font-semibold uppercase text-purple-600">
        Unusual Clauses
      </p>
      <ul className="text-sm text-gray-700">
        {unusualClauses.map((clause, i) => (
          <li key={i}>
            • <span className="font-medium">{clause.title}</span>
            {clause.unusual_explanation && (
              <span className="text-gray-500">
                {" "}— {clause.unusual_explanation}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
