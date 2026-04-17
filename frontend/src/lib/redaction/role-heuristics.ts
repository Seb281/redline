/**
 * Role-label normalization + heuristic mapping for SP-1.9.
 *
 * Pass 0 returns party names plus an optional defined term ("Provider",
 * "Tenant") extracted from the preamble. `normalizeLabel` turns any user
 * or LLM string into the canonical token form `[A-Z0-9_]{1,20}`.
 * `heuristicLabels` fills missing labels from `contract_type`.
 * `disambiguateLabels` appends `_2`, `_3`, … to collisions.
 */

const MAX_LABEL_LEN = 20;

/** Canonicalize a label string. Returns "" if nothing usable remains. */
export function normalizeLabel(raw: string): string {
  if (!raw) return "";
  const ascii = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const upper = ascii.toUpperCase();
  const replaced = upper.replace(/[^A-Z0-9]+/g, "_");
  const trimmed = replaced.replace(/^_+|_+$/g, "");
  return trimmed.slice(0, MAX_LABEL_LEN);
}
