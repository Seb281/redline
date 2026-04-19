/**
 * Canonical list of every third-party data flow Redline touches.
 *
 * Single source of truth for the `/data-residency` page. Update this
 * file whenever a new processor is added, removed, or moved regions —
 * the page and its tests derive from here so nothing can drift.
 *
 * Field semantics:
 * - `provider` — the legal entity processing the data.
 * - `purpose` — one sentence, user-facing, no jargon.
 * - `dataCategories` — what actually flows (e.g. "redacted contract
 *   text"). Keep these specific enough to be auditable; if a category
 *   is "personal data" that's a signal to split it.
 * - `region` — free text including city + country. "EU — Paris,
 *   France", not just "EU".
 * - `legalBasis` — GDPR Art. 6 basis, quoted verbatim where possible.
 * - `group` — `"default"` flows happen on every request in the
 *   out-of-the-box config. `"optional"` flows only happen when a
 *   specific feature (DB auth, magic-link email, OpenAI rollback) is
 *   enabled by the operator. Grouping lets the page lead with the
 *   EU-only default story.
 * - `privacyPolicyUrl` — always populated.
 * - `dpaUrl` — optional; include when the provider publishes one.
 * - `notes` — free-form caveats, e.g. activation flags.
 */

export type DataFlowGroup = "default" | "optional";

export interface DataFlow {
  provider: string;
  purpose: string;
  dataCategories: string[];
  region: string;
  legalBasis: string;
  group: DataFlowGroup;
  privacyPolicyUrl: string;
  dpaUrl?: string;
  notes?: string;
}

export const DATA_FLOWS: DataFlow[] = [
  {
    provider: "Mistral AI",
    purpose:
      "LLM contract analysis — overview, clause extraction, risk assessment, chat responses.",
    dataCategories: [
      "Pattern-redacted contract text (PII replaced with ⟦KIND_N⟧ tokens before leaving the browser)",
    ],
    region: "EU — Paris, France",
    legalBasis: "GDPR Art. 6(1)(b) — performance of a contract",
    group: "default",
    privacyPolicyUrl: "https://mistral.ai/terms/#privacy-policy",
    dpaUrl: "https://mistral.ai/terms/#data-processing-agreement",
    notes:
      "Default LLM provider. Model pinned to mistral-small-latest (snapshot mistral-small-2603). Mistral La Plateforme runs in the EU, no transfer outside the EU/EEA for the analysis step.",
  },
  {
    provider: "Vercel",
    purpose: "Frontend hosting and edge delivery of the Next.js app.",
    dataCategories: [
      "HTTP request metadata (IP, user-agent) for the duration of the request",
    ],
    region: "Global edge network — requests served from the nearest region",
    legalBasis: "GDPR Art. 6(1)(f) — legitimate interest (site delivery)",
    group: "default",
    privacyPolicyUrl: "https://vercel.com/legal/privacy-policy",
    dpaUrl: "https://vercel.com/legal/dpa",
    notes:
      "Edge hosting only. Contract text is never persisted by Vercel — analysis calls are forwarded to Mistral and responses stream back through the same request.",
  },
  {
    provider: "Railway",
    purpose: "Backend hosting (FastAPI) for file upload, OCR, and PDF export.",
    dataCategories: [
      "Uploaded contract files during processing",
      "Extracted contract text before redaction (server-side parser only)",
    ],
    region: "EU West — Amsterdam, Netherlands",
    legalBasis: "GDPR Art. 6(1)(b) — performance of a contract",
    group: "default",
    privacyPolicyUrl: "https://railway.com/legal/privacy",
    dpaUrl: "https://railway.com/legal/dpa",
    notes:
      "Contract text is held in memory during the upload → parse → return cycle and then discarded. Not logged, not stored on disk beyond the request lifecycle.",
  },
  {
    provider: "OpenAI",
    purpose: "Rollback LLM provider — only active when LLM_PROVIDER=openai.",
    dataCategories: [
      "Pattern-redacted contract text (same shape as the Mistral flow)",
    ],
    region: "United States",
    legalBasis: "GDPR Art. 6(1)(b) — performance of a contract",
    group: "optional",
    privacyPolicyUrl: "https://openai.com/policies/row-privacy-policy/",
    dpaUrl: "https://openai.com/policies/data-processing-addendum/",
    notes:
      "Inactive by default. Only enabled by the operator during a Mistral incident. International transfer relies on OpenAI's Standard Contractual Clauses (SCCs).",
  },
  {
    provider: "Neon",
    purpose:
      "Managed Postgres for saved analyses, magic-link sessions, and clause embeddings.",
    dataCategories: [
      "User email (if you sign in)",
      "Saved analyses and their provenance metadata",
      "Session identifiers",
    ],
    region: "EU — Frankfurt, Germany",
    legalBasis:
      "GDPR Art. 6(1)(b) — performance of a contract (for saved analyses) and Art. 6(1)(f) — legitimate interest (for session management)",
    group: "optional",
    privacyPolicyUrl: "https://neon.com/privacy-policy",
    dpaUrl: "https://neon.com/dpa",
    notes:
      "Only used when the backend DATABASE_URL env var is set. In the zero-backend-state configuration Redline runs without Neon and no personal data is persisted. Saved analyses are auto-deleted after 30 days (SP-5 retention) unless the user pins them.",
  },
  {
    provider: "Resend",
    purpose: "Transactional email — magic-link sign-in.",
    dataCategories: ["User email address", "One-time sign-in link"],
    region: "EU — Ireland",
    legalBasis: "GDPR Art. 6(1)(b) — performance of a contract",
    group: "optional",
    privacyPolicyUrl: "https://resend.com/legal/privacy-policy",
    dpaUrl: "https://resend.com/legal/dpa",
    notes:
      "Only used when the backend RESEND_API_KEY env var is set. Email addresses are sent to Resend solely to deliver the sign-in link and not used for marketing.",
  },
];
