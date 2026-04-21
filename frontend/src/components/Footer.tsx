/**
 * Editorial site footer — 2px ink top border, mono uppercase tagline
 * left, link row right.
 *
 * Server component — relies on the parent `[locale]` layout having
 * called `setRequestLocale(locale)` so `getTranslations()` resolves
 * without an explicit `locale` argument.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const linkCls =
  "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted no-underline transition-colors hover:text-ink";

export async function Footer() {
  const t = await getTranslations("Footer");

  return (
    <footer className="mt-20 border-t-2 border-ink">
      <div className="mx-auto flex max-w-[1600px] flex-col items-start justify-between gap-4 px-6 py-8 md:flex-row md:items-center md:px-10">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">
          {t("brand")}
        </p>
        <ul className="flex flex-wrap items-center gap-5">
          <li>
            <Link href="/trust" className={linkCls}>
              {t("trust")}
            </Link>
          </li>
          <li>
            <Link href="/privacy" className={linkCls}>
              {t("privacyPolicy")}
            </Link>
          </li>
          <li>
            <Link href="/transparency" className={linkCls}>
              {t("transparency")}
            </Link>
          </li>
          <li>
            <Link href="/data-residency" className={linkCls}>
              {t("dataResidency")}
            </Link>
          </li>
          <li>
            <a
              href="https://seb.giupana.com"
              target="_blank"
              rel="noopener noreferrer"
              className={linkCls}
            >
              {t("portfolio")}
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
