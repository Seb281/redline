/**
 * Single category diff row — category header + A/B side columns.
 *
 * Uses a 12-column grid so the verdict badge sits centred between the
 * two clause columns on desktop; stacks vertically on mobile.
 *
 * Clause rendering is kept intentionally lightweight (title + risk
 * badge + truncated plain-english) — the full interactive ClauseCard
 * lives on `/report`. The compare view is for orienting, not deep
 * reading.
 */

"use client";

import { useTranslations } from "next-intl";
import type { AnalyzedClause } from "@/types";
import type { CategoryVerdict, ComparisonGroup } from "@/lib/compare/types";
import { RiskBadge } from "@/components/RiskBadge";

interface DiffClauseRowProps {
  group: ComparisonGroup;
}

/** Maps verdict → the localised badge label key. */
function verdictLabelKey(v: CategoryVerdict): string {
  switch (v) {
    case "higher_in_a":
      return "verdictHigherA";
    case "higher_in_b":
      return "verdictHigherB";
    case "same":
      return "verdictSame";
    case "unique_to_a":
      return "verdictUniqueA";
    case "unique_to_b":
      return "verdictUniqueB";
  }
}

/** Tailwind classes for the verdict pill — colour-codes by severity. */
function verdictPillClass(v: CategoryVerdict): string {
  const base = "rounded-full border px-2 py-0.5 text-[11px] font-semibold";
  switch (v) {
    case "higher_in_a":
    case "higher_in_b":
      return `${base} border-[var(--risk-medium)] text-[var(--risk-medium)]`;
    case "unique_to_a":
    case "unique_to_b":
      return `${base} border-[var(--accent)] text-[var(--accent)]`;
    case "same":
      return `${base} border-[var(--border-primary)] text-[var(--text-muted)]`;
  }
}

/**
 * Renders one side's column. `empty` hints that this contract has no
 * clause in the category — shown as a neutral placeholder rather than
 * a blank cell so the row height stays symmetric.
 */
function SideColumn({
  clauses,
  highlighted,
  emptyLabel,
}: {
  clauses: AnalyzedClause[];
  highlighted: boolean;
  emptyLabel: string;
}) {
  if (clauses.length === 0) {
    return (
      <div
        className="rounded border border-dashed border-[var(--border-primary)] bg-transparent p-3 text-[13px] italic text-[var(--text-muted)] font-[var(--font-body)]"
        data-testid="diff-side-empty"
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={[
        "flex flex-col gap-2 rounded border bg-[var(--bg-card)] p-3 theme-transition",
        highlighted
          ? "border-[var(--risk-medium)]"
          : "border-[var(--border-primary)]",
      ].join(" ")}
      data-testid="diff-side"
      data-highlighted={highlighted}
    >
      {clauses.map((c, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-medium text-[var(--text-primary)] font-[var(--font-body)]">
              {c.title}
            </p>
            <RiskBadge level={c.risk_level} />
          </div>
          <p className="line-clamp-3 text-[13px] text-[var(--text-secondary)] font-[var(--font-body)]">
            {c.plain_english}
          </p>
        </div>
      ))}
    </div>
  );
}

/** One full diff row: category header → two side columns + verdict pill. */
export function DiffClauseRow({ group }: DiffClauseRowProps) {
  const t = useTranslations("Compare");
  const tCat = useTranslations("ClauseCategory");
  const tRow = useTranslations("CompareClauseRow");

  const highlightedA =
    group.verdict === "higher_in_a" || group.verdict === "unique_to_a";
  const highlightedB =
    group.verdict === "higher_in_b" || group.verdict === "unique_to_b";

  return (
    <div
      className="flex flex-col gap-2 border-t border-[var(--border-primary)] py-4 first:border-t-0 first:pt-0"
      data-testid="diff-row"
      data-category={group.category}
      data-verdict={group.verdict}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] font-[var(--font-heading)]">
          {tCat(group.category)}
        </p>
        <span className={verdictPillClass(group.verdict)}>
          {tRow(verdictLabelKey(group.verdict))}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SideColumn
          clauses={group.clausesA}
          highlighted={highlightedA}
          emptyLabel={t("noMatchingClause")}
        />
        <SideColumn
          clauses={group.clausesB}
          highlighted={highlightedB}
          emptyLabel={t("noMatchingClause")}
        />
      </div>
    </div>
  );
}
