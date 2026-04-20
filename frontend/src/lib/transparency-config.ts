/**
 * SP-9 — AI Act transparency artifact config.
 *
 * Single source of truth for the `/transparency` page and the
 * machine-readable transparency receipt. Declares four things:
 *
 *   1. Which AI Act articles apply to Redline and how the product
 *      surfaces them.
 *   2. The pipeline steps (Pass 0 → redaction → Pass 1 → Pass 2 →
 *      chat) the LLM traverses for every analysis.
 *   3. Operator rollback levers (env vars the deployer can flip
 *      without a redeploy) so the transparency story survives real
 *      incident response.
 *   4. Known limitations the user should understand before acting on
 *      the analysis — hallucination, statute-shortlist gaps, the
 *      explicit "informational only, not legal advice" caveat.
 *
 * The page pulls rendered strings from `messages/<locale>.json
 * → Transparency`. The config below carries stable identifiers
 * (`translationKey`) and factual data that does not translate
 * (article numbers, env-var names). Mirror of `data-flows.ts` — same
 * split between config + i18n catalog.
 *
 * Changing this file:
 *   - Adding a new AI Act article, pipeline step, lever, or
 *     limitation: append it here AND add the matching
 *     `Transparency.{group}.{translationKey}` entry to
 *     `messages/en.json`. Re-seed the other locales with
 *     `scripts/deepl-seed.mjs`.
 *   - Bumping the receipt schema: update
 *     `TRANSPARENCY_RECEIPT_SCHEMA_VERSION` in `analyzer.ts` AND the
 *     Pydantic mirror in `backend/app/schemas.py`.
 */

/**
 * AI Act article that Redline explicitly addresses. `surface` names
 * the concrete product surface that demonstrates compliance (the page
 * or component a reader can check).
 */
export interface AiActArticleEntry {
  /** Article reference, e.g. "Art. 13". */
  reference: string;
  /** Stable slug for the i18n key. */
  translationKey: string;
  /** User-facing surface where compliance is demonstrable. */
  surface: string;
}

/**
 * Pipeline step the LLM pipeline traverses for every analysis. The
 * `/transparency` page renders these as an SVG diagram; the receipt
 * serialises the same list.
 */
export interface PipelineStepEntry {
  /** Stable slug for the i18n key and the receipt. */
  translationKey: string;
  /** Short label rendered on the SVG node (translated). */
  label: string;
  /**
   * True when the step is an LLM call (billed, round-tripped to the
   * Paris region). False for client-side steps (redaction, export).
   */
  isLlmCall: boolean;
}

/**
 * Operator lever — an env var a deployer can flip at runtime without a
 * redeploy. Surfaced on the transparency page so readers understand
 * which behaviours are configurable post-ship vs baked in.
 */
export interface OperatorLeverEntry {
  /** Stable slug for the i18n key. */
  translationKey: string;
  /** Env-var name, verbatim. */
  envVar: string;
  /** Default value in production, or null when none is set. */
  defaultValue: string | null;
}

/**
 * Known limitation the user should factor in when reading an analysis.
 */
export interface LimitationEntry {
  translationKey: string;
}

/**
 * Canonical list of AI Act articles Redline addresses. Art 13
 * (transparency to users of high-risk systems) and Art 50 (disclosure
 * of AI-generated output) are the relevant ones for a deployer of a
 * generative-AI legal-tech tool.
 */
export const AI_ACT_ARTICLES: AiActArticleEntry[] = [
  {
    reference: "Art. 13",
    translationKey: "art13",
    surface: "/transparency, AnalysisFooter",
  },
  {
    reference: "Art. 50",
    translationKey: "art50",
    surface: "Disclaimer banner, AnalysisFooter",
  },
];

/**
 * Canonical pipeline. Order matters — the SVG renderer follows the
 * array sequence.
 */
export const PIPELINE_STEPS: PipelineStepEntry[] = [
  { translationKey: "pass0", label: "Pass 0 · overview", isLlmCall: true },
  { translationKey: "redaction", label: "Redaction", isLlmCall: false },
  { translationKey: "pass1", label: "Pass 1 · extraction", isLlmCall: true },
  { translationKey: "pass2", label: "Pass 2 · risk", isLlmCall: true },
  { translationKey: "chat", label: "Chat (optional)", isLlmCall: true },
];

/**
 * Canonical operator rollback levers. Only includes env vars that
 * change observable behaviour in a way a reader of a saved analysis
 * might care about.
 */
export const OPERATOR_LEVERS: OperatorLeverEntry[] = [
  {
    translationKey: "analysisLocaleOverride",
    envVar: "ANALYSIS_LOCALE_OVERRIDE",
    defaultValue: null,
  },
  {
    translationKey: "pass2RetryEnabled",
    envVar: "PASS2_RETRY_ENABLED",
    defaultValue: "true",
  },
  {
    translationKey: "retentionDays",
    envVar: "RETENTION_DAYS",
    defaultValue: "30",
  },
];

/**
 * Canonical limitations the transparency page enumerates. Each key
 * resolves to a plain-English paragraph under
 * `Transparency.limitations.{translationKey}`.
 */
export const LIMITATIONS: LimitationEntry[] = [
  { translationKey: "hallucination" },
  { translationKey: "statuteShortlistGaps" },
  { translationKey: "notLegalAdvice" },
  { translationKey: "languageCoverage" },
];
