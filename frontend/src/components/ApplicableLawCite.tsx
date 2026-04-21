/**
 * SP-1.7 — Renders a clause's jurisdiction-grounded note inside the
 * expanded ClauseCard. Inline pill flags the kind of evidence; when
 * statutes are cited, `[§N]` markers point to a small footnote list
 * below the paragraph that resolves each code to its canonical label.
 *
 * Footnote grammar deliberately mirrors the existing contract-quote
 * footnotes (ClauseExplanation) but uses `[§N]` instead of `[N]` so
 * the two grounding systems remain visually parallel without
 * collapsing into one.
 */

"use client";

import { useTranslations } from "next-intl";
import type { ApplicableLaw } from "@/types";
import { STATUTE_LABELS } from "@/lib/applicable-law";
import { MonoLabel } from "@/components/ui/MonoLabel";

interface Props {
  applicableLaw: ApplicableLaw;
}

/** Mono uppercase tone classes for the source-type chip. */
function sourcePillClass(sourceType: "statute_cited" | "general_principle"): string {
  return sourceType === "statute_cited"
    ? "border-ok/60 text-ok bg-ok-soft"
    : "border-warn/60 text-warn bg-warn-soft";
}

export function ApplicableLawCite({ applicableLaw }: Props) {
  const t = useTranslations("ApplicableLawCite");
  const hasCites = applicableLaw.citations.length > 0;
  return (
    <div className="mt-3">
      <p className="t-reading text-ink-2">
        <MonoLabel tone="red" className="mr-2 inline">
          {t("jurisdiction")}
        </MonoLabel>
        {applicableLaw.observation}
        <span
          className={`ml-2 inline-block border px-1.5 py-[1px] font-mono text-[9.5px] font-semibold uppercase tracking-[1.2px] ${sourcePillClass(applicableLaw.source_type)}`}
        >
          {applicableLaw.source_type === "statute_cited"
            ? t("statuteCited")
            : t("generalPrinciple")}
        </span>
        {hasCites &&
          applicableLaw.citations.map((_, i) => (
            <sup
              key={`m-${i}`}
              className="ml-0.5 font-mono font-semibold text-red-accent"
            >
              [§{i + 1}]
            </sup>
          ))}
      </p>
      {hasCites && (
        <ol className="mt-2 space-y-1 border-t border-paper-edge pt-2 font-mono text-[12px] text-ink-muted">
          {applicableLaw.citations.map((cit, i) => (
            <li key={cit.code}>
              <span className="mr-1 font-semibold text-ink-2">[§{i + 1}]</span>
              <span>{STATUTE_LABELS[cit.code]}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
