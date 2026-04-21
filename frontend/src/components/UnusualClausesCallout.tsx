/** Editorial callout listing clauses flagged as unusual/atypical. */

"use client";

import { useTranslations } from "next-intl";
import type { AnalyzedClause } from "@/types";
import { Kicker } from "@/components/ui/Kicker";

interface UnusualClausesCalloutProps {
  clauses: AnalyzedClause[];
}

/** Renders a summary of unusual clauses below the top risks section. */
export function UnusualClausesCallout({ clauses }: UnusualClausesCalloutProps) {
  const t = useTranslations("UnusualClausesCallout");
  const unusualClauses = clauses.filter((c) => c.is_unusual);

  if (unusualClauses.length === 0) return null;

  return (
    <section className="mb-8 border-t border-ink pt-4">
      <Kicker tone="red">{t("heading")}</Kicker>
      <ul className="mt-3 space-y-2">
        {unusualClauses.map((clause, i) => (
          <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3 border-b border-paper-edge pb-2 last:border-b-0">
            <span className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="font-serif text-[17px] leading-tight text-ink m-0">
                {clause.title}
              </p>
              {clause.unusual_explanation && (
                <p className="t-reading mt-1 text-[14px] text-ink-2 m-0">
                  {clause.unusual_explanation}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
