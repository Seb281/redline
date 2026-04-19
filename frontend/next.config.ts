import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Wraps the Next.js config with next-intl's plugin so the runtime can
 * resolve the per-request locale + messages defined in `src/i18n/request.ts`.
 * The plugin only adds an alias; it does not change any other build semantics.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // pdfjs-dist uses Node-incompatible browser globals; keep it out of the
  // Server Components bundle so any accidental server-side import fails
  // loudly at build time instead of silently shipping a broken worker.
  serverExternalPackages: ["pdfjs-dist"],
};

export default withNextIntl(nextConfig);
