/**
 * LLM pipeline orchestration using Vercel AI SDK.
 *
 * Change provider/model by swapping the import and `model` constant below.
 * Everything else (prompts, schemas, pipeline logic) stays the same.
 */

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { AnalyzeResponse } from "@/types";

// ---------------------------------------------------------------------------
// Model configuration — single place to swap provider and model
// ---------------------------------------------------------------------------

export const model = openai("gpt-4.1-nano");

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
  risk_level: z.enum(["low", "medium", "high"]),
  risk_explanation: z
    .string()
    .describe("Why this risk level — what makes it risky or safe"),
  negotiation_suggestion: z
    .string()
    .nullable()
    .describe("Suggestion for medium/high risk. Null for low risk."),
  is_unusual: z
    .boolean()
    .describe("True if this clause deviates from standard contract norms"),
  unusual_explanation: z
    .string()
    .nullable()
    .describe("What is atypical and why it matters. Null if not unusual."),
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
You are a legal document analyzer. Your task is to identify and extract every \
significant clause from the provided contract text.

Rules:
- Extract the exact original text of each clause — do not paraphrase or summarize.
- Skip boilerplate: signature blocks, date lines, headers, recitals, and \
  definitions-only sections.
- Focus on substantive clauses that create obligations, restrictions, rights, \
  or liabilities for either party.
- Include the section reference (e.g., "Section 8.2") when identifiable from \
  the text.
- If a clause spans multiple paragraphs, include the full text as one clause.`;

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
 */
export function buildAnalysisSystemPrompt(withCitations: boolean): string {
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

  return `\
You are a legal risk analyst. You assess contract clauses from the perspective \
of the weaker/non-drafting party — the freelancer, employee, or smaller company.

For each clause, provide:
1. A category from: ${CATEGORIES}
2. A short descriptive title (3-6 words)
3. A plain-English explanation (1-2 sentences, no legal jargon)
4. A risk level: low, medium, or high
5. A specific risk explanation — why this level, what makes it risky or safe
6. A negotiation suggestion — ONLY for medium and high risk clauses. \
   Set to null for low risk.

Risk calibration:
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
  rights or creates asymmetric obligations.
7. Whether this clause is unusual compared to standard contracts of this type. \
   A clause is unusual if its terms, scope, duration, or obligations deviate \
   significantly from what is typical for its category.
8. If unusual, a brief explanation of what specifically is atypical and why it \
   matters. Set to null if the clause is not unusual.

${citationsSection}`;
}

/**
 * @deprecated Retained for backwards compatibility — prefer
 * {@link buildAnalysisSystemPrompt}. Defaults to citations enabled.
 */
export const ANALYSIS_SYSTEM_PROMPT = buildAnalysisSystemPrompt(true);

export const OVERVIEW_SYSTEM_PROMPT = `\
You are a legal document analyst. Your task is to extract high-level metadata \
from a contract. Identify the type of contract, the parties involved, key dates, \
financial terms, and the most important terms at a glance.

Rules:
- Extract only what is explicitly stated in the text. Do not infer or guess.
- If a field is not clearly stated, set it to null.
- For key_terms, list 3-5 of the most important substantive terms — the things \
  someone would want to know before reading the full contract.
- Keep key_terms concise: one sentence each, plain English, no legal jargon.`;

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Full two-pass analysis pipeline.
 *
 * Pass 1: Extract clauses from raw contract text.
 * Pass 2: Classify and risk-assess each clause (batch or fan-out).
 *
 * @param withCitations When true (default), the model emits verbatim
 *   citation quotes alongside each clause; when false, the citations
 *   array is forced to stay empty (see buildAnalysisSystemPrompt).
 */
export async function analyzeContract(
  text: string,
  thinkHard: boolean,
  withCitations: boolean = true
): Promise<AnalyzeResponse> {
  const analysisSystemPrompt = buildAnalysisSystemPrompt(withCitations);

  // Pass 0 — extract contract overview
  const { object: overview } = await generateObject({
    model,
    schema: contractOverviewSchema,
    system: OVERVIEW_SYSTEM_PROMPT,
    prompt: `Extract the high-level overview from this contract:\n\n${text}`,
  });

  // Pass 1 — extract clauses
  const { object: extraction } = await generateObject({
    model,
    schema: extractionResultSchema,
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: `Extract all significant clauses from this contract:\n\n${text}`,
  });

  // Pass 2 — analyze clauses
  let analyzedClauses: z.infer<typeof analyzedClauseSchema>[];

  if (thinkHard) {
    // Fan-out: one LLM call per clause, in parallel
    analyzedClauses = await Promise.all(
      extraction.clauses.map(async (clause) => {
        const { object } = await generateObject({
          model,
          schema: analyzedClauseSchema,
          system: analysisSystemPrompt,
          prompt: `Analyze this contract clause:\n\n${JSON.stringify(clause, null, 2)}`,
        });
        return object;
      })
    );
  } else {
    // Batch: all clauses in a single LLM call
    const { object: analysis } = await generateObject({
      model,
      schema: batchAnalysisSchema,
      system: analysisSystemPrompt,
      prompt: `Analyze all of the following contract clauses:\n\n${JSON.stringify(extraction.clauses, null, 2)}`,
    });
    analyzedClauses = analysis.clauses;
  }

  // Build summary
  const summary = {
    total_clauses: analyzedClauses.length,
    risk_breakdown: {
      high: analyzedClauses.filter((c) => c.risk_level === "high").length,
      medium: analyzedClauses.filter((c) => c.risk_level === "medium").length,
      low: analyzedClauses.filter((c) => c.risk_level === "low").length,
    },
    top_risks: analyzedClauses
      .filter((c) => c.risk_level === "high")
      .map((c) => `${c.title}: ${c.risk_explanation}`),
  };

  return { overview, summary, clauses: analyzedClauses };
}
