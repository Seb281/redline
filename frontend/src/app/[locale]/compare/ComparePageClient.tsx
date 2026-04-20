/**
 * Orchestrates the two compare slots and renders the diff view once
 * both are ready.
 *
 * State ownership:
 *   - two `useCompareSlot()` instances (one per side)
 *   - a `CompareFilter` for the filter bar
 *   - the memoised `PreparedComparison` derived from both slots
 *
 * On mount we check two pre-fill sources in order:
 *   1. `takeCarriedAnalysis()` — ReportView handoff, hydrates slot A.
 *   2. `?a=<id>&b=<id>` query params — history multi-select handoff.
 *
 * `buildComparison` is pure and cheap, so we just recompute whenever
 * either slot's clause array changes. The diff view only renders when
 * both slots are in `ready` status; otherwise the slot cards stand
 * alone so the user can fill the empty side.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCompareSlot } from "@/hooks/useCompareSlot";
import { buildComparison } from "@/lib/compare/engine";
import { takeCarriedAnalysis } from "@/lib/compare/session";
import type { CompareFilter } from "@/lib/compare/types";
import { ContractSlotCard } from "@/components/compare/ContractSlotCard";
import { RadarComparison } from "@/components/compare/RadarComparison";
import { ComparisonSummaryBar } from "@/components/compare/ComparisonSummaryBar";
import { DiffFilterBar } from "@/components/compare/DiffFilterBar";
import { DiffClauseList } from "@/components/compare/DiffClauseList";

/** Full compare page — client-side so it can use sessionStorage + hooks. */
export function ComparePageClient() {
  const t = useTranslations("Compare");

  const slotA = useCompareSlot();
  const slotB = useCompareSlot();
  const [filter, setFilter] = useState<CompareFilter>("all");

  const searchParams = useSearchParams();

  // Mount-only: replay ReportView carry-over and/or ?a/?b query params.
  // Carry-over wins over `?a` so the report's hand-off cannot be
  // silently clobbered by a leftover query string; `?b` is always
  // honoured because carry-over only ever populates side A.
  useEffect(() => {
    const carried = takeCarriedAnalysis();
    if (carried) {
      slotA.setReady(carried.data, carried.label);
    }

    const a = searchParams?.get("a");
    const b = searchParams?.get("b");
    if (a && !carried) {
      void slotA.loadSavedAnalysis(a, a);
    }
    if (b) {
      void slotB.loadSavedAnalysis(b, b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bothReady =
    slotA.slot.status === "ready" && slotB.slot.status === "ready";

  const prepared = useMemo(() => {
    if (slotA.slot.status !== "ready" || slotB.slot.status !== "ready") {
      return null;
    }
    return buildComparison(slotA.slot.data.clauses, slotB.slot.data.clauses);
  }, [slotA.slot, slotB.slot]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-9 sm:px-7">
      <header className="mb-6">
        <h1 className="text-xl font-medium text-[var(--text-primary)] font-[var(--font-heading)]">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)] font-[var(--font-body)]">
          {t("pageSubtitle")}
        </p>
      </header>

      <section
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
        data-testid="compare-slots"
      >
        <ContractSlotCard
          side="A"
          slot={slotA.slot}
          onLoadSample={(sample, label) =>
            void slotA.loadSample(sample, label)
          }
          onLoadSaved={(id, label) =>
            void slotA.loadSavedAnalysis(id, label)
          }
          onClear={slotA.clear}
        />
        <ContractSlotCard
          side="B"
          slot={slotB.slot}
          onLoadSample={(sample, label) =>
            void slotB.loadSample(sample, label)
          }
          onLoadSaved={(id, label) =>
            void slotB.loadSavedAnalysis(id, label)
          }
          onClear={slotB.clear}
        />
      </section>

      {bothReady && prepared && slotA.slot.status === "ready" && slotB.slot.status === "ready" && (
        <section className="mt-8 flex flex-col gap-6" data-testid="compare-diff">
          <RadarComparison
            labelA={slotA.slot.label}
            labelB={slotB.slot.label}
            clausesA={slotA.slot.data.clauses}
            clausesB={slotB.slot.data.clauses}
          />

          <ComparisonSummaryBar
            stats={prepared.stats}
            labelA={slotA.slot.label}
            labelB={slotB.slot.label}
            overviewA={slotA.slot.data.overview}
            overviewB={slotB.slot.data.overview}
          />

          <DiffFilterBar
            value={filter}
            onChange={setFilter}
            labelA={slotA.slot.label}
            labelB={slotB.slot.label}
          />

          <DiffClauseList groups={prepared.groups} filter={filter} />
        </section>
      )}
    </main>
  );
}
