/**
 * One of the two compare-page slots.
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
    <div className="flex flex-col gap-3">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] font-[var(--font-heading)]">
        {t("pickerSamplesHeading")}
      </p>
      <div className="flex flex-col gap-2">
        {SAMPLE_ENTRIES.map((sample) => {
          const label = tSamples(sample.labelKey);
          return (
            <button
              key={sample.id}
              type="button"
              onClick={() => onPickSample(sample, label)}
              className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-2 text-left text-[13px] text-[var(--text-secondary)] font-[var(--font-body)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] theme-transition"
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 border-t border-[var(--border-primary)] pt-3">
        {isAuthenticated ? (
          <>
            <button
              type="button"
              onClick={onPickSavedReveal}
              aria-expanded={savedOpen}
              className="text-[13px] text-[var(--accent)] underline underline-offset-2 hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {savedOpen ? t("pickerSavedHide") : t("pickerSavedShow")}
            </button>
            {savedOpen && (
              <div className="mt-2 flex flex-col gap-1.5">
                {savedLoading && (
                  <p className="text-[12px] italic text-[var(--text-muted)] font-[var(--font-body)]">
                    {t("pickerSavedLoading")}
                  </p>
                )}
                {savedError && (
                  <p className="text-[12px] text-[var(--risk-high)] font-[var(--font-body)]">
                    {savedError}
                  </p>
                )}
                {!savedLoading && !savedError && savedList.length === 0 && (
                  <p className="text-[12px] italic text-[var(--text-muted)] font-[var(--font-body)]">
                    {t("pickerSavedEmpty")}
                  </p>
                )}
                {savedList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onPickSaved(item)}
                    className="truncate rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-left text-[12px] text-[var(--text-secondary)] font-[var(--font-body)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] theme-transition"
                    title={item.filename}
                  >
                    {item.filename}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-[12px] italic text-[var(--text-muted)] font-[var(--font-body)]">
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

  return (
    <section
      className="flex flex-col gap-3 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 theme-transition"
      aria-label={heading}
      data-testid={`slot-${side}`}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] font-[var(--font-heading)]">
          {heading}
        </h2>
        {slot.status !== "empty" && (
          <button
            type="button"
            onClick={onClear}
            className="text-[12px] text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {t("slotRemove")}
          </button>
        )}
      </header>

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
        <div className="flex items-center gap-3 py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />
          <p className="text-[13px] text-[var(--text-muted)] font-[var(--font-body)]">
            {t("slotLoading", { label: slot.label })}
          </p>
        </div>
      )}

      {slot.status === "error" && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-[var(--risk-high)] font-[var(--font-body)]">
            {slot.message}
          </p>
          <button
            type="button"
            onClick={onClear}
            className="self-start rounded border border-[var(--border-primary)] px-3 py-1 text-[12px] text-[var(--text-secondary)] font-[var(--font-body)] hover:border-[var(--accent)]"
          >
            {t("slotTryAgain")}
          </button>
        </div>
      )}

      {slot.status === "ready" && (
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold text-[var(--text-primary)] font-[var(--font-body)]">
            {slot.label}
          </p>
          <p className="text-[12px] text-[var(--text-muted)] font-[var(--font-body)]">
            {slot.data.overview.contract_type}
            {slot.data.overview.governing_jurisdiction
              ? ` · ${slot.data.overview.governing_jurisdiction}`
              : ""}
          </p>
          <p className="text-[12px] text-[var(--text-muted)] font-[var(--font-body)]">
            {t("clauses", { count: slot.data.clauses.length })}
          </p>
        </div>
      )}
    </section>
  );
}
