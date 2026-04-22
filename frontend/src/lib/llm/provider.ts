/**
 * LLM provider abstraction.
 *
 * Single source of truth for the LLM the pipeline uses. Redline runs
 * on Mistral La Plateforme (Paris, EU) — there is no fallback path
 * to a non-EU provider. The abstraction stays in place so call sites
 * keep a stable surface for provenance (snapshot + region) and for a
 * possible future EU-only redundancy provider.
 *
 * Pass-aware routing (SP-11 Phase 1): `model()` now takes a
 * `{ effort, pass }` descriptor so different pipeline passes can
 * resolve to different model IDs. Phase 1 keeps every pass on
 * `mistral-small-latest` (zero behavior change) — Phase 2 flips
 * `risk` and `think_hard` onto Magistral Medium for native reasoning.
 *
 * Reasoning-effort caveat: `@ai-sdk/mistral@3.0.x` exposes
 * `reasoningEffort` only on a subset of models (Magistral family) and
 * only accepts `"none" | "high"` via `providerOptions.mistral` at
 * request time, not at model construction. The boundary still accepts
 * the effort label (uniform call sites + transparency-receipt data)
 * but Phase 1 does not forward it to the SDK.
 */

import { mistral } from "@ai-sdk/mistral";
import type { LanguageModel } from "ai";

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
 * Magistral Medium — native-reasoning model for risk passes. Declared
 * here so Phase 1 can ship the per-pass plumbing without behavior
 * change; Phase 2 swaps `risk` and `think_hard` onto this descriptor.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MAGISTRAL_MEDIUM: ModelDescriptor = {
  id: "magistral-medium-latest",
  snapshot: "magistral-medium-2509",
};

/**
 * Pass-to-model routing table. Phase 1: all passes → Mistral Small
 * (zero behavior change vs the single-model world). Phase 2 flips
 * `risk` and `think_hard` to `MAGISTRAL_MEDIUM`.
 */
const PASS_MODEL_MAP: Record<PipelinePass, ModelDescriptor> = {
  overview: MISTRAL_SMALL,
  extraction: MISTRAL_SMALL,
  risk: MISTRAL_SMALL,
  think_hard: MISTRAL_SMALL,
  chat: MISTRAL_SMALL,
};

/** Uniform provider surface consumed by the analysis pipeline. */
export interface LLMProvider {
  name: "mistral";
  /** Returns a model instance for the given pass + effort label. */
  model: (opts: { effort: ReasoningEffort; pass: PipelinePass }) => LanguageModel;
  /** Provenance: model ID that `pass` resolved to (AI Act audit log). */
  modelIdFor: (pass: AnalysisPass) => string;
  /** Provenance: pinned snapshot tag for the model that `pass` resolved to. */
  snapshotFor: (pass: AnalysisPass) => string;
  /** Provenance: hosting region label. */
  region: string;
}

// `effort` is currently unused — see file-level comment. Keeping it on
// the signature means Phase 2 (Magistral `reasoning_effort`) will not
// need another call-site migration.
const mistralProvider: LLMProvider = {
  name: "mistral",
  model: ({ pass }) =>
    mistral(PASS_MODEL_MAP[pass].id) as unknown as LanguageModel,
  modelIdFor: (pass) => PASS_MODEL_MAP[pass].id,
  snapshotFor: (pass) => PASS_MODEL_MAP[pass].snapshot,
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
