/**
 * Prompt the user to declare which party they are in the contract
 * before the slower extraction + analysis passes run. Shows the parties
 * extracted by Pass 0 as buttons, plus a free-text "Other" fallback and
 * a "Skip" link that keeps the default weaker-party framing.
 */

"use client";

import { useState } from "react";

interface RolePickerProps {
  parties: string[];
  /** Called with the picked role, or null for "skip". */
  onPick: (role: string | null) => void;
}

/** Inline card shown while `status === "awaiting_role"`. */
export function RolePicker({ parties, onPick }: RolePickerProps) {
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

      {/* Extracted party buttons */}
      <div className="flex flex-wrap gap-2.5">
        {parties.map((party) => (
          <button
            key={party}
            type="button"
            onClick={() => onPick(party)}
            className="rounded border border-[var(--border-primary)] bg-[var(--bg-card)] px-4 py-2.5 text-[15px] font-medium text-[var(--text-primary)] font-[var(--font-body)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)]"
          >
            I&apos;m {party}
          </button>
        ))}

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

      {/* Skip */}
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
