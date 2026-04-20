/**
 * Pill-tab filter bar for the comparison view.
 *
 * Options:
 *   - all           — every category group
 *   - differences   — everything except `same` (higher_in_* + unique_*)
 *   - higher_in_a   — only groups where A carries the heavier max risk
 *   - higher_in_b   — mirror of the above
 *   - unique        — categories present on exactly one side
 *
 * Filtering is a pure UI concern; the engine never drops groups.
 */

"use client";

import { useTranslations } from "next-intl";
import type { CompareFilter } from "@/lib/compare/types";

interface DiffFilterBarProps {
  value: CompareFilter;
  onChange: (next: CompareFilter) => void;
  /** Display labels A / B so the "higher in A" option reads the contract name. */
  labelA: string;
  labelB: string;
}

/** Ordered list of filter values — controls tab order. */
const FILTER_VALUES: readonly CompareFilter[] = [
  "all",
  "differences",
  "higher_in_a",
  "higher_in_b",
  "unique",
] as const;

/** Renders the 5 filter tabs as a horizontally scrollable row. */
export function DiffFilterBar({
  value,
  onChange,
  labelA,
  labelB,
}: DiffFilterBarProps) {
  const t = useTranslations("Compare");

  const labelFor = (f: CompareFilter): string => {
    switch (f) {
      case "all":
        return t("filterAll");
      case "differences":
        return t("filterDifferences");
      case "higher_in_a":
        return t("filterHigherIn", { label: labelA });
      case "higher_in_b":
        return t("filterHigherIn", { label: labelB });
      case "unique":
        return t("filterUnique");
    }
  };

  return (
    <div
      role="tablist"
      aria-label={t("filterGroupLabel")}
      className="flex flex-wrap gap-2"
    >
      {FILTER_VALUES.map((f) => {
        const active = f === value;
        return (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(f)}
            className={[
              "rounded-full border px-3 py-1 text-[12px] font-[var(--font-body)] transition-colors theme-transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
              active
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-primary)]"
                : "border-[var(--border-primary)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--accent)]",
            ].join(" ")}
          >
            {labelFor(f)}
          </button>
        );
      })}
    </div>
  );
}
