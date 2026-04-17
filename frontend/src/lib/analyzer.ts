/**
 * LLM pipeline orchestration using Vercel AI SDK.
 *
 * Provider selection is delegated to `lib/llm/provider.ts`. Each pipeline
 * pass calls `provider.model(effort)` rather than importing a model
 * directly — that keeps prompt/schema code provider-agnostic.
 *
 * Reasoning effort per pass (validated in spec):
 *   - Pass 0 (overview):   "low"
 *   - Pass 1 (extraction): "medium"
 *   - Pass 2 (risk):       "high"
 *   - Think Hard fan-out:  "high"
 */

import { generateObject } from "ai";
import { z } from "zod";
import type { AnalysisProvenance, AnalyzeResponse, AnalysisMode, JurisdictionEvidence } from "@/types";
import { getProvider, type LLMProvider, type ReasoningEffort } from "@/lib/llm/provider";
import { logPass } from "@/lib/llm/debug-log";
import { STATUTE_CODES, STATUTE_LABELS } from "@/lib/applicable-law";

// ---------------------------------------------------------------------------
// Zod schemas for structured LLM output
// ---------------------------------------------------------------------------

export const extractedClauseSchema = z.object({
  clause_text: z
    .string()
    .describe("Exact original text of the clause — do not paraphrase"),
  section_reference: z
    .string()
    .nullable()
    .describe("Section number if identifiable, e.g. 'Section 3.1'"),
});

export const extractionResultSchema = z.object({
  clauses: z.array(extractedClauseSchema),
});

export const clauseInventoryItemSchema = z.object({
  title: z
    .string()
    .describe("Short descriptive title of the clause, 3-6 words"),
  section_ref: z
    .string()
    .nullable()
    .describe("Section number if identifiable, e.g. 'Section 3.1'"),
});

export const partySchema = z.object({
  name: z
    .string()
    .describe("Full legal name of the party exactly as written in the preamble"),
  role_label: z
    .string()
    .nullable()
    .describe(
      "Defined term introduced for this party in the preamble (e.g. 'Provider', 'Tenant'). " +
      "Look for constructions like 'hereinafter the Provider', '(the \"Provider\")', or " +
      "'referred to as Provider'. Return null if the contract introduces no defined term.",
    ),
});

export const contractOverviewSchema = z.object({
  contract_type: z
    .string()
    .describe("Type of contract, e.g. 'Freelance Services Agreement'"),
  parties: z
    .array(partySchema)
    .describe("Parties to the contract, in the order they appear in the preamble"),
  effective_date: z.string().nullable().describe("Effective or start date if stated"),
  duration: z.string().nullable().describe("Contract duration if stated, e.g. '12 months'"),
  total_value: z.string().nullable().describe("Total contract value if stated, e.g. '$120,000'"),
  governing_jurisdiction: z.string().nullable().describe("Governing law jurisdiction if stated"),
  jurisdiction_evidence: z
    .object({
      source_type: z.enum(["stated", "inferred", "unknown"]),
      source_text: z.string().nullable(),
    })
    .describe(
      "SP-1.7 — how the model determined governing_jurisdiction. " +
        "unknown ⇔ governing_jurisdiction is null.",
    ),
  key_terms: z
    .array(z.string())
    .describe("3-5 most important terms, one sentence each, plain English"),
  clause_inventory: z
    .array(clauseInventoryItemSchema)
    .describe("Every distinct clause in the contract — substantive and boilerplate alike"),
});

export const clauseCategoryEnum = z.enum([
  "non_compete",
  "liability",
  "termination",
  "ip_assignment",
  "confidentiality",
  "governing_law",
  "indemnification",
  "data_protection",
  "payment_terms",
  "limitation_of_liability",
  "force_majeure",
  "dispute_resolution",
  "other",
]);

