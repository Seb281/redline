/**
 * AnalysisProgress — editorial 6-step pipeline indicator.
 *
 * Six steps sit on a shared baseline rule (Upload → Overview →
 * Redact → Role → Analysis → Complete). Each cell shows a mono
 * numeral, the step label, and a red accent bar while active so
 * the user always knows which pass is running. A clause counter
 * drops in under step 4 while extraction is streaming.
 */

"use client";

import { useTranslations } from "next-intl";
import type { StreamingAnalysisState } from "@/hooks/useStreamingAnalysis";

interface AnalysisProgressProps {
  /** Current analysis status from useStreamingAnalysis. */
  status: StreamingAnalysisState["status"];
  /** Number of clauses analyzed so far. */
  analyzedCount: number;
  /** Total clause count from extraction pass (null until known). */
  totalCount: number | null;
}

const STEP_KEYS = [
  "stepUpload",
  "stepOverview",
  "stepRedact",
  "stepRole",
  "stepAnalysis",
  "stepComplete",
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

export function AnalysisProgress({
  status,
  analyzedCount,
  totalCount,
}: AnalysisProgressProps) {
  const t = useTranslations("AnalysisProgress");
  const activeStep = getActiveStep(status);
  const isError = status === "error";
  const percent =
    status === "analyzing" && totalCount && totalCount > 0
      ? Math.min(100, Math.round((analyzedCount / totalCount) * 100))
      : 0;

  return (
    <div className="mb-8">
      <ol className="grid grid-cols-2 border-t border-b border-ink sm:grid-cols-3 md:grid-cols-6">
        {STEP_KEYS.map((stepKey, i) => {
          const isComplete = !isError && activeStep > i;
          const isActive = !isError && activeStep === i;
          const tone = isActive
            ? "text-ink"
            : isComplete
              ? "text-ink-2"
              : "text-ink-muted";
          return (
            <li
              key={stepKey}
              aria-current={isActive ? "step" : undefined}
              className={`relative flex flex-col gap-2 border-paper-edge px-3 py-4 md:border-r md:last:border-r-0 ${
                isActive ? "bg-paper-2" : ""
              }`}
            >
              {/* Active top accent — the red running line narrowed to a step */}
              <span
                aria-hidden
                className={`absolute inset-x-0 top-0 h-[2px] transition-colors ${
                  isActive
                    ? "bg-red-accent"
                    : isComplete
                      ? "bg-ink"
                      : "bg-transparent"
                }`}
              />
              <span className="font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`font-serif text-[17px] leading-tight tracking-[-0.01em] ${tone}`}
              >
                {t(stepKey)}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Sub-status line — parks under the step row */}
      <div className="mt-3 flex min-h-[18px] flex-wrap items-center gap-x-6 gap-y-1">
        {status === "analyzing_overview" && (
          <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
            {t("extracting")}
          </span>
        )}
        {status === "awaiting_redaction" && (
          <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
            {t("reviewMasked")}
          </span>
        )}
        {status === "awaiting_role" && (
          <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
            {t("selectPerspective")}
          </span>
        )}
        {status === "analyzing" && totalCount !== null && (
          <div className="flex w-full items-center gap-4">
            <div className="h-px flex-1 overflow-hidden bg-paper-edge">
              <div
                className="h-full bg-red-accent transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-2">
              {analyzedCount < totalCount
                ? t("analyzingClause", {
                    n: analyzedCount + 1,
                    total: totalCount,
                  })
                : t("allClausesDone", { total: totalCount })}
            </span>
          </div>
        )}
        {status === "analyzing" && totalCount === null && (
          <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
            {t("extractingClauses")}
          </span>
        )}
        {status === "complete" && (
          <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-ok">
            {t("complete")}
          </span>
        )}
      </div>
    </div>
  );
}
