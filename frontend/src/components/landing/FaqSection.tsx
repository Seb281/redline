/**
 * FaqSection — accordion FAQ used by Landing and (later) Trust.
 *
 * Items are driven by a `namespace` prop so both consumers can share
 * the same component against different message namespaces. Uses the
 * native `<details>` / `<summary>` elements for accessibility and
 * deletability — no JS controller needed.
 */

"use client";

import { useTranslations } from "next-intl";
import { SectionHead } from "@/components/ui/SectionHead";

export interface FaqSectionProps {
  /** Message namespace to pull `title`, `meta`, `q1/a1 … qN/aN` from. */
  namespace: string;
  /** How many Q/A pairs the namespace provides. */
  count: number;
}

export function FaqSection({ namespace, count }: FaqSectionProps) {
  const t = useTranslations(namespace);
  return (
    <section className="mt-20">
      <SectionHead meta={t("meta")}>{t("title")}</SectionHead>
      <div className="mt-4 divide-y divide-paper-edge border-b border-paper-edge">
        {Array.from({ length: count }).map((_, i) => {
          const n = i + 1;
          return (
            <details key={n} className="group py-5">
              <summary className="flex cursor-pointer items-start justify-between gap-6 marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="font-serif text-[20px] leading-snug text-ink">
                  {t(`q${n}`)}
                </span>
                <span
                  aria-hidden
                  className="mt-1 font-mono text-[12px] text-ink-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="t-reading text-ink-2 mt-3 m-0 max-w-[68ch]">
                {t(`a${n}`)}
              </p>
            </details>
          );
        })}
      </div>
    </section>
  );
}
