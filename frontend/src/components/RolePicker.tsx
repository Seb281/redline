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
import type { Party } from "@/types";
import { useRehydrate } from "@/contexts/RehydrateContext";

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
  const { rehydrate } = useRehydrate();
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  const handleOtherConfirm = () => {
    const trimmed = otherValue.trim();
    if (trimmed.length === 0) return;
    onPick(trimmed);
  };

  return (
    <div className="mb-7 rounded border border-[var(--accent)] bg-[var(--accent-subtle)] px-6 py-5 theme-transition">
      <p className="mb-1 text-[13px] font-semibold uppercase tracking-[2px] text-[var(--accent)] font-[var(--font-body)]">
        One quick question
      </p>
      <h3 className="mb-4 text-[20px] font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
        Which party are you in this contract?
      </h3>
      <p className="mb-5 text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)]">
        Risk is framed from your perspective — pick yourself, type in a
        different role, or skip for a neutral weaker-party analysis.
      </p>

      {/* One button per party — label-first, with optional legal-name sub-label
          when the user has flipped the global "Show real names" toggle. */}
      <div className="flex flex-wrap gap-2.5">
        {parties.map((party, i) => {
          const label = labels[i] ?? "PARTY";
          const pretty = titleCase(label) || "Party";
          return (
            <button
              key={`${label}-${i}`}
              type="button"
              onClick={() => onPick(label)}
              className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-4 py-2.5 text-left text-[15px] font-medium text-[var(--text-primary)] font-[var(--font-body)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)]"
            >
              <span>I&apos;m the {pretty}</span>
              {rehydrate && (
                <span className="block text-[12px] font-normal text-[var(--text-muted)]">
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
            className="rounded border border-dashed border-[var(--border-secondary)] bg-transparent px-4 py-2.5 text-[15px] text-[var(--text-tertiary)] font-[var(--font-body)] transition-colors hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            Other…
          </button>
        )}
      </div>

      {otherOpen && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
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
            placeholder="e.g. Subcontractor, Buyer, Lessee"
            className="min-w-[220px] flex-1 rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-[var(--font-body)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleOtherConfirm}
            disabled={otherValue.trim().length === 0}
            className="rounded bg-[var(--text-primary)] px-5 py-2.5 text-[15px] font-medium text-[var(--bg-primary)] font-[var(--font-body)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      )}

      {/* Skip — keeps default weaker-party framing for Pass 2 */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => onPick(null)}
          className="text-[15px] text-[var(--text-muted)] font-[var(--font-body)] hover:text-[var(--text-secondary)] hover:underline"
        >
          Skip — use default (weaker party)
        </button>
      </div>
    </div>
  );
}
