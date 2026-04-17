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

/**
 * SP-1.7 — Tailwind classes for the jurisdiction-evidence pill. Green
 * means "explicitly stated in the contract", amber means "inferred from
 * addresses/language/currency", gray means "could not determine".
 */
function pillClassFor(sourceType: "stated" | "inferred" | "unknown"): string {
  if (sourceType === "stated") {
    return "bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
  }
  if (sourceType === "inferred") {
    return "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
  }
  return "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
}

/** Renders structured contract metadata at the top of the report. */
export function ContractOverview({ overview, labels }: ContractOverviewProps) {
  const { rehydrate } = useRehydrate();
  const resolvedLabels = labels ?? deriveLabels(overview);

  const details: string[] = [];
  if (overview.effective_date) details.push(`Effective: ${overview.effective_date}`);
  if (overview.duration) details.push(`Duration: ${overview.duration}`);
  if (overview.total_value) details.push(`Value: ${overview.total_value}`);

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

      {overview.jurisdiction_evidence && (
        <p className="mb-3.5 text-[15px] text-[var(--text-secondary)] font-[var(--font-body)]">
          Jurisdiction: {overview.governing_jurisdiction ?? "—"}
          <span
            data-testid="jurisdiction-pill"
            title={overview.jurisdiction_evidence.source_text ?? undefined}
            className={`ml-2 inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[1px] ${pillClassFor(overview.jurisdiction_evidence.source_type)}`}
          >
            {overview.jurisdiction_evidence.source_type}
          </span>
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
