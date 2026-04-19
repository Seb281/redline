/**
 * Quick / Smart mode radio toggle for the /redact flow.
 *
 * WHY this exists separately from the Fast/Deep toggle on the main page:
 * The Quick/Smart distinction is specific to the redact flow (it controls
 * whether we call the LLM at all), while Fast/Deep is a pass-2 depth
 * toggle. Keeping them separate avoids conflating two different concerns.
 *
 * Styled identically to the Fast/Deep segmented toggle in page.tsx so the
 * visual language stays consistent, but the semantics are distinct.
 */

"use client";

import type { RedactMode } from "@/lib/redact-export/types";

interface RedactModeToggleProps {
  mode: RedactMode;
  onChange: (mode: RedactMode) => void;
  /** Disable the toggle while the pipeline is running. */
  disabled?: boolean;
}

/** Quick = zero LLM (pattern-only). Smart = Pass 0 for semantic role labels. */
export function RedactModeToggle({
  mode,
  onChange,
  disabled = false,
}: RedactModeToggleProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-1">
        <button
          type="button"
          onClick={() => onChange("quick")}
          disabled={disabled}
          className={`rounded px-5 py-2 text-[15px] font-medium font-[var(--font-body)] transition-colors ${
            mode === "quick"
              ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Quick
        </button>
        <button
          type="button"
          onClick={() => onChange("smart")}
          disabled={disabled}
          className={`rounded px-5 py-2 text-[15px] font-medium font-[var(--font-body)] transition-colors ${
            mode === "smart"
              ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Smart
        </button>
      </div>
      <p className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">
        {mode === "quick"
          ? "Pattern-only — zero AI, instant, fully private"
          : "AI role labels — scrubbed text sent to Mistral (EU)"}
      </p>
    </div>
  );
}
