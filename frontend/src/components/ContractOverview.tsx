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
    <div className="mb-7 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6 theme-transition">
      <h2 className="mb-1.5 text-[25px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
        {overview.contract_type}
      </h2>
      <p className="mb-3.5 text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)]">
        {overview.parties.map((p) => p.name).join(" · ")}
      </p>

      {details.length > 0 && (
        <p className="mb-3.5 text-[15px] text-[var(--text-secondary)] font-[var(--font-body)]">
          {details.join(" · ")}
        </p>
      )}

      <div>
        <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
          Key Terms
        </p>
        <ul className="space-y-1.5 text-[15px] text-[var(--text-secondary)] font-[var(--font-body)]">
          {overview.key_terms.map((term, i) => (
            <li key={i}>• {term}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
