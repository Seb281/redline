/**
 * SP-7 Layer B' — resolve the analysis locale for an API request.
 *
 * Lives between the HTTP boundary and the pipeline (`analyzer.ts`,
 * `streaming-analyzer.ts`, `chat/route.ts`). Three responsibilities:
 *
 *   1. Validate the `locale` field coming in from the request body.
 *      Anything not in the next-intl routing allowlist is silently
 *      coerced to `"en"` (not a 422) so a malformed or stale client
 *      never kills an analysis request outright.
 *
 *   2. Apply the `ANALYSIS_LOCALE_OVERRIDE` env flag as an ops rollback
 *      switch — when set to `"en"`, every request resolves to English
 *      regardless of the requested locale. Single Vercel env flip
 *      restores EN analysis prose platform-wide without a code change.
 *
 *   3. Tell the debug logger whether the override actually fired so the
 *      `[redline-debug] locale_resolved` line carries both the
 *      requested and the effective locale (see §9 of the Layer B'
 *      plan: used to detect quality degradation per-locale).
 *
 * Kept deliberately small and framework-free so it is trivially unit
 * testable — route handlers call it once at the top and forward the
 * effective locale down into the pipeline.
 */

import { routing } from "@/i18n/routing";

/**
 * Output of the resolver. `effective` is what the pipeline sees;
 * `requested` and `overridden` are passed to `logPass` so ops can see
 * when the override flag is actually rewriting requests.
 */
export interface ResolvedAnalysisLocale {
  /** Locale to use for prompt construction. Always a routing locale. */
  effective: string;
  /** Locale the client originally requested (after validation). */
  requested: string;
  /** `true` when the effective locale differs from requested due to override. */
  overridden: boolean;
}

/**
 * Pick the effective analysis locale for a pipeline request.
 *
 * @param bodyLocale  Raw `locale` value read from the JSON request body.
 *                    Accepts `unknown` so callers don't have to narrow
 *                    before calling — this function validates instead.
 * @returns A {@link ResolvedAnalysisLocale} whose `effective` field is
 *          safe to pass to `buildOverviewSystemPrompt`,
 *          `buildExtractionSystemPrompt`, `buildAnalysisSystemPrompt`,
 *          or the chat system prompt.
 */
export function resolveAnalysisLocale(bodyLocale: unknown): ResolvedAnalysisLocale {
  const allowed = routing.locales as readonly string[];
  const requested =
    typeof bodyLocale === "string" && allowed.includes(bodyLocale)
      ? bodyLocale
      : routing.defaultLocale;

  const override = process.env.ANALYSIS_LOCALE_OVERRIDE?.trim() ?? "";
  if (override && allowed.includes(override) && override !== requested) {
    return { effective: override, requested, overridden: true };
  }
  return { effective: requested, requested, overridden: false };
}
