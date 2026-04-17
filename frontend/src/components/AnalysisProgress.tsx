/** Horizontal step indicator with clause counter for the analysis pipeline. */

"use client";

import type { StreamingAnalysisState } from "@/hooks/useStreamingAnalysis";

interface AnalysisProgressProps {
  /** Current analysis status from useStreamingAnalysis. */
  status: StreamingAnalysisState["status"];
  /** Number of clauses analyzed so far. */
  analyzedCount: number;
  /** Total clause count from extraction pass (null until known). */
  totalCount: number | null;
}

const STEPS = [
  { label: "Upload" },
  { label: "Overview" },
  { label: "Redact" },
  { label: "Role" },
  { label: "Analysis" },
  { label: "Complete" },
] as const;

/** Map streaming status to the currently active step index (0-based). */
function getActiveStep(status: StreamingAnalysisState["status"]): number {
  switch (status) {
    case "idle":
      return 0;
    case "analyzing_overview":
      return 1;
    case "awaiting_redaction":
      return 2;
    case "awaiting_role":
      return 3;
    case "analyzing":
      return 4;
    case "complete":
      return 5;
    case "error":
      return -1;
  }
}

/**
 * Five-step horizontal stepper that maps to `useStreamingAnalysis`
 * states. Shows a progress bar with clause counter during step 4.
 * Pure presentational — all state comes from props.
 */
export function AnalysisProgress({
  status,
  analyzedCount,
  totalCount,
}: AnalysisProgressProps) {
  const activeStep = getActiveStep(status);
  const isError = status === "error";

  return (
    <div className="mb-8">
      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const isComplete = !isError && activeStep > i;
          const isActive = !isError && activeStep === i;

          return (
            <div key={step.label} className="flex flex-1 items-center">
              {/* Step circle + label */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium font-[var(--font-body)] transition-colors ${
                    isComplete
                      ? "bg-[var(--accent)] text-white"
                      : isActive
                        ? "border-2 border-[var(--accent)] text-[var(--accent)]"
                        : "border-2 border-[var(--border-secondary)] text-[var(--text-muted)]"
                  }`}
                >
                  {isComplete ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`mt-1.5 text-xs font-medium font-[var(--font-body)] ${
                    isActive
                      ? "text-[var(--accent)]"
                      : isComplete
                        ? "text-[var(--text-secondary)]"
                        : "text-[var(--text-muted)]"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line (not after last step) */}
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-[2px] flex-1 transition-colors ${
                    !isError && activeStep > i
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--border-secondary)]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Subtitle / clause counter */}
      <div className="mt-3 text-center">
        {status === "analyzing_overview" && (
          <p className="text-sm text-[var(--text-tertiary)] font-[var(--font-body)]">
            Extracting contract metadata...
          </p>
        )}
        {status === "awaiting_redaction" && (
          <p className="text-sm text-[var(--text-tertiary)] font-[var(--font-body)]">
            Review what will be masked
          </p>
        )}
        {status === "awaiting_role" && (
          <p className="text-sm text-[var(--text-tertiary)] font-[var(--font-body)]">
            Select your perspective
          </p>
        )}
        {status === "analyzing" && totalCount !== null && (
          <div className="mx-auto max-w-xs">
            <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{
                  width: `${Math.round((analyzedCount / totalCount) * 100)}%`,
                }}
              />
            </div>
            <p className="text-sm text-[var(--text-tertiary)] font-[var(--font-body)]">
              {analyzedCount < totalCount
                ? `Analyzing clause ${analyzedCount + 1} of ${totalCount}...`
                : `All ${totalCount} clauses analyzed`}
            </p>
          </div>
        )}
        {status === "analyzing" && totalCount === null && (
          <p className="text-sm text-[var(--text-tertiary)] font-[var(--font-body)]">
            Extracting clauses...
          </p>
        )}
        {status === "complete" && (
          <p className="text-sm text-green-600 font-[var(--font-body)] dark:text-green-400">
            Analysis complete
          </p>
        )}
      </div>
    </div>
  );
}
