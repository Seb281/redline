/**
 * One of the two compare-page slots — editorial paper/ink treatment.
 *
 * Slot A renders with a 1px ink border; Slot B with a 2px red accent
 * border so the two columns read as a masthead-style A vs B spread.
 *
 * Purely presentational — all lifecycle lives in the parent's
 * `useCompareSlot` instance. The parent wires `slot` + loader callbacks
 * down via props so the comparison owner can observe both halves and
 * trigger `buildComparison` on the `empty → ready` transition.
 *
 * Rendering has four visual states driven by `slot.status`:
 *   - empty   → sample picker + optional "load saved" reveal
 *   - loading → spinner + the label that's being loaded
 *   - error   → inline error + clear button
 *   - ready   → compact metadata header with a "remove" button
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import {
  SAMPLE_ENTRIES,
  type SampleEntry,
} from "@/lib/compare/samples";
import type { CompareSlot } from "@/lib/compare/types";
import { listAnalyses } from "@/lib/api";
import type { AnalysisListItem } from "@/types";
import { BorderedCard } from "@/components/ui/BorderedCard";
import { Button } from "@/components/ui/Button";
import { MonoLabel } from "@/components/ui/MonoLabel";

/** Controlled slot card. Loaders + `clear` live on the parent hook. */
interface ContractSlotCardProps {
  side: "A" | "B";
  slot: CompareSlot;
  onLoadSample: (sample: SampleEntry, label: string) => void;
  onLoadSaved: (id: string, label: string) => void;
  onClear: () => void;
}

/** Compact empty-state picker: sample list + saved-analysis disclosure. */
function EmptyPicker({
  onPickSample,
  onPickSavedReveal,
  savedOpen,
  savedList,
  savedLoading,
  savedError,
  onPickSaved,
  isAuthenticated,
}: {
  onPickSample: (entry: SampleEntry, label: string) => void;
  onPickSavedReveal: () => void;
  savedOpen: boolean;
  savedList: AnalysisListItem[];
  savedLoading: boolean;
  savedError: string | null;
  onPickSaved: (item: AnalysisListItem) => void;
  isAuthenticated: boolean;
}) {
  const t = useTranslations("Compare");
  const tSamples = useTranslations("Compare.samples");

  return (
    <div className="flex flex-col gap-4">
      <MonoLabel tone="muted">{t("pickerSamplesHeading")}</MonoLabel>
      <ul className="flex flex-col">
        {SAMPLE_ENTRIES.map((sample) => {
          const label = tSamples(sample.labelKey);
          return (
            <li
              key={sample.id}
              className="border-b border-paper-edge last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onPickSample(sample, label)}
                className="group flex w-full items-baseline justify-between gap-4 py-2.5 text-left transition-colors hover:bg-paper-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-ink"
              >
                <span className="t-reading text-[15px] text-ink-2 group-hover:text-ink">
                  {label}
                </span>
                <span
                  aria-hidden
                  className="font-mono text-[11px] uppercase tracking-[1.5px] text-ink-muted group-hover:text-red-accent"
                >
                  →
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-paper-edge pt-3">
        {isAuthenticated ? (
          <>
            <button
              type="button"
              onClick={onPickSavedReveal}
              aria-expanded={savedOpen}
              className="font-mono text-[11px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent focus:outline-none"
            >
              {savedOpen ? t("pickerSavedHide") : t("pickerSavedShow")}
            </button>
            {savedOpen && (
              <div className="mt-3 flex flex-col gap-1">
                {savedLoading && (
                  <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
                    {t("pickerSavedLoading")}
                  </p>
                )}
                {savedError && (
                  <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-red-accent">
                    {savedError}
                  </p>
                )}
                {!savedLoading && !savedError && savedList.length === 0 && (
                  <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
                    {t("pickerSavedEmpty")}
                  </p>
                )}
                {savedList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onPickSaved(item)}
                    className="truncate border border-paper-edge bg-paper px-3 py-1.5 text-left font-mono text-[12px] text-ink-2 transition-colors hover:border-ink hover:bg-paper-2 focus:outline-none"
                    title={item.filename}
                  >
                    {item.filename}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
            {t("pickerLoginToUseSaved")}
          </p>
        )}
      </div>
    </div>
  );
}

/** Purely presentational slot card — delegates every mutation upward. */
export function ContractSlotCard({
  side,
  slot,
  onLoadSample,
  onLoadSaved,
  onClear,
}: ContractSlotCardProps) {
  const t = useTranslations("Compare");
  const { isAuthenticated } = useAuth();

  const [savedOpen, setSavedOpen] = useState(false);
  const [savedList, setSavedList] = useState<AnalysisListItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const revealSaved = async () => {
    setSavedOpen(true);
    if (savedList.length > 0 || savedLoading) return;
    setSavedLoading(true);
    setSavedError(null);
    try {
      const rows = await listAnalyses();
      setSavedList(rows);
    } catch (err) {
      setSavedError(
        err instanceof Error ? err.message : t("errors.savedListFailed"),
      );
    } finally {
      setSavedLoading(false);
    }
  };

  const heading = side === "A" ? t("slotAHeading") : t("slotBHeading");
  const kickerTone = side === "A" ? "ink" : "red";
  const cardTone = side === "A" ? "ink" : "red";

  return (
    <BorderedCard
      tone={cardTone}
      padding="lg"
      aria-label={heading}
      data-testid={`slot-${side}`}
    >
      <header className="flex items-baseline justify-between gap-4 border-b border-paper-edge pb-3">
        <MonoLabel tone={kickerTone}>{heading}</MonoLabel>
        {slot.status !== "empty" && (
          <button
            type="button"
            onClick={onClear}
            className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent focus:outline-none"
          >
            {t("slotRemove")}
          </button>
        )}
      </header>

      <div className="mt-5">
        {slot.status === "empty" && (
          <EmptyPicker
            onPickSample={onLoadSample}
            onPickSavedReveal={revealSaved}
            savedOpen={savedOpen}
            savedList={savedList}
            savedLoading={savedLoading}
            savedError={savedError}
            onPickSaved={(item) => onLoadSaved(item.id, item.filename)}
            isAuthenticated={isAuthenticated}
          />
        )}

        {slot.status === "loading" && (
          <div className="flex items-center gap-3 py-6">
            <div className="h-4 w-4 animate-spin rounded-full border border-paper-edge border-t-ink" />
            <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
              {t("slotLoading", { label: slot.label })}
            </p>
          </div>
        )}

        {slot.status === "error" && (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-red-accent">
              {slot.message}
            </p>
            <Button variant="ghost" size="sm" onClick={onClear}>
              {t("slotTryAgain")}
            </Button>
          </div>
        )}

        {slot.status === "ready" && (
          <div className="flex flex-col gap-2">
            <h3 className="m-0 font-serif text-[22px] font-light leading-tight tracking-[-0.01em] text-ink">
              {slot.label}
            </h3>
            <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
              <span>{slot.data.overview.contract_type}</span>
              {slot.data.overview.governing_jurisdiction && (
                <>
                  <span aria-hidden className="mx-2">
                    ·
                  </span>
                  <span>{slot.data.overview.governing_jurisdiction}</span>
                </>
              )}
            </p>
            <p className="font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted">
              {t("clauses", { count: slot.data.clauses.length })}
            </p>
          </div>
        )}
      </div>
    </BorderedCard>
  );
}
