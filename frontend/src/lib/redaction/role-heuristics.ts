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

interface HeuristicRow {
  keywords: string[];
  first: string;
  second: string;
}

const HEURISTICS: HeuristicRow[] = [
  { keywords: ["employment", "labor"], first: "EMPLOYER", second: "EMPLOYEE" },
  { keywords: ["lease", "tenancy", "rental"], first: "LANDLORD", second: "TENANT" },
  { keywords: ["purchase", "sale"], first: "SELLER", second: "BUYER" },
  { keywords: ["license", "licensing"], first: "LICENSOR", second: "LICENSEE" },
  { keywords: ["loan", "credit"], first: "LENDER", second: "BORROWER" },
  {
    keywords: ["nda", "non-disclosure", "confidentiality"],
    first: "DISCLOSING_PARTY",
    second: "RECEIVING_PARTY",
  },
  {
    keywords: ["service", "consulting", "freelance", "msa"],
    first: "PROVIDER",
    second: "CLIENT",
  },
];

const POSITIONAL = ["PARTY_A", "PARTY_B", "PARTY_C", "PARTY_D", "PARTY_E", "PARTY_F", "PARTY_G", "PARTY_H"];

/**
 * Return an array of `n` canonical labels based on `contract_type`.
 * Parties 0 and 1 get semantic labels when a keyword matches; parties
 * 2+ always fall back to positional PARTY_C/D/... because heuristics
 * cannot guess a third role (joint ventures are rare and ambiguous).
 */
export function heuristicLabels(contractType: string, n: number): string[] {
  const lower = (contractType || "").toLowerCase();
  const match = HEURISTICS.find((row) =>
    row.keywords.some((kw) => lower.includes(kw)),
  );
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) out.push(match ? match.first : POSITIONAL[0]);
    else if (i === 1) out.push(match ? match.second : POSITIONAL[1]);
    else out.push(POSITIONAL[Math.min(i, POSITIONAL.length - 1)]);
  }
  return out;
}

/**
 * Append `_2`, `_3`, … to labels that repeat earlier entries. First
 * occurrence keeps its base form; empties are passed through unchanged.
 */
export function disambiguateLabels(labels: string[]): string[] {
  const counts = new Map<string, number>();
  const out: string[] = [];
  for (const label of labels) {
    if (!label) {
      out.push(label);
      continue;
    }
    const seen = counts.get(label) ?? 0;
    out.push(seen === 0 ? label : `${label}_${seen + 1}`);
    counts.set(label, seen + 1);
  }
  return out;
}
