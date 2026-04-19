/**
 * next-intl routing configuration — single source of truth for the
 * supported locale set, fallback, and URL prefix policy.
 *
 * - `en` is the default and ships prefix-free (`/` renders English).
 * - Non-default locales use a prefix (`/fr/...`, `/de/...`).
 * - `localeCookie` persists the user's explicit picker choice for a year
 *   so a returning visitor lands directly on their preferred locale
 *   without having to negotiate `Accept-Language` again.
 */

import { defineRouting } from "next-intl/routing";

const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export const routing = defineRouting({
  locales: ["en", "fr", "de", "nl", "es", "it"] as const,
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeCookie: { name: "NEXT_LOCALE", maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS },
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];
