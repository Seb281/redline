/**
 * Single category diff row — category kicker + verdict chip, with two
 * side-by-side clause columns underneath.
 *
 * Slot A renders with a 1px ink left rail; Slot B with a 2px red-accent
 * left rail, echoing the slot cards above. Clause rendering is kept
 * intentionally lightweight (title + risk badge + truncated
 * plain-english) — the full interactive ClauseCard lives on `/report`.
 * The compare view is for orienting, not deep reading.
 */

"use client";

import { useTranslations } from "next-intl";
import type { AnalyzedClause } from "@/types";
import type { CategoryVerdict, ComparisonGroup } from "@/lib/compare/types";
import { RiskBadge } from "@/components/RiskBadge";

interface DiffClauseRowProps {
  group: ComparisonGroup;
}

/** Maps verdict → the localised chip label key. */
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

/** Editorial mono chip classes for the verdict. */
function verdictChipClass(v: CategoryVerdict): string {
  const base =
    "inline-block border px-2 py-[1px] font-mono text-[9.5px] font-semibold uppercase tracking-[1.2px]";
  switch (v) {
    case "higher_in_a":
    case "higher_in_b":
      return `${base} border-warn/60 text-warn bg-warn-soft`;
    case "unique_to_a":
    case "unique_to_b":
      return `${base} border-red-accent/60 text-red-accent bg-red-soft`;
    case "same":
      return `${base} border-paper-edge text-ink-muted bg-paper-2`;
  }
}

/**
 * Renders one side's column with a coloured left rail. `empty` hints
 * that this contract has no clause in the category — shown as a
 * neutral placeholder rather than a blank cell so the row height stays
 * symmetric.
 */
function SideColumn({
  clauses,
  highlighted,
  emptyLabel,
  rail,
}: {
  clauses: AnalyzedClause[];
  highlighted: boolean;
  emptyLabel: string;
  rail: "ink" | "red";
}) {
  const railClass = rail === "ink" ? "border-l-ink" : "border-l-red-accent";

  if (clauses.length === 0) {
    return (
      <div
        className={`border border-paper-edge border-l-2 ${railClass} border-dashed bg-paper p-4 font-mono text-[11px] uppercase tracking-[1.2px] italic text-ink-muted`}
        data-testid="diff-side-empty"
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={`border border-paper-edge border-l-2 bg-paper p-4 ${railClass} ${
        highlighted ? "bg-paper-2" : ""
      }`}
      data-testid="diff-side"
      data-highlighted={highlighted}
    >
      <div className="flex flex-col gap-3">
        {clauses.map((c, i) => (
          <div
            key={i}
            className="flex flex-col gap-1 border-b border-paper-edge pb-2 last:border-b-0 last:pb-0"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="m-0 font-serif text-[16px] font-light leading-tight tracking-[-0.005em] text-ink">
                {c.title}
              </h4>
              <RiskBadge level={c.risk_level} />
            </div>
            <p className="t-reading line-clamp-3 text-[14px] text-ink-2">
              {c.plain_english}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One full diff row: category kicker + verdict chip → two side columns. */
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
      className="flex flex-col gap-3 border-b border-paper-edge py-5 last:border-b-0"
      data-testid="diff-row"
      data-category={group.category}
      data-verdict={group.verdict}
    >
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[1.5px] text-ink">
          {tCat(group.category)}
        </span>
        <span className={verdictChipClass(group.verdict)}>
          {tRow(verdictLabelKey(group.verdict))}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SideColumn
          clauses={group.clausesA}
          highlighted={highlightedA}
          emptyLabel={t("noMatchingClause")}
          rail="ink"
        />
        <SideColumn
          clauses={group.clausesB}
          highlighted={highlightedB}
          emptyLabel={t("noMatchingClause")}
          rail="red"
        />
      </div>
    </div>
  );
}
