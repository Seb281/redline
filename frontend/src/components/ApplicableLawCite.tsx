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

import type { ApplicableLaw } from "@/types";
import { STATUTE_LABELS } from "@/lib/applicable-law";

interface Props {
  applicableLaw: ApplicableLaw;
}

/**
 * Tailwind classes for the source-type pill. Green = "statute cited"
 * (most authoritative), amber = "general principle" (softer signal).
 */
function pillClass(sourceType: "statute_cited" | "general_principle"): string {
  if (sourceType === "statute_cited") {
    return "bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
  }
  return "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
}

export function ApplicableLawCite({ applicableLaw }: Props) {
  const hasCites = applicableLaw.citations.length > 0;
  return (
    <div className="mt-2.5">
      <p>
        <strong className="text-amber-600 dark:text-amber-400">Jurisdiction:</strong>{" "}
        {applicableLaw.observation}
        <span
          className={`ml-2 inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] ${pillClass(applicableLaw.source_type)}`}
        >
          {applicableLaw.source_type === "statute_cited"
            ? "Statute cited"
            : "General principle"}
        </span>
        {hasCites &&
          applicableLaw.citations.map((_, i) => (
            <sup
              key={`m-${i}`}
              className="ml-0.5 font-semibold text-[var(--accent)]"
            >
              [§{i + 1}]
            </sup>
          ))}
      </p>
      {hasCites && (
        <ol className="mt-2 space-y-1 border-t border-[var(--border-primary)] pt-2 text-[13px] text-[var(--text-tertiary)] font-[var(--font-body)]">
          {applicableLaw.citations.map((cit, i) => (
            <li key={cit.code}>
              <span className="mr-1 font-semibold">[§{i + 1}]</span>
              <span className="font-mono">{STATUTE_LABELS[cit.code]}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
