/**
 * LLM provider abstraction.
 *
 * Single source of truth for the LLM the pipeline uses. Redline runs
 * on Mistral La Plateforme (Paris, EU) — there is no fallback path
 * to a non-EU provider. The abstraction stays in place so call sites
 * keep a stable surface for provenance (snapshot + region) and for a
 * possible future EU-only redundancy provider.
 *
 * Pass-aware routing (SP-11): `model()` takes a `{ effort, pass, mode }`
 * descriptor so different pipeline passes resolve to different model
 * IDs. Metadata passes (overview, extraction, chat) stay on Mistral
 * Small for strict structured-output compliance; `think_hard` always
 * routes to Magistral Medium for native reasoning. The `risk` pass is
 * mode-sensitive: Deep mode routes to Magistral so the emitted
 * chain-of-thought is captured per clause for AI Act auditability,
 * Fast mode demotes to Mistral Small for lower end-to-end latency
 * (batch mode produces a single non-attributable reasoning blob
 * anyway, so no per-clause trace is forfeited).
 *
 * Reasoning-effort caveat: Magistral models on Mistral La Plateforme
 * run reasoning by default — the API rejects `reasoning_effort` as an
 * unsupported parameter, so we do NOT thread it through. The model
 * emits `reasoning` on every response regardless; call sites read it
 * off the `generateObject` result via the AI SDK side-channel.
 * The `effort` label on `model()` is still recorded for the
 * transparency receipt.
 */

import { mistral } from "@ai-sdk/mistral";
import type { LanguageModel } from "ai";
import type { AnalysisMode } from "@/types";

/**
 * Reasoning effort levels used across the pipeline. Currently advisory
 * only — see note at top of file about SDK support.
 */
export type ReasoningEffort = "low" | "medium" | "high";

/**
 * Analysis passes that appear in `AnalysisProvenance.model_per_pass`.
 * These are the four LLM passes whose model ID is auditable under the
 * AI Act transparency obligation.
 */
export type AnalysisPass = "overview" | "extraction" | "risk" | "think_hard";

/**
 * All routing keys `model()` accepts. `chat` is runtime Q&A (not an
 * analysis pass) and is deliberately excluded from provenance.
 */
export type PipelinePass = AnalysisPass | "chat";

/** Internal shape: resolvable model ID + its pinned snapshot tag. */
interface ModelDescriptor {
  id: string;
  snapshot: string;
}

/**
 * Mistral Small — workhorse for metadata-style passes (overview,
 * extraction, chat). Mistral's API does not encode the major version
 * in the identifier: `mistral-small-latest` rolls forward, so the
 * snapshot constant is the pinned revision logged to provenance for
 * AI Act compliance.
 */
const MISTRAL_SMALL: ModelDescriptor = {
  id: "mistral-small-latest",
  snapshot: "mistral-small-2603",
};

/**
 * Magistral Medium — Mistral's native-reasoning model. Routed to by
 * the risk and think-hard passes so the analysis surfaces a visible
 * chain-of-thought for AI Act auditors and end-users.
 */
const MAGISTRAL_MEDIUM: ModelDescriptor = {
  id: "magistral-medium-latest",
  snapshot: "magistral-medium-2509",
};

/**
 * Pass-to-model routing table.
 *
 * Metadata passes (overview, extraction, chat) stay on Mistral Small:
 * structured output compliance matters more than reasoning depth.
 *
 * Risk passes (risk, think_hard) route to Magistral Medium so the
 * model emits a `reasoningText` blob the pipeline can persist and
 * surface as a collapsible "thinking" block on the report. In Fast
 * mode the `risk` pass is demoted to Mistral Small — see `resolve()`
 * below. Think-hard is a deliberate escalation path and always stays
 * on Magistral regardless of the surrounding analysis mode.
 */
const PASS_MODEL_MAP: Record<PipelinePass, ModelDescriptor> = {
  overview: MISTRAL_SMALL,
  extraction: MISTRAL_SMALL,
  risk: MAGISTRAL_MEDIUM,
  think_hard: MAGISTRAL_MEDIUM,
  chat: MISTRAL_SMALL,
};

/**
 * Resolve the model descriptor for a pass, honoring the analysis-mode
 * override for the risk pass.
 *
 * Fast mode demotes `risk` to Mistral Small: Magistral's reasoning
 * latency dominates end-to-end analysis time for users who explicitly
 * opted into the lower-latency path. Deep mode keeps Magistral so the
 * per-clause reasoning trace is still captured for AI Act auditability.
 * Every other pass is mode-agnostic.
 */
