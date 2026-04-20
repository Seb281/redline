/** Legal disclaimer banner — displayed on the report screen. */

"use client";

import { useTranslations } from "next-intl";

export function Disclaimer() {
  const t = useTranslations("Disclaimer");

  return (
    <div className="mt-9 mx-auto max-w-2xl border-l-[3px] border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-5 py-3.5 text-[15px] italic text-[var(--text-tertiary)] font-[var(--font-heading)] theme-transition">
      {t("body")}
    </div>
  );
}
