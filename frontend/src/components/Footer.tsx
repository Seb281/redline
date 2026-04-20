/**
 * Minimal site footer with privacy policy link.
 *
 * Server component — relies on the parent `[locale]` layout having
 * called `setRequestLocale(locale)` so `getTranslations()` resolves
 * without an explicit `locale` argument. If this component is ever
 * mounted outside the `[locale]` segment (or in a route that skips
 * `setRequestLocale`), translations will fall back to the default
 * locale instead of the requested one.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const t = await getTranslations("Footer");

  return (
    <footer className="mx-auto mt-12 max-w-4xl border-t border-[var(--border-primary)] px-5 py-5 text-center sm:px-7">
      <p className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">
        {t("brand")}{" "}
        <span className="mx-1">&middot;</span>{" "}
        <Link href="/privacy" className="hover:text-[var(--text-secondary)] hover:underline">
          {t("privacyPolicy")}
        </Link>
        <span className="mx-1">&middot;</span>{" "}
        <a
          href="https://seb.giupana.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--text-secondary)] hover:underline"
        >
          {t("portfolio")}
        </a>
      </p>
    </footer>
  );
}