export const analyzedClauseSchema = z.object({
  clause_text: z.string().describe("Original clause text"),
  category: clauseCategoryEnum,
  title: z.string().describe("Short descriptive title, 3-6 words"),
  plain_english: z
    .string()
    .describe("Plain-English explanation, 1-2 sentences, no legal jargon"),
  risk_level: z.enum(["informational", "low", "medium", "high"]),
  risk_explanation: z
    .string()
    .describe("Why this risk level — what makes it risky or safe"),
  negotiation_suggestion: z
    .string()
    .nullable()
    .describe("Suggestion for medium/high risk. Null for low and informational risk."),
  is_unusual: z
    .boolean()
    .describe("True if this clause deviates from standard contract norms"),
  unusual_explanation: z
    .string()
    .nullable()
    .describe("What is atypical and why it matters. Null if not unusual."),
  applicable_law: z
    .object({
      observation: z.string().min(1),
      source_type: z.enum(["statute_cited", "general_principle"]),
      citations: z.array(
        z.object({
          code: z.enum(STATUTE_CODES),
        }),
      ),
    })
    .nullable()
    .superRefine((val, ctx) => {
      if (val === null) return;
      if (val.source_type === "statute_cited" && val.citations.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "statute_cited requires at least one citation",
        });
      }
      if (val.source_type === "general_principle" && val.citations.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "general_principle requires citations to be empty",
        });
      }
    })
    .describe(
      "Structured legal grounding for this clause, or null when no canonical " +
        "statute applies and there is no general principle worth flagging.",
    ),
  // Required (not optional) because OpenAI's strict structured-output mode
  // forces every property into `required`. Emit an empty array when no
  // factual claim has verbatim support.
  citations: z
    .array(
      z.object({
        id: z.number().int().min(1).describe("1-based marker id in plain_english"),
        quoted_text: z
          .string()
          .min(1)
          .describe(
            "Exact verbatim phrase from clause_text — copy-paste, do not paraphrase",
          ),
      }),
    )
    .describe(
      "Citations for [^N] markers in plain_english. Empty array if no verbatim quote supports any claim.",
    ),
});

export const batchAnalysisSchema = z.object({
  clauses: z.array(analyzedClauseSchema),
});

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

export const EXTRACTION_SYSTEM_PROMPT = `\
You are a legal document analyzer. Your task is to extract the exact text of \
every clause listed in the provided clause inventory.

Rules:
- You will receive a numbered clause inventory (titles + section references) \
  followed by the full contract text.
- For EACH inventory item, extract the exact original text — do not paraphrase \
  or summarize.
- Include the section reference (e.g., "Section 8.2") when identifiable from \
  the text.
- If a clause spans multiple paragraphs, include the full text as one clause.
- Return exactly one extracted clause per inventory item, in the same order.
- Do NOT skip any inventory item and do NOT add clauses not in the inventory.`;

const CATEGORIES = [
  "non_compete",
  "liability",
  "termination",
  "ip_assignment",
  "confidentiality",
  "governing_law",
  "indemnification",
  "data_protection",
  "payment_terms",
  "limitation_of_liability",
  "force_majeure",
  "dispute_resolution",
  "other",
].join(", ");

/**
 * Build the analysis system prompt.
 *
 * When `withCitations` is true, the model is instructed to emit inline
 * `[^N]` markers and a populated `citations` array for every clause. When
 * false, it must always emit `citations: []` and no markers — the schema
 * field remains required (OpenAI strict mode demands it) but stays empty,
 * which skips the downstream rendering of the footnote UI.
 *
 * When `userRole` is a non-empty string, the analyst is instructed to frame
 * risk from that party's perspective (e.g. "Tenant", "Landlord", "ACME
 * Corp"). When empty/undefined, we fall back to the default weaker-party
 * framing — the historical behavior and Redline's primary use case.
 */
