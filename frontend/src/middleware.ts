/**
 * next-intl middleware — detects the active locale from the cookie or
 * `Accept-Language` header and rewrites/redirects prefixed URLs.
 *
 * The matcher excludes:
 *   - `/api/*`         — API routes return JSON, locale-agnostic
 *   - `/_next/*`       — Next internals (static chunks, HMR)
 *   - `/_vercel/*`     — Vercel health probes
 *   - `*.anything`     — static assets (`favicon.ico`, images, etc.)
 *
 * Everything else flows through next-intl so the `[locale]` segment is
 * enforced and the `NEXT_LOCALE` cookie is kept in sync.
 */

import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