function resolve(pass: PipelinePass, mode?: AnalysisMode): ModelDescriptor {
  if (pass === "risk" && mode === "fast") return MISTRAL_SMALL;
  return PASS_MODEL_MAP[pass];
}

/**
 * Passes that emit a native reasoning trace. Call sites consult this
 * to know whether to expect a non-empty `reasoning` field on the
 * `generateObject` result. Magistral models always emit reasoning, so
 * no request-time opt-in is needed. Keeping this centralised avoids
 * each call site hard-coding "risk" / "think_hard".
 *
 * Fast-mode `risk` resolves to Mistral Small, which does not emit
 * reasoning — `emitsReasoning()` accepts the mode and returns `false`
 * for that combination so batch-mode call sites do not speculatively
 * read a non-existent trace.
 */
const REASONING_PASSES: ReadonlySet<PipelinePass> = new Set([
  "risk",
  "think_hard",
]);

/**
 * Historic shape of the Magistral `providerOptions` payload. Preserved
 * on the provider interface to keep the public type stable, but no
 * call site should thread this today — Mistral La Plateforme rejects
 * `reasoning_effort` on Magistral, which emits reasoning by default.
 */
export type ReasoningProviderOptions = {
  mistral: { reasoningEffort: "high" | "none" };
};

/** Uniform provider surface consumed by the analysis pipeline. */
export interface LLMProvider {
  name: "mistral";
  /**
   * Returns a model instance for the given pass + effort label.
   *
   * `mode` is consulted for pass-level routing overrides — currently
   * only the `risk` pass honors it (Fast → Mistral Small, Deep →
   * Magistral Medium). Omitting `mode` uses the default map and is
   * safe for passes that are mode-agnostic (overview, extraction,
   * chat, think_hard).
   */
  model: (opts: {
    effort: ReasoningEffort;
    pass: PipelinePass;
    mode?: AnalysisMode;
  }) => LanguageModel;
  /**
   * Provenance: model ID that `pass` resolved to (AI Act audit log).
   * Accepts `mode` so `model_per_pass.risk` records the Fast-mode
   * demotion honestly instead of a hard-coded Magistral ID.
   */
  modelIdFor: (pass: AnalysisPass, mode?: AnalysisMode) => string;
  /** Provenance: pinned snapshot tag for the model that `pass` resolved to. */
  snapshotFor: (pass: AnalysisPass, mode?: AnalysisMode) => string;
  /**
   * `providerOptions` payload for a pass that targets a reasoning
   * model (Magistral family). Returns `undefined` for passes on a
   * metadata model so call sites can spread-or-omit without a branch.
   */
  reasoningOptionsFor: (
    pass: PipelinePass,
    mode?: AnalysisMode,
  ) => ReasoningProviderOptions | undefined;
  /**
   * Whether the given pass targets a reasoning-capable model. The
   * Fast-mode `risk` demotion (Magistral → Mistral Small) flips this
   * to `false`, so batch call sites do not try to read a reasoning
   * trace that was never emitted.
   */
  emitsReasoning: (pass: PipelinePass, mode?: AnalysisMode) => boolean;
  /** Provenance: hosting region label. */
  region: string;
}

// `effort` is currently unused by the SDK for non-Magistral models —
// see file-level comment. The reasoning-effort label is still
// propagated onto Magistral calls via `reasoningOptionsFor`, which
// maps `"high"` / `"medium"` → `"high"` (the only non-`"none"` value
// the SDK exposes today) and `"low"` → `"none"`.
const mistralProvider: LLMProvider = {
  name: "mistral",
  model: ({ pass, mode }) =>
    mistral(resolve(pass, mode).id) as unknown as LanguageModel,
  modelIdFor: (pass, mode) => resolve(pass, mode).id,
  snapshotFor: (pass, mode) => resolve(pass, mode).snapshot,
  reasoningOptionsFor: () => undefined,
  emitsReasoning: (pass, mode) =>
    REASONING_PASSES.has(pass) && !(pass === "risk" && mode === "fast"),
  region: "eu-west-paris",
};

/**
 * Resolve the active provider. Single-provider today; the function is
 * kept to preserve a stable call-site signature in case a second
 * EU-hosted provider is added for redundancy.
 */
export function getProvider(): LLMProvider {
  return mistralProvider;
}
