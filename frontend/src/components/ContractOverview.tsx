/** Contract overview card — shows high-level contract metadata. */

import type { ContractOverview as ContractOverviewType } from "@/types";

interface ContractOverviewProps {
  overview: ContractOverviewType;
}

/** Renders structured contract metadata at the top of the report. */
export function ContractOverview({ overview }: ContractOverviewProps) {
  const details: string[] = [];
  if (overview.effective_date) details.push(`Effective: ${overview.effective_date}`);
  if (overview.duration) details.push(`Duration: ${overview.duration}`);
  if (overview.total_value) details.push(`Value: ${overview.total_value}`);
  if (overview.governing_jurisdiction) {
    details.push(`Jurisdiction: ${overview.governing_jurisdiction}`);
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
      <h2 className="mb-1 text-lg font-semibold text-gray-800">
        {overview.contract_type}
      </h2>
      <p className="mb-3 text-sm text-gray-500">
        {overview.parties.join(" · ")}
      </p>

      {details.length > 0 && (
        <p className="mb-3 text-sm text-gray-600">
          {details.join(" · ")}
        </p>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-gray-400">
          Key Terms
        </p>
        <ul className="space-y-1 text-sm text-gray-600">
          {overview.key_terms.map((term, i) => (
            <li key={i}>• {term}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
