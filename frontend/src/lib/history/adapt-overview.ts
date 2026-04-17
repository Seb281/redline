/**
 * Coerce an overview to the SP-1.9 label-aware shape.
 *
 * Live runs hand editable labels down from the streaming state. Saved
 * analyses persisted before SP-1.9 (or before the user edited anything)
 * have only {@link Party} objects on the overview — no parallel label
 * array — so call this helper to derive a plausible label set from the
 * party's own `role_label` (preferred) with a heuristic fallback by
 * `contract_type`. `disambiguateLabels` then handles duplicates.
 *
 * Used by history pages and by `ContractOverview` when no explicit
 * `labels` prop is provided.
 */

import type { ContractOverview, Party } from "@/types";
import {
  disambiguateLabels,
  heuristicLabels,
  normalizeLabel,
} from "@/lib/redaction/role-heuristics";

/** Derive canonical labels from an overview's parties + contract_type. */
export function deriveLabels(overview: ContractOverview): string[] {
  const heuristics = heuristicLabels(overview.contract_type, overview.parties.length);
  const raw = overview.parties.map((party, i) => {
    if (party.role_label) {
      const norm = normalizeLabel(party.role_label);
      if (norm) return norm;
    }
    return heuristics[i] ?? "";
  });
  return disambiguateLabels(raw);
}

type LegacyParty = string | Party;

/**
 * Handle historical rows that persisted `parties: string[]` before
 * SP-1.9. Converts them into the new `{name, role_label: null}` shape
 * and returns the derived labels.
 */
export function adaptHistoricalOverview(raw: {
  contract_type: string;
  parties: LegacyParty[];
} & Omit<ContractOverview, "parties">): {
  overview: ContractOverview;
  labels: string[];
} {
  const parties: Party[] = raw.parties.map((p) =>
    typeof p === "string" ? { name: p, role_label: null } : p,
  );
  const overview: ContractOverview = { ...raw, parties };
  return { overview, labels: deriveLabels(overview) };
}
