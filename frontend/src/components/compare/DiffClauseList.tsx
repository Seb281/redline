/**
 * Filtered list of `DiffClauseRow`s.
 *
 * Filtering rules mirror the `CompareFilter` enum in `lib/compare/types.ts`:
 *   - all          — every group
 *   - differences  — anything except verdict === "same"
 *   - higher_in_a  — verdict === "higher_in_a"
 *   - higher_in_b  — verdict === "higher_in_b"
 *   - unique       — verdict === "unique_to_a" || "unique_to_b"
 *
 * When no groups match, renders an empty-state message so the user
 * isn't staring at a silent hole in the page.
 */

"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type {
  CompareFilter,
  ComparisonGroup,
} from "@/lib/compare/types";
import { DiffClauseRow } from "./DiffClauseRow";

interface DiffClauseListProps {
  groups: ComparisonGroup[];
  filter: CompareFilter;
}

/** Applies the active filter against a ComparisonGroup array. */
function applyFilter(
  groups: ComparisonGroup[],
  filter: CompareFilter,
): ComparisonGroup[] {
  switch (filter) {
    case "all":
      return groups;
    case "differences":
      return groups.filter((g) => g.verdict !== "same");
    case "higher_in_a":
      return groups.filter((g) => g.verdict === "higher_in_a");
    case "higher_in_b":
      return groups.filter((g) => g.verdict === "higher_in_b");
    case "unique":
      return groups.filter(
        (g) => g.verdict === "unique_to_a" || g.verdict === "unique_to_b",
      );
  }
}

/** Composes filtered rows; shows an empty-state when nothing matches. */
export function DiffClauseList({ groups, filter }: DiffClauseListProps) {
  const t = useTranslations("Compare");
  const filtered = useMemo(() => applyFilter(groups, filter), [groups, filter]);

  if (filtered.length === 0) {
    return (
      <p
        className="rounded border border-dashed border-[var(--border-primary)] px-4 py-6 text-center text-[13px] italic text-[var(--text-muted)] font-[var(--font-body)]"
        data-testid="diff-empty"
      >
        {t("noMatchingFilter")}
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {filtered.map((g) => (
        <DiffClauseRow key={g.category} group={g} />
      ))}
    </div>
  );
}