export function buildAnalysisSystemPrompt(
  withCitations: boolean,
  userRole?: string | null,
  jurisdiction?: string | null,
  jurisdictionEvidence?: JurisdictionEvidence | null,
): string {
  const citationsSection = withCitations
    ? `\
Citations (for every clause):
- Insert inline markers [^1], [^2], etc. in \`plain_english\` after each \
  factual claim that quotes or paraphrases the clause, and add a matching \
  entry in the \`citations\` array with the EXACT verbatim phrase from the \
  clause — copy-paste, do not paraphrase.
- Use the shortest phrase that fully supports the claim.
- If no verbatim phrase supports a claim, omit BOTH the marker and the \
  citation for it. Never fabricate.
- \`citations\` is always required: return an empty array if no verbatim \
  phrase supports any claim in a given clause.`
    : `\
Citations (disabled for this run):
- Always emit \`citations: []\` (an empty array).
- Do NOT insert any [^N] markers in \`plain_english\`.
- The \`citations\` field is still required by the schema — just leave it empty.`;

  const jurisdictionSection = (() => {
    if (!jurisdictionEvidence || jurisdictionEvidence.source_type === "unknown") {
      return `\
Applicable law (jurisdiction unknown):
Jurisdiction is unknown. Emit applicable_law: null for EVERY clause. No \
exceptions. Do not speculate.`;
    }

    const whitelist = STATUTE_CODES.map(
      (code) => `- ${code}: ${STATUTE_LABELS[code]}`,
    ).join("\n");

    const juris = jurisdiction ?? "the stated jurisdiction";
    return `\
Applicable law (${juris}):
For each clause, emit applicable_law: null UNLESS a canonical statute from \
the list below applies to that specific clause.

Whitelist (code — canonical label):
${whitelist}

Applicability guidance:
- DE_BGB_276: liability exclusion covering gross negligence or intentional misconduct.
- DE_ARBNERFG: broad IP-assignment clause conflicting with employee invention rights.
- DE_KARENZENTSCHAEDIGUNG: German non-compete lacking paid Karenzentschädigung compensation.
- NL_BW_7_650: Dutch non-compete lacking written form or clear scope.
- NL_BW_7_653: Dutch non-compete of questionable validity (scope, duration, compensation).
- FR_CODE_TRAVAIL_NONCOMPETE: French non-compete without contrepartie financière.
- EU_GDPR: data-protection clause waiving data subject rights or conflicting with Regulation 2016/679.
- EU_DIR_93_13_EEC: markedly one-sided clause (consumer, sometimes B2B per national implementation).

Emission rules:
- When a whitelist statute applies: set applicable_law.source_type="statute_cited"; \
populate citations with one or more entries where code EXACTLY matches an enum value \
above (the human-readable label is rendered client-side from a canonical map; emit code only); \
set observation to a one-line note explaining the concern for a non-lawyer.
- When a jurisdiction-specific issue is real but no enum code fits: set \
source_type="general_principle" with citations=[]; state the principle in observation. \
Do NOT invent codes outside the list above.
- For all other clauses (the common case): return applicable_law=null.`;
  })();

  const trimmedRole = userRole?.trim();
  const perspectiveLine = trimmedRole
    ? `You assess contract clauses from the perspective of ${trimmedRole}. \
This is the party the user represents in this contract — frame every risk, \
explanation, and negotiation suggestion from their side, and name them \
explicitly when it helps clarity.`
    : `You assess contract clauses from the perspective of the weaker/\
non-drafting party — the freelancer, employee, or smaller company.`;

  return `\
You are a legal risk analyst. ${perspectiveLine}

For each clause, provide:
1. A category from: ${CATEGORIES}
2. A short descriptive title (3-6 words)
3. A plain-English explanation (1-2 sentences, no legal jargon)
4. A risk level: informational, low, medium, or high
5. A specific risk explanation — why this level, what makes it risky or safe
6. A negotiation suggestion — ONLY for medium and high risk clauses. \
   Set to null for low and informational risk.

Risk calibration:
- informational: Standard boilerplate, procedural terms, definitions, or \
  administrative clauses with no meaningful risk to either party. Examples: \
  notice provisions, amendment procedures, counterparts, severability, \
  entire-agreement clauses.
- non_compete: >12 months or nationwide/continental scope = high; \
  6-12 months local = medium; <6 months limited = low
- liability: unlimited liability = high; capped at contract value = medium; \
  reasonable caps with exclusions = low
- ip_assignment: covers pre-existing IP or work outside scope = high; \
  limited to deliverables created during engagement = low
- termination: no termination right or >90 days notice = high; \
  30-90 days = medium; <30 days mutual = low
- payment_terms: >60 days or no late payment provisions = high; \
  30-60 days = medium; <30 days with penalties = low
- indemnification: broad/uncapped indemnification by one party = high; \
  mutual and capped = low
- confidentiality: >5 years or perpetual with broad scope = high; \
  2-5 years reasonable scope = medium; standard NDA terms = low
- limitation_of_liability: excludes gross negligence/willful misconduct = high; \
  standard exclusions = low
- For other categories: assess how much the clause restricts the weaker party's \
  rights or creates asymmetric obligations. Use informational for purely \
  procedural or administrative clauses.
7. Whether this clause is unusual compared to standard contracts of this type. \
   A clause is unusual if its terms, scope, duration, or obligations deviate \
   significantly from what is typical for its category.
8. If unusual, a brief explanation of what specifically is atypical and why it \
   matters. Set to null if the clause is not unusual.

${jurisdictionSection}

${citationsSection}`;
}

