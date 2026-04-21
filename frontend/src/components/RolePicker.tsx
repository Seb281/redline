/**
 * Prompt the user to declare which party they are in the contract
 * before the slower extraction + analysis passes run.
 *
 * SP-1.9: Buttons render the role label ("I'm the Provider") by default
 * — after redaction the contract itself refers to `⟦PROVIDER⟧`, so the
 * user sees the same abstraction. The party's legal name is only
 * disclosed when the global "Show real names" toggle is on.
 *
 * The picked value is the canonical label (e.g. "PROVIDER"), which is
 * what gets threaded into the Pass 1/2 prompts as the framing role.
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Party } from "@/types";
import { useRehydrate } from "@/contexts/RehydrateContext";
import { BorderedCard } from "@/components/ui/BorderedCard";
import { Button } from "@/components/ui/Button";
import { MonoLabel } from "@/components/ui/MonoLabel";

interface RolePickerProps {
  /** Parties extracted by Pass 0 (parallel to `labels`). */
  parties: Party[];
  /** Canonical labels as edited by the user in the RedactionPreview. */
  labels: string[];
  /** Called with the picked label, `Other` free-text, or null for Skip. */
  onPick: (role: string | null) => void;
}

/**
 * Turn a canonical label into human-readable display text:
 * `DISCLOSING_PARTY` → `Disclosing Party`, `PROVIDER` → `Provider`.
 */
function titleCase(label: string): string {
  return label
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/** Inline card shown while `status === "awaiting_role"`. */
export function RolePicker({ parties, labels, onPick }: RolePickerProps) {
  const t = useTranslations("RolePicker");
  const { rehydrate } = useRehydrate();
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  const handleOtherConfirm = () => {
    const trimmed = otherValue.trim();
    if (trimmed.length === 0) return;
    onPick(trimmed);
  };

  return (
    <BorderedCard tone="ink" padding="lg" className="mb-8">
      <MonoLabel tone="red" className="block">
        {t("label")}
      </MonoLabel>
      <h3 className="mt-3 font-serif text-[28px] font-light leading-[1.05] tracking-[-0.01em] text-ink md:text-[32px]">
        {t("heading")}
      </h3>
      <p className="t-reading mt-3 max-w-[60ch] text-[15px] text-ink-2">
        {t("description")}
      </p>

      {/* One button per party — label-first, with optional legal-name sub-label
          when the user has flipped the global "Show real names" toggle. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {parties.map((party, i) => {
          const label = labels[i] ?? "PARTY";
          const pretty = titleCase(label) || t("defaultPartyName");
          return (
            <button
              key={`${label}-${i}`}
              type="button"
              onClick={() => onPick(label)}
              className="group flex flex-col items-start gap-1.5 border border-paper-edge bg-paper px-5 py-4 text-left transition-colors hover:border-ink hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink"
            >
              <MonoLabel tone="muted" className="group-hover:text-red-accent">
                0{i + 1}
              </MonoLabel>
              <span className="font-serif text-[20px] leading-tight tracking-[-0.01em] text-ink">
                {t("imThe", { role: pretty })}
              </span>
              {rehydrate && (
                <span className="t-reading text-[13px] text-ink-muted">
                  {party.name}
                </span>
              )}
            </button>
          );
        })}

        {!otherOpen && (
          <button
            type="button"
            onClick={() => setOtherOpen(true)}
            className="flex flex-col items-start gap-1.5 border border-dashed border-paper-edge bg-transparent px-5 py-4 text-left transition-colors hover:border-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink"
          >
            <MonoLabel tone="muted">{t("other")}</MonoLabel>
          </button>
        )}
      </div>

      {otherOpen && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            autoFocus
            value={otherValue}
            onChange={(e) => setOtherValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleOtherConfirm();
              }
            }}
            placeholder={t("otherPlaceholder")}
            className="min-w-[220px] flex-1 border border-ink bg-paper px-3 py-2 font-serif text-[15px] text-ink placeholder:font-mono placeholder:text-[12px] placeholder:uppercase placeholder:tracking-[1.2px] placeholder:text-ink-muted focus:border-red-accent focus:outline-none"
          />
          <Button
            variant="primary"
            size="md"
            onClick={handleOtherConfirm}
            disabled={otherValue.trim().length === 0}
          >
            {t("confirm")}
          </Button>
        </div>
      )}

      {/* Skip — keeps default weaker-party framing for Pass 2 */}
      <div className="mt-6 border-t border-paper-edge pt-4">
        <button
          type="button"
          onClick={() => onPick(null)}
          className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent"
        >
          {t("skipNeutral")}
        </button>
      </div>
    </BorderedCard>
  );
}
