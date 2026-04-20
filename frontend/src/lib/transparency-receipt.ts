/**
 * SP-9 — Machine-readable transparency receipt for a single analysis.
 *
 * The receipt is a small, stable JSON document that serialises the
 * provenance block together with the canonical pipeline, the operator
 * levers active in the deployment, and the AI Act article references
 * the product addresses. Users can download it next to the human-
 * readable report; auditors can diff receipts across releases via the
 * `schema_version` field.
 *
 * Two build paths:
 *   - `buildReceipt(data)` — pure, client-side. Used for anonymous
 *     sessions (no backend dependency) and as the source-of-truth
 *     shape the backend endpoint mirrors.
 *   - `GET /api/analyses/{id}/receipt` — backend endpoint that
 *     reconstitutes the same shape from stored provenance. Implemented
 *     in `backend/app/routers/analyses.py`.
 *
 * Privacy: the receipt deliberately does NOT include the contract
 * text, clause text, the user's email, or any analysis prose. It is
 * metadata about the analysis run, not a copy of the output.
 */

import {
  AI_ACT_ARTICLES,
  LIMITATIONS,
  OPERATOR_LEVERS,
  PIPELINE_STEPS,
} from "@/lib/transparency-config";
import type { AnalysisProvenance, AnalyzeResponse } from "@/types";

/**
 * Stable JSON shape written by every `buildReceipt()` call. Versioned
 * via `schema_version`; the first release is `"1"`.
 */
export interface TransparencyReceipt {
  /**
   * Fully-qualified kind discriminator. Lets a consumer tell a Redline
   * transparency receipt apart from any other JSON blob without a
   * Content-Type header.
   */
  kind: "redline.transparency.receipt";
  /** Version of this JSON shape. */
  schema_version: string;
  /** ISO-8601 timestamp of when the receipt was produced. */
  generated_at: string;
  /**
   * Short, human-readable summary of the analysis the receipt is
   * attached to. Does not include contract text.
   */
  analysis: {
    /** The saved-analysis id when the receipt was fetched from the
     * backend; `null` for anonymous sessions that never saved. */
    id: string | null;
    /** The original upload filename, echoed back for identification. */
    filename: string | null;
    /** Number of clauses produced by Pass 2. */
    clause_count: number;
    /** Locale the analysis prose was emitted in. `null` on legacy rows. */
    analysis_locale: string | null;
  };
  /** Full provenance block (provider, model, snapshot, region, etc.). */
  provenance: AnalysisProvenance;
  /** Canonical LLM pipeline the analysis traversed. */
  pipeline: ReadonlyArray<{
    key: string;
    label: string;
    is_llm_call: boolean;
  }>;
  /** AI Act article references the product addresses. */
  ai_act_articles: ReadonlyArray<{
    reference: string;
    key: string;
    surface: string;
  }>;
  /** Operator rollback levers active at build time. */
  operator_levers: ReadonlyArray<{
    key: string;
    env_var: string;
    default_value: string | null;
  }>;
  /** Known limitations the user should factor in. */
  limitations: ReadonlyArray<{ key: string }>;
}

/**
 * Build a transparency receipt for the current analysis. Pure —
 * synchronous, no I/O. Callable from any browser session, including
 * anonymous users who never saved the analysis.
 *
 * @param data — the full `AnalyzeResponse` as rendered in `ReportView`.
 * @param opts.id — optional saved-analysis id. Omit for anonymous flows.
 * @param opts.filename — original upload filename, surfaced for
 *                         identification.
 */
export function buildReceipt(
  data: AnalyzeResponse,
  opts: { id?: string | null; filename?: string | null } = {},
): TransparencyReceipt {
  const provenance = data.provenance;
  const schemaVersion = provenance.schema_version ?? "1";
  return {
    kind: "redline.transparency.receipt",
    schema_version: schemaVersion,
    generated_at: new Date().toISOString(),
    analysis: {
      id: opts.id ?? null,
      filename: opts.filename ?? null,
      clause_count: data.clauses.length,
      analysis_locale: provenance.analysis_locale ?? null,
    },
    provenance,
    pipeline: PIPELINE_STEPS.map((step) => ({
      key: step.translationKey,
      label: step.label,
      is_llm_call: step.isLlmCall,
    })),
    ai_act_articles: AI_ACT_ARTICLES.map((a) => ({
      reference: a.reference,
      key: a.translationKey,
      surface: a.surface,
    })),
    operator_levers: OPERATOR_LEVERS.map((lever) => ({
      key: lever.translationKey,
      env_var: lever.envVar,
      default_value: lever.defaultValue,
    })),
    limitations: LIMITATIONS.map((l) => ({ key: l.translationKey })),
  };
}

/**
 * Trigger a browser download of the receipt as a JSON file. Kept
 * separate from `buildReceipt` so the pure builder stays unit-testable
 * in a non-DOM environment.
 *
 * Filename convention: `redline-receipt-{filename-stem}-{YYYYMMDD}.json`,
 * falling back to a bare date when no filename is available.
 */
export function downloadReceipt(receipt: TransparencyReceipt): void {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = receiptFilename(receipt);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Compose the download filename from the receipt metadata. */
export function receiptFilename(receipt: TransparencyReceipt): string {
  const stem = filenameStem(receipt.analysis.filename);
  const date = receipt.generated_at.slice(0, 10).replace(/-/g, "");
  return stem
    ? `redline-receipt-${stem}-${date}.json`
    : `redline-receipt-${date}.json`;
}

/**
 * Strip the file extension and sanitise the stem for use in a
 * filename. Keeps the first 40 chars so long uploads don't produce
 * unwieldy download names.
 */
function filenameStem(filename: string | null): string {
  if (!filename) return "";
  const noExt = filename.replace(/\.[a-z0-9]+$/i, "");
  const safe = noExt.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
  return safe.slice(0, 40).replace(/^-|-$/g, "");
}
