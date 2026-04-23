/** Individual clause card with expandable risk details. */

"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { AnalyzedClause } from "@/types";
import { RiskBadge } from "@/components/RiskBadge";
import { ClauseExplanation } from "@/components/ClauseExplanation";
import { ApplicableLawCite } from "@/components/ApplicableLawCite";

const BORDER_COLORS = {
  high: "border-l-[var(--risk-high)]",
  medium: "border-l-[var(--risk-medium)]",
  low: "border-l-[var(--risk-low)]",
  informational: "border-l-[var(--risk-info)]",
} as const;

interface ClauseCardProps {
  clause: AnalyzedClause;
  onAskAbout?: (clause: AnalyzedClause) => void;
  /**
   * SP-10 Arc 3 Task 3.4 — open the similar-clauses drawer for this
   * clause. Optional so the live-analysis view (which has no saved id
   * yet and therefore no meaningful self-filter) can simply omit it
   * without rendering a broken affordance.
   */
  onFindSimilar?: (clause: AnalyzedClause) => void;
}

/** Renders a single clause with risk badge, category, and expandable details. */
export function ClauseCard({ clause, onAskAbout, onFindSimilar }: ClauseCardProps) {
  const t = useTranslations("ClauseCard");
  const tCat = useTranslations("ClauseCategory");
  const [expanded, setExpanded] = useState(false);
  const cardId = useId().replace(/:/g, "-");
  // SP-7 Layer B' Phase 3 — the category pill is a canonical enum
  // (non_compete, ip_assignment, …) rendered as a localized display
  // label from the ClauseCategory namespace. Pre-Phase-3 the pill was
  // `clause.category.replace(/_/g, " ").toUpperCase()`, which always
  // rendered English regardless of UI locale.
  const categoryLabel = tCat(clause.category).toUpperCase();
  // Expand panel is offered whenever there is *something* inside it
  // to look at — risk details (non-informational), or a Magistral
  // chain-of-thought trace. An informational clause with a trace
  // still needs the affordance so the audit evidence is reachable.
  const hasDetails =
    clause.risk_level !== "informational" || Boolean(clause.reasoning);

  return (
    <div
      className={`rounded border border-[var(--border-primary)] border-l-4 bg-[var(--bg-card)] p-5 theme-transition ${BORDER_COLORS[clause.risk_level]}`}
    >
      <div className="mb-2.5 flex items-start gap-2.5">
        <RiskBadge level={clause.risk_level} />
        <span className="rounded bg-[var(--bg-tertiary)] px-2.5 py-0.5 text-sm text-[var(--text-tertiary)] font-[var(--font-body)]">
          {categoryLabel}
        </span>
        {clause.is_unusual && (
          <span className="rounded border border-[var(--risk-unusual-border)] bg-[var(--risk-unusual-bg)] px-2.5 py-0.5 text-sm font-semibold text-[var(--risk-unusual)] font-[var(--font-body)]">
            {t("atypical")}
          </span>
        )}
      </div>

      <h3 className="mb-1.5 text-lg font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
        {clause.title}
      </h3>

      <ClauseExplanation
        plainEnglish={clause.plain_english}
        citations={clause.citations}
        clauseText={clause.clause_text}
        cardId={cardId}
      />

      {hasDetails && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2.5 text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
        >
          {expanded ? t("hideDetails") : t("showDetails")}
        </button>
      )}

      {expanded && (
        <div className="mt-3.5 rounded bg-[var(--bg-secondary)] p-3.5 text-[15px] leading-relaxed text-[var(--text-secondary)] font-[var(--font-body)]">
          <p>
            <strong className="text-[var(--accent)]">{t("risk")}</strong>{" "}
            {clause.risk_explanation}
          </p>
          {clause.negotiation_suggestion && (
            <p className="mt-2.5">
              <strong className="text-blue-600 dark:text-blue-400">{t("suggestion")}</strong>{" "}
              {clause.negotiation_suggestion}
            </p>
          )}
          {clause.unusual_explanation && (
            <p className="mt-2.5">
              <strong className="text-[var(--risk-unusual)]">{t("unusual")}</strong>{" "}
              {clause.unusual_explanation}
            </p>
          )}
          {clause.applicable_law && (
            <ApplicableLawCite applicableLaw={clause.applicable_law} />
          )}
          <details className="mt-2.5">
            <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              {t("originalText")}
            </summary>
            <p className="mt-1.5 whitespace-pre-wrap font-mono text-sm text-[var(--text-tertiary)]">
              {clause.clause_text}
            </p>
          </details>
          {clause.reasoning && (
            <details
              className="mt-2.5"
              data-testid="clause-reasoning"
            >
              <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                {t("reasoning")}
              </summary>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--text-tertiary)]">
                {clause.reasoning}
              </p>
            </details>
          )}
          {(onAskAbout || onFindSimilar) && (
            <div className="mt-3 flex flex-wrap gap-4">
              {onAskAbout && (
                <button
                  type="button"
                  onClick={() => onAskAbout(clause)}
                  className="text-[13px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
                >
                  {t("askAbout")}
                </button>
              )}
              {onFindSimilar && (
                <button
                  type="button"
                  onClick={() => onFindSimilar(clause)}
                  className="text-[13px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
                  data-testid="clause-find-similar"
                >
                  {t("findSimilar")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
