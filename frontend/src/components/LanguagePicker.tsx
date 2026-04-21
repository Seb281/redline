/**
 * Locale selector — swaps the active locale while preserving the
 * current pathname so `/privacy` becomes `/fr/privacy` on switch.
 *
 * Uses the locale-aware `useRouter` from `@/i18n/navigation` so
 * next-intl can update the `NEXT_LOCALE` cookie server-side on the
 * redirect; a plain `next/navigation` router would strip the locale
 * segment.
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

export function LanguagePicker() {
  const t = useTranslations("LanguagePicker");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        disabled={isPending}
        aria-label={t("label")}
        onChange={(event) => {
          const nextLocale = event.target.value as Locale;
          startTransition(() => {
            // `usePathname` from `@/i18n/navigation` returns the already-
            // resolved path (dynamic segments substituted, no locale
            // prefix); the router re-prefixes it with the target locale.
            router.replace(pathname, { locale: nextLocale });
          });
        }}
        className="cursor-pointer border border-transparent bg-transparent px-1 py-1 font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted transition-colors hover:text-ink focus:border-paper-edge focus:outline-none disabled:opacity-50"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {t(loc)}
          </option>
        ))}
      </select>
    </label>
  );
}
