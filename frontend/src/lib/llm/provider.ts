/**
 * LLM provider abstraction.
 *
 * Single source of truth for the LLM the pipeline uses. Redline runs
 * on Mistral La Plateforme (Paris, EU) — there is no fallback path
 * to a non-EU provider. The abstraction stays in place so call sites
 * keep a stable surface for provenance (snapshot + region) and for a
 * possible future EU-only redundancy provider.
 *
 * Reasoning-effort caveat: `@ai-sdk/mistral@3.0.x` exposes
 * `reasoningEffort` only on a subset of models (Magistral family) and
 * only accepts `"none" | "high"` via `providerOptions.mistral` at
 * request time, not at model construction. Since the plan calls for
 * `"low" | "medium" | "high"` and the SDK cannot honor that contract
 * today, the boundary still accepts the effort parameter (uniform
 * call sites) but the Mistral factory ignores it.
 */

import { mistral } from "@ai-sdk/mistral";
import type { LanguageModel } from "ai";

/**
 * Reasoning effort levels used across the pipeline. Currently advisory
 * only — see note at top of file about SDK support.
 */
export type ReasoningEffort = "low" | "medium" | "high";

/** Uniform provider surface consumed by the analysis pipeline. */
export interface LLMProvider {
  name: "mistral";
  /** Returns a model instance for the requested reasoning effort. */
  model: (effort: ReasoningEffort) => LanguageModel;
  /** Provenance: model snapshot string (revision/date) for the AI Act log. */
  snapshot: () => string;
  /** Provenance: hosting region label. */
  region: string;
}

/**
 * Mistral model IDs. Mistral's API does not include the major version
 * in the identifier — `mistral-small-latest` is the rolling alias that
 * currently resolves to Mistral Small 4 (v26.03). Snapshot constant is
 * the pinned revision we log to provenance for AI Act compliance.
 */
const MISTRAL_MODEL_ID = "mistral-small-latest";
const MISTRAL_SNAPSHOT = "mistral-small-2603";

// `effort` is currently unused — see file-level comment. The interface
// still accepts the parameter so call sites stay uniform if/when the
// SDK adds support; the implementation ignores it.
const mistralProvider: LLMProvider = {
  name: "mistral",
  model: () => mistral(MISTRAL_MODEL_ID) as unknown as LanguageModel,
  snapshot: () => MISTRAL_SNAPSHOT,
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
