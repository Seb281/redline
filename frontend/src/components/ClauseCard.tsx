/** Individual clause card — editorial treatment with left risk rail. */

"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { AnalyzedClause, RiskLevel } from "@/types";
import { RiskBadge } from "@/components/RiskBadge";
import { ClauseExplanation } from "@/components/ClauseExplanation";
import { ApplicableLawCite } from "@/components/ApplicableLawCite";
import { MonoLabel } from "@/components/ui/MonoLabel";

/** Map risk level to the left-rail accent colour. */
const RAIL_COLORS: Record<RiskLevel, string> = {
  high: "border-l-red-accent",
  medium: "border-l-warn",
  low: "border-l-ok",
  informational: "border-l-paper-edge",
};

interface ClauseCardProps {
  clause: AnalyzedClause;
  onAskAbout?: (clause: AnalyzedClause) => void;
}

/** Renders a single clause with risk chip, category kicker, and expandable details. */
export function ClauseCard({ clause, onAskAbout }: ClauseCardProps) {
  const t = useTranslations("ClauseCard");
  const tCat = useTranslations("ClauseCategory");
  const [expanded, setExpanded] = useState(false);
  const cardId = useId().replace(/:/g, "-");
  // SP-7 Layer B' Phase 3 — the category pill is a canonical enum
  // (non_compete, ip_assignment, …) rendered as a localized display
  // label from the ClauseCategory namespace. Pre-Phase-3 the pill was
  // `clause.category.replace(/_/g, " ").toUpperCase()`, which always
  // rendered English regardless of UI locale.
  const categoryLabel = tCat(clause.category);
  const hasDetails = clause.risk_level !== "informational";

  return (
    <article
      className={`border border-paper-edge border-l-4 bg-paper p-5 ${RAIL_COLORS[clause.risk_level]}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <RiskBadge level={clause.risk_level} />
        <MonoLabel tone="muted">{categoryLabel}</MonoLabel>
        {clause.is_unusual && (
          <span className="border border-ink-muted bg-paper-2 px-2 py-[2px] font-mono text-[10px] font-semibold uppercase tracking-[1.4px] text-ink-2">
            {t("atypical")}
          </span>
        )}
      </div>

      <h3 className="mt-1 mb-3 font-serif text-[22px] font-light leading-tight tracking-[-0.01em] text-ink">
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
          className="mt-4 font-mono text-[10.5px] uppercase tracking-[1.5px] text-red-accent transition-colors hover:text-red-deep focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-accent"
        >
          {expanded ? t("hideDetails") : t("showDetails")}
        </button>
      )}

      {expanded && (
        <div className="mt-4 border-t border-paper-edge pt-4 text-[15px] leading-relaxed">
          <p className="t-reading text-ink-2">
            <MonoLabel tone="red" className="mr-2 inline">
              {t("risk")}
            </MonoLabel>
            {clause.risk_explanation}
          </p>
          {clause.negotiation_suggestion && (
            <p className="t-reading mt-3 text-ink-2">
              <MonoLabel tone="ink" className="mr-2 inline">
                {t("suggestion")}
              </MonoLabel>
              {clause.negotiation_suggestion}
            </p>
          )}
          {clause.unusual_explanation && (
            <p className="t-reading mt-3 text-ink-2">
              <MonoLabel tone="muted" className="mr-2 inline">
                {t("unusual")}
              </MonoLabel>
              {clause.unusual_explanation}
            </p>
          )}
          {clause.applicable_law && (
            <ApplicableLawCite applicableLaw={clause.applicable_law} />
          )}
          <details className="mt-4 border-t border-paper-edge pt-3">
            <summary className="cursor-pointer font-mono text-[10.5px] uppercase tracking-[1.5px] text-ink-muted transition-colors hover:text-red-accent">
              {t("originalText")}
            </summary>
            <p className="mt-2 whitespace-pre-wrap font-mono text-[12px] text-ink-2">
              {clause.clause_text}
            </p>
          </details>
          {onAskAbout && (
            <button
              type="button"
              onClick={() => onAskAbout(clause)}
              className="mt-4 font-mono text-[10.5px] uppercase tracking-[1.5px] text-red-accent transition-colors hover:text-red-deep"
            >
              {t("askAbout")}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
