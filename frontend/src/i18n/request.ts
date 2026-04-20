/**
 * Per-request locale + message resolver read by Server Components and
 * the `NextIntlClientProvider` boundary. Falls back to the default
 * locale when the incoming request carries an unsupported value so
 * middleware edge-cases (e.g. direct Server Action invocations) never
 * crash the render tree.
 *
 * Merges the locale catalog on top of the English catalog so partial
 * translations (or empty stubs) silently inherit the EN text for any
 * untranslated keys — avoids MISSING_MESSAGE crashes during the Layer A
 * rollout where non-EN catalogs are seeded incrementally.
 */

import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

type Messages = Record<string, unknown>;

/**
 * Deep-merge locale messages on top of English fallbacks.
 *
 * Rules:
 * - Nested objects recurse; arrays replace wholesale (ICU catalogs
 *   never use arrays, but the defensive overwrite matches next-intl's
 *   own behaviour).
 * - Empty / whitespace-only string overrides are treated as missing
 *   so an unfilled locale stub can't silently shadow a real EN string.
 * - Non-empty primitives (strings, numbers, booleans) overwrite.
 */
export function mergeMessages(base: Messages, overlay: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const baseVal = out[key];
    if (typeof value === "string" && value.trim() === "") continue;
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseVal !== null &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal)
    ) {
      out[key] = mergeMessages(baseVal as Messages, value as Messages);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const englishMessages = (
    await import(`../../messages/${routing.defaultLocale}.json`)
  ).default as Messages;

  const messages =
    locale === routing.defaultLocale
      ? englishMessages
      : mergeMessages(
          englishMessages,
          (await import(`../../messages/${locale}.json`)).default as Messages,
        );

  return {
    locale,
    messages,
  };
});
