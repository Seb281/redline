/**
 * LLM provider abstraction.
 *
 * Single source of truth for which LLM the pipeline uses. Default is
 * Mistral La Plateforme (Paris); OpenAI is kept as a rollback for one
 * release cycle. Selected at request time from env, with a dev-only
 * `?provider=` override at the API route layer.
 *
 * Reasoning-effort caveat: `@ai-sdk/mistral@3.0.x` exposes
 * `reasoningEffort` only on a subset of models (Magistral family) and
 * only accepts `"none" | "high"` via `providerOptions.mistral` at
 * request time, not at model construction. Since the plan calls for
 * `"low" | "medium" | "high"` and the Mistral SDK cannot honor that
 * contract today, we accept the effort parameter at the provider
 * boundary (so call sites stay uniform) but do NOT wire it to the
 * Mistral factory — the model is returned as-is. The OpenAI path is
 * likewise unwired here; request-time options can be layered on later
 * without changing call sites.
 */

import { mistral } from "@ai-sdk/mistral";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/** Supported provider identifiers. */
export type ProviderName = "mistral" | "openai";

/**
 * Reasoning effort levels used across the pipeline. Currently advisory
 * only — see note at top of file about SDK support.
 */
export type ReasoningEffort = "low" | "medium" | "high";

/** Uniform provider surface consumed by the analysis pipeline. */
export interface LLMProvider {
  name: ProviderName;
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

/** OpenAI rollback target. Kept behind `LLM_PROVIDER=openai`. */
const OPENAI_MODEL_ID = "gpt-4.1-nano";
const OPENAI_SNAPSHOT = "gpt-4.1-nano-2025-04-14";

// effort currently unused — see file-level comment. The interface still
// accepts the parameter so call sites stay uniform if/when the SDK adds
// support; these implementations simply ignore it.
const mistralProvider: LLMProvider = {
  name: "mistral",
  model: () => mistral(MISTRAL_MODEL_ID) as unknown as LanguageModel,
  snapshot: () => MISTRAL_SNAPSHOT,
  region: "eu-west-paris",
};

const openaiProvider: LLMProvider = {
  name: "openai",
  model: () => openai(OPENAI_MODEL_ID) as unknown as LanguageModel,
  snapshot: () => OPENAI_SNAPSHOT,
  region: "us-east",
};

const PROVIDERS: Record<ProviderName, LLMProvider> = {
  mistral: mistralProvider,
  openai: openaiProvider,
};

/**
 * Resolve the active provider.
 *
 * Precedence: explicit override > LLM_PROVIDER env var > default ("mistral").
 * The override should only be passed by API route handlers AFTER they have
 * validated `isOverrideAllowed()` returns true.
 */
export function getProvider(override?: ProviderName): LLMProvider {
  if (override) return PROVIDERS[override];
  const fromEnv = process.env.LLM_PROVIDER as ProviderName | undefined;
  if (fromEnv === "openai" || fromEnv === "mistral") return PROVIDERS[fromEnv];
  return PROVIDERS.mistral;
}

/** True iff the dev-only `?provider=` query override should be honored. */
export function isOverrideAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}