/**
 * @deprecated Retained for backwards compatibility — prefer
 * {@link buildAnalysisSystemPrompt}. Defaults to citations enabled.
 */
export const ANALYSIS_SYSTEM_PROMPT = buildAnalysisSystemPrompt(true);

export const OVERVIEW_SYSTEM_PROMPT = `\
You are a legal document analyst. Your task is to extract high-level metadata \
from a contract AND inventory every distinct clause it contains.

Rules:
- Extract only what is explicitly stated in the text. Do not infer or guess.
- If a field is not clearly stated, set it to null.
- For key_terms, list 3-5 of the most important substantive terms — the things \
  someone would want to know before reading the full contract.
- Keep key_terms concise: one sentence each, plain English, no legal jargon.

Parties — defined-term extraction:
- For each party, capture the full legal name exactly as written in the preamble.
- Also capture the defined term the contract uses to refer to that party \
  throughout (role_label). Look for explicit introductions like:
    "Acme Corp (hereinafter the \"Provider\")"
    "Beta Ltd., referred to as the Client"
    "XYZ B.V. (the \"Licensor\")"
- role_label must be a single noun or short noun phrase as written in the \
  contract ("Provider", "Service Provider", "Landlord"), not a description.
- If the contract does NOT introduce a defined term for a party, set role_label \
  to null. Do not invent one.
- List parties in the order they appear in the preamble.

Clause inventory — critical rules:
- List only TOP-LEVEL contract clauses (the numbered sections, articles, or \
  equivalent headings you would cite when referring to the clause).
- Do NOT split a clause into multiple entries for its sub-sections, numbered \
  sub-items, lettered sub-items, or bullet lists. Sub-parts of the same \
  top-level clause are ONE inventory entry.
- Do NOT list individual definitions. If the contract has a "Definitions" \
  section, emit that section as ONE inventory entry — not one entry per term.
- Do NOT list recitals, signature blocks, or schedules as separate clauses \
  unless they function as substantive clauses in their own right.
- Typical well-drafted commercial contracts have 10-30 top-level clauses. If \
  your inventory has more than ~30 entries, you are almost certainly \
  over-segmenting — consolidate sub-items into their parent clause.
- Give each clause a short descriptive title (3-6 words).
- Include the section reference (e.g. "Section 3.1") when identifiable.
- Order clauses as they appear in the document.

Jurisdiction evidence:
After identifying governing_jurisdiction, emit jurisdiction_evidence:
- Set source_type="stated" when the contract has an explicit governing-law \
  clause. Set source_text to the verbatim phrase or clause reference \
  (e.g., "§14 Governing Law: Netherlands").
- Set source_type="inferred" when no explicit clause but the country is \
  derivable from party addresses, official language, currency, or \
  registered office. Set source_text to a one-line reason (e.g., \
  "Inferred from party addresses in Amsterdam and Utrecht").
- Set source_type="unknown" when neither is possible. Set source_text to \
  null AND set governing_jurisdiction to null.
The two fields must agree: unknown ⇔ null; stated/inferred ⇔ non-null.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format clause inventory as a numbered list for injection into the
 * extraction prompt. Anchors the extraction to specific clauses
 * identified in the overview pass, eliminating non-deterministic
 * "find all clauses" behavior.
 */
export function formatInventoryPrompt(
  inventory: { title: string; section_ref: string | null }[],
): string {
  return inventory
    .map((item, i) => {
      const ref = item.section_ref ? ` (${item.section_ref})` : "";
      return `${i + 1}. ${item.title}${ref}`;
    })
    .join("\n");
}

/**
 * Build the extraction user prompt with inventory and contract text.
 */
export function buildExtractionPrompt(
  text: string,
  inventory: { title: string; section_ref: string | null }[],
): string {
  const inventoryList = formatInventoryPrompt(inventory);
  return `Extract the exact text of each of the following ${inventory.length} clauses from the contract below.\n\nClause inventory:\n${inventoryList}\n\nContract text:\n\n${text}`;
}

/**
 * SP-1.7 — Enforce the contract-level invariant that
 * governing_jurisdiction and jurisdiction_evidence.source_type agree.
 *
 * When the LLM returns a mismatched pair, downgrade to unknown rather
 * than propagating inconsistent state to Pass 2. The orchestrator calls
 * this on every Pass 0 result before threading the evidence downstream.
 */
export function reconcileJurisdiction<
  T extends {
    governing_jurisdiction: string | null;
    jurisdiction_evidence: {
      source_type: "stated" | "inferred" | "unknown";
      source_text: string | null;
    };
  },
>(overview: T): T {
  const { governing_jurisdiction, jurisdiction_evidence } = overview;
  const isUnknown = jurisdiction_evidence.source_type === "unknown";
  if (isUnknown && governing_jurisdiction !== null) {
    return { ...overview, governing_jurisdiction: null };
  }
  if (!isUnknown && governing_jurisdiction === null) {
    return {
      ...overview,
      jurisdiction_evidence: { source_type: "unknown", source_text: null },
    };
  }
  return overview;
}

/**
 * Bumped whenever any pipeline prompt (overview, extraction, analysis,
 * chat) changes in a way that could materially alter model outputs.
 * Part of the AI Act provenance record — auditors use it to correlate
 * stored analyses back to the prompt contract they were produced under.
 */
export const PROMPT_TEMPLATE_VERSION = "1.1";

/**
 * Sentinel `provider` value for the legacy-provenance placeholder. The
 * backend rejects this value on save so a placeholder cannot be
 * persisted as authentic transparency data.
 */
export const LEGACY_PROVENANCE_PROVIDER = "legacy-pre-phase5";

/**
 * Placeholder provenance for analyses persisted before SP-1 Phase 5 —
 * those rows have no stored provenance because the pipeline didn't yet
 * emit it. The `LEGACY_PROVENANCE_PROVIDER` sentinel is specifically
 * rejected by the backend `SaveAnalysisRequest` validator, so this
 * placeholder can satisfy the required type locally while being unable
 * to round-trip into a new DB row as genuine provenance.
 *
 * The `SavedAnalysis` type keeps `provenance` optional for this exact
 * reason (backend rows pre-migration may be missing it). Callers that
 * need a non-null value when reconstructing an `AnalyzeResponse` use
 * this helper as the fallback.
 */
export function legacyProvenance(): AnalysisProvenance {
  return {
    provider: LEGACY_PROVENANCE_PROVIDER,
    model: "legacy",
    snapshot: "legacy",
    region: "legacy",
    reasoning_effort_per_pass: {
      overview: "low",
      extraction: "medium",
      risk: "high",
      think_hard: "high",
    },
    prompt_template_version: "0.0",
    timestamp: new Date(0).toISOString(),
  };
}

/**
 * Assemble the provenance block attached to every analysis result.
 *
 * Reasoning-effort labels record the *policy intent* per pass (low for
 * the cheap overview pass, high for risk/think-hard). The Mistral SDK
 * currently ignores per-call effort overrides (see provider.ts header),
 * so these labels are purely a transparency artifact — they describe
 * what the pipeline *would* request if the SDK honored it.
 *
 * `timestamp` is set at call time (i.e. when the pipeline finishes
 * assembling the final response), not when the request came in, so
 * auditors reading the saved analysis see when it was produced.
 */
export function buildProvenance(provider: LLMProvider): AnalysisProvenance {
  const model = provider.name === "mistral" ? "mistral-small-4" : "gpt-4.1-nano";
  return {
    provider: provider.name,
    model,
    snapshot: provider.snapshot(),
    region: provider.region,
    reasoning_effort_per_pass: {
      overview: "low",
      extraction: "medium",
      risk: "high",
      think_hard: "high",
    },
    prompt_template_version: PROMPT_TEMPLATE_VERSION,
    timestamp: new Date().toISOString(),
    redaction_location: "client",
  };
}

// ---------------------------------------------------------------------------
// Inventory cap — defends Pass 2 from over-segmented overviews
// ---------------------------------------------------------------------------

/**
 * Bytes-of-raw-text per permitted inventory item. Derived empirically from
 * the NL/DE snapshot runs: the collapse case produced 46 items for 8754
 * bytes (~190 bytes/item) and the healthy case produced 24 items for the
 * same text (~365 bytes/item). 400 gives a slightly generous ceiling that
 * cleanly rejects the pathological case while allowing healthy outputs
 * through. See `docs/diagnostics/2026-04-16-nl-freelance-mistral-small.md`.
 */
export const INVENTORY_CAP_BYTES_PER_ITEM = 400;

/**
 * Absolute maximum inventory size regardless of contract length. Protects
 * against pathological output on very long contracts (a 100KB contract
 * would permit 250 items by the per-byte divisor alone, which is almost
 * certainly over-segmented). 40 sits above the realistic ceiling for
 * well-drafted commercial contracts (~30 top-level clauses).
 */
export const INVENTORY_CAP_CEILING = 40;

/**
 * Absolute minimum inventory size. Guards tiny contracts (50–399 chars —
 * above the backend <50 floor but below one full item by the divisor)
 * from being reduced to an empty inventory, which would make Pass 1
 * extraction meaningless.
 */
export const INVENTORY_CAP_FLOOR = 1;

/**
 * Deterministic seed forwarded to Mistral's `random_seed`. Non-zero so
 * behavior is consistent across providers that might treat `0` as
 * "unset" — Mistral itself forwards the literal value unchanged.
 */
export const OVERVIEW_SEED = 1;

/** Shape of a single inventory entry, derived from the overview schema. */
type InventoryItem = z.infer<typeof clauseInventoryItemSchema>;

/**
 * Return a copy of the Pass 0 clause inventory clamped to a defensible
 * upper bound so a pathological overview (46+ entries on a 9KB contract)
 * cannot blow up Pass 2 batch analysis. Pure function — callers are
 * responsible for logging the truncation via the `capped` flag returned
 * alongside the sliced array, so the overview log line stays singular.
 *
 * Cap formula: clamp `floor(rawLen / BYTES_PER_ITEM)` between
 * `CAP_FLOOR` (never wipe a non-empty inventory) and `CAP_CEILING`
 * (never trust more than ~40 top-level clauses regardless of length).
 */
export function capInventory(
  inventory: InventoryItem[],
  rawLen: number,
): { inventory: InventoryItem[]; capped: boolean; originalCount: number } {
  const cap = Math.max(
    INVENTORY_CAP_FLOOR,
    Math.min(
      INVENTORY_CAP_CEILING,
      Math.floor(rawLen / INVENTORY_CAP_BYTES_PER_ITEM),
    ),
  );
  const originalCount = inventory.length;
  if (originalCount <= cap) {
    return { inventory, capped: false, originalCount };
  }
  return {
    inventory: inventory.slice(0, cap),
    capped: true,
    originalCount,
  };
}

// ---------------------------------------------------------------------------
// Pass 2 retry helpers
// ---------------------------------------------------------------------------

/**
 * Ratio of expected clauses that must be present after Pass 2 to consider
 * the attempt successful. Below this, the call is treated as a collapse
 * and retried once. 0.5 was chosen empirically — the observed collapse
 * returned 1 out of 20+ clauses, so any threshold above `1 / expected`
 * catches it; 0.5 gives generous headroom without firing on mild drift.
 */
export const PASS2_RETRY_THRESHOLD = 0.5;

/**
 * Decide whether Pass 2 returned enough analyzed clauses to call it a
 * success. Pure helper — both the non-streaming batch path and the
 * streaming batch path consult it before kicking off a retry.
 *
 * Returns `true` iff:
 *   - `expected > 0` (there was something to analyze), AND
 *   - `streamed < ceil(expected * PASS2_RETRY_THRESHOLD)` (too few came back).
 *
 * `expected === 0` is a defensive early-out: an empty extraction
 * shouldn't trigger retry, since the retry would analyze nothing either.
 */
export function shouldRetryPass2(streamed: number, expected: number): boolean {
  if (expected <= 0) return false;
  return streamed < Math.ceil(expected * PASS2_RETRY_THRESHOLD);
}

/** Build a risk breakdown object from a list of analyzed clauses. */
export function buildRiskBreakdown(clauses: { risk_level: string }[]) {
  return {
    high: clauses.filter((c) => c.risk_level === "high").length,
    medium: clauses.filter((c) => c.risk_level === "medium").length,
    low: clauses.filter((c) => c.risk_level === "low").length,
    informational: clauses.filter((c) => c.risk_level === "informational").length,
  };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Full two-pass analysis pipeline.
 *
 * Pass 1: Extract clauses from raw contract text (guided by inventory).
 * Pass 2: Classify and risk-assess each clause (batch or fan-out).
 *
 * @param withCitations When true (default), the model emits verbatim
 *   citation quotes alongside each clause; when false, the citations
 *   array is forced to stay empty (see buildAnalysisSystemPrompt).
 * @param userRole When set, risk analysis is framed from that party's
 *   perspective (e.g. "Tenant"); when null/undefined it falls back to
 *   the default weaker-party framing.
 */
export async function analyzeContract(
  text: string,
  mode: AnalysisMode,
  withCitations: boolean = true,
  userRole?: string | null,
  provider: LLMProvider = getProvider(),
): Promise<AnalyzeResponse> {
  // Pass 0 — overview (low reasoning effort).
  // temperature=0 + fixed seed pin the output as tightly as the provider
  // allows — necessary because an inventory count drift of 20→46 on the
  // same input was observed to collapse Pass 2 downstream (see diagnostic
  // transcript 2026-04-16-nl-freelance-mistral-small.md).
  const pass0Start = Date.now();
  const { object: rawOverview } = await generateObject({
    model: provider.model("low"),
    schema: contractOverviewSchema,
    system: OVERVIEW_SYSTEM_PROMPT,
    prompt: `Extract the high-level overview from this contract:\n\n${text}`,
    temperature: 0,
    seed: OVERVIEW_SEED,
  });
  const { inventory: cappedInventory, capped, originalCount } = capInventory(
    rawOverview.clause_inventory,
    text.length,
  );
  const overview = reconcileJurisdiction({
    ...rawOverview,
    clause_inventory: cappedInventory,
  });
  logPass("overview", {
    ms: Date.now() - pass0Start,
    partyCount: overview.parties.length,
    inventoryCount: overview.clause_inventory.length,
    jurisdiction: overview.governing_jurisdiction ?? "null",
    capped,
    rawCount: originalCount,
    rawLen: text.length,
  });

  const analysisSystemPrompt = buildAnalysisSystemPrompt(
    withCitations,
    userRole,
    overview.governing_jurisdiction,
    overview.jurisdiction_evidence,
  );

  // Pass 1 — extraction (medium effort)
  const pass1Start = Date.now();
  const { object: extraction } = await generateObject({
    model: provider.model("medium"),
    schema: extractionResultSchema,
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: buildExtractionPrompt(text, overview.clause_inventory),
  });
  logPass("extraction", {
    ms: Date.now() - pass1Start,
    expected: overview.clause_inventory.length,
    returned: extraction.clauses.length,
  });

  // Pass 2 — risk analysis (high effort)
  const passEffort: ReasoningEffort = "high";
  const pass2Start = Date.now();
  let analyzedClauses: z.infer<typeof analyzedClauseSchema>[];
  let pass2Retried = false;

  if (mode === "deep") {
    analyzedClauses = await Promise.all(
      extraction.clauses.map(async (clause) => {
        const { object } = await generateObject({
          model: provider.model(passEffort),
          schema: analyzedClauseSchema,
          system: analysisSystemPrompt,
          prompt: `Analyze this contract clause:\n\n${JSON.stringify(clause, null, 2)}`,
        });
        return object;
      })
    );
  } else {
    // Non-streaming batch: issue the call, and if the model returns fewer
    // than half of the expected clauses, retry once. No mid-flight UI
    // emission in this path (the caller only sees the final object), so
    // reissuing is atomic and safe. Retry is opt-out via
    // PASS2_RETRY_ENABLED=false for prod cost control during provider
    // incidents where every call short-returns.
    const runBatch = () =>
      generateObject({
        model: provider.model(passEffort),
        schema: batchAnalysisSchema,
        system: analysisSystemPrompt,
        prompt: `Analyze all of the following contract clauses:\n\n${JSON.stringify(extraction.clauses, null, 2)}`,
      });
    const { object: firstAttempt } = await runBatch();
    const retryEnabled = process.env.PASS2_RETRY_ENABLED !== "false";
    const shouldRetry =
      retryEnabled &&
      shouldRetryPass2(firstAttempt.clauses.length, extraction.clauses.length);
    if (shouldRetry) {
      pass2Retried = true;
      logPass("pass2", {
        retried: true,
        attempt: 1,
        streamed: firstAttempt.clauses.length,
        expected: extraction.clauses.length,
      });
      const { object: retry } = await runBatch();
      analyzedClauses = retry.clauses.length > firstAttempt.clauses.length
        ? retry.clauses
        : firstAttempt.clauses;
    } else {
      analyzedClauses = firstAttempt.clauses;
    }
  }

  const pass2Histogram = buildRiskBreakdown(analyzedClauses);
  logPass("pass2", {
    ms: Date.now() - pass2Start,
    mode,
    streamed: analyzedClauses.length,
    high: pass2Histogram.high,
    medium: pass2Histogram.medium,
    low: pass2Histogram.low,
    informational: pass2Histogram.informational,
    retried: pass2Retried,
  });

  const summary = {
    total_clauses: analyzedClauses.length,
    risk_breakdown: buildRiskBreakdown(analyzedClauses),
    top_risks: analyzedClauses
      .filter((c) => c.risk_level === "high")
      .map((c) => `${c.title}: ${c.risk_explanation}`),
  };

  return {
    overview,
    summary,
    clauses: analyzedClauses,
    provenance: buildProvenance(provider),
  };
}
