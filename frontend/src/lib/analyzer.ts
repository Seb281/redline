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
import type { AnalysisProvenance, AnalyzeResponse, AnalysisMode } from "@/types";
import { getProvider, type LLMProvider, type ReasoningEffort } from "@/lib/llm/provider";

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

export const contractOverviewSchema = z.object({
  contract_type: z
    .string()
    .describe("Type of contract, e.g. 'Freelance Services Agreement'"),
  parties: z
    .array(z.string())
    .describe("Names of the parties involved"),
  effective_date: z
    .string()
    .nullable()
    .describe("Effective or start date if stated"),
  duration: z
    .string()
    .nullable()
    .describe("Contract duration if stated, e.g. '12 months'"),
  total_value: z
    .string()
    .nullable()
    .describe("Total contract value if stated, e.g. '$120,000'"),
  governing_jurisdiction: z
    .string()
    .nullable()
    .describe("Governing law jurisdiction if stated"),
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
  jurisdiction_note: z
    .string()
    .nullable()
    .describe(
      "One-line note about jurisdiction-specific concerns. " +
      "Null if governing law is unknown or clause has no jurisdiction-specific issue.",
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

  const jurisdictionSection = jurisdiction
    ? `\
Jurisdiction-Aware Analysis (${jurisdiction}):
This contract is governed by ${jurisdiction}. Apply jurisdiction-specific rules:

EU Member State rules (apply when jurisdiction is in the EU/EEA):
- Non-competes: Many EU states restrict or void non-competes without compensation. \
Netherlands: requires written form + compensation. Germany: max 2 years, requires \
Karenzentschädigung (compensation during restriction). France: requires contrepartie \
financière. Overly broad scope/duration often void.
- Data protection: GDPR supersedes conflicting contractual terms. Clauses limiting \
data subject rights are void regardless of contract.
- Unfair terms: EU Directive 93/13/EEC can void one-sided clauses in B2C and \
sometimes B2B (varies by national implementation).
- Limitation of liability: Exclusion of gross negligence/intentional misconduct \
void in most EU jurisdictions (German BGB §276 makes this explicit).
- IP assignment: Overly broad IP clauses (pre-existing IP, work outside scope) may \
conflict with employee invention laws (German ArbNErfG, Dutch patent law).
- Confidentiality: Perpetual obligations often unenforceable; 5+ years unusual in \
EU commercial practice.

For each clause, set \`jurisdiction_note\` to a one-line observation about how \
${jurisdiction} law specifically affects this clause (e.g., "Likely unenforceable \
under Dutch law — no compensation offered for post-contractual restriction"). \
Set to null if the clause has no jurisdiction-specific concern.`
    : `\
Jurisdiction note:
- The governing jurisdiction is not stated or not recognized. Set \
\`jurisdiction_note\` to null for all clauses.`;

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

Clause inventory:
- List EVERY distinct clause in the contract — substantive, boilerplate, \
  definitions, and procedural clauses alike. Do not skip any.
- Give each clause a short descriptive title (3-6 words).
- Include the section reference (e.g. "Section 3.1") when identifiable.
- If a clause spans multiple sub-sections that serve the same purpose, list it \
  as one entry.
- Order clauses as they appear in the document.`;

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
 * Bumped whenever any pipeline prompt (overview, extraction, analysis,
 * chat) changes in a way that could materially alter model outputs.
 * Part of the AI Act provenance record — auditors use it to correlate
 * stored analyses back to the prompt contract they were produced under.
 */
const PROMPT_TEMPLATE_VERSION = "1.0";

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
  };
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
  // Pass 0 — overview (low reasoning effort)
  const { object: overview } = await generateObject({
    model: provider.model("low"),
    schema: contractOverviewSchema,
    system: OVERVIEW_SYSTEM_PROMPT,
    prompt: `Extract the high-level overview from this contract:\n\n${text}`,
  });

  const analysisSystemPrompt = buildAnalysisSystemPrompt(
    withCitations,
    userRole,
    overview.governing_jurisdiction,
  );

  // Pass 1 — extraction (medium effort)
  const { object: extraction } = await generateObject({
    model: provider.model("medium"),
    schema: extractionResultSchema,
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: buildExtractionPrompt(text, overview.clause_inventory),
  });

  // Pass 2 — risk analysis (high effort)
  const passEffort: ReasoningEffort = "high";
  let analyzedClauses: z.infer<typeof analyzedClauseSchema>[];

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
    const { object: analysis } = await generateObject({
      model: provider.model(passEffort),
      schema: batchAnalysisSchema,
      system: analysisSystemPrompt,
      prompt: `Analyze all of the following contract clauses:\n\n${JSON.stringify(extraction.clauses, null, 2)}`,
    });
    analyzedClauses = analysis.clauses;
  }

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
