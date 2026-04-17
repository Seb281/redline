/**
 * Contract overview card — shows high-level contract metadata.
 *
 * SP-1.9: Parties render as role labels by default (e.g. "Provider ·
 * Client"). The global "Show real names" toggle, exposed via
 * {@link useRehydrate}, switches to the rehydrated form
 * "Provider (ACME Corp) · Client (Beta LLC)" for private review.
 *
 * Consumers may pass `labels` explicitly (streaming path — carries the
 * user's edits from the RedactionPreview) or omit it (history path —
 * derived via heuristic + stored `role_label`).
 */

"use client";

import type { ContractOverview as ContractOverviewType } from "@/types";
import { useRehydrate } from "@/contexts/RehydrateContext";
import { deriveLabels } from "@/lib/history/adapt-overview";

interface ContractOverviewProps {
  overview: ContractOverviewType;
  /**
   * Canonical role labels parallel to `overview.parties`. When omitted,
   * labels are derived from party `role_label` + heuristic fallback.
   */
  labels?: string[];
}

/**
 * Turn a canonical label into human-readable display text:
 * `DISCLOSING_PARTY` → `Disclosing Party`.
 */
function titleCase(label: string): string {
  return label
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/** Renders structured contract metadata at the top of the report. */
export function ContractOverview({ overview, labels }: ContractOverviewProps) {
  const { rehydrate } = useRehydrate();
  const resolvedLabels = labels ?? deriveLabels(overview);

  const details: string[] = [];
  if (overview.effective_date) details.push(`Effective: ${overview.effective_date}`);
  if (overview.duration) details.push(`Duration: ${overview.duration}`);
  if (overview.total_value) details.push(`Value: ${overview.total_value}`);
  if (overview.governing_jurisdiction) {
    details.push(`Jurisdiction: ${overview.governing_jurisdiction}`);
  }

  // Role-first display; legal name disclosed only when rehydrate is on.
  const partyDisplay = overview.parties
    .map((party, i) => {
      const label = resolvedLabels[i];
      const pretty = label ? titleCase(label) : party.name;
      return rehydrate ? `${pretty} (${party.name})` : pretty;
    })
    .join(" · ");

  return (
    <div className="mb-7 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-6 theme-transition">
      <h2 className="mb-1.5 text-[25px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
        {overview.contract_type}
      </h2>
      <p className="mb-3.5 text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)]">
        {partyDisplay}
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
