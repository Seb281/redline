/** Legal disclaimer — editorial pull quote with a 2px red left rail. */

"use client";

import { useTranslations } from "next-intl";

export function Disclaimer() {
  const t = useTranslations("Disclaimer");

  return (
    <aside
      role="note"
      className="mt-10 border-l-2 border-red-accent bg-paper-2 px-6 py-4"
    >
      <p className="t-reading m-0 max-w-[62ch] text-[16px] italic text-ink-2">
        {t("body")}
      </p>
    </aside>
  );
}
