/**
 * Contract overview — editorial masthead showing contract metadata.
 *
 * Renders the contract type as a Fraunces headline, role-first party
 * line, and a standfirst grid of the key facts (effective date,
 * duration, jurisdiction with evidence pill, value). Key terms are
 * surfaced as an ink-ruled list below the masthead so they read as the
 * top-of-page abstract that opened the design brief.
 *
 * SP-1.9: Parties render as role labels by default (e.g. "Provider ·
 * Client"). The global "Show real names" toggle, exposed via
 * {@link useRehydrate}, switches to the rehydrated form
 * "Provider (ACME Corp) · Client (Beta LLC)" for private review.
 *
 * Consumers may pass `labels` explicitly (streaming path — carries the
 * user's edits from the RedactionPreview) or omit it (history path —
 * derived via heuristic + stored `role_label`).
 */

"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ContractOverview as ContractOverviewType } from "@/types";
import { useRehydrate } from "@/contexts/RehydrateContext";
import { deriveLabels } from "@/lib/history/adapt-overview";
import { Kicker } from "@/components/ui/Kicker";
import { MonoLabel } from "@/components/ui/MonoLabel";

interface ContractOverviewProps {
  overview: ContractOverviewType;
  /**
   * Canonical role labels parallel to `overview.parties`. When omitted,
   * labels are derived from party `role_label` + heuristic fallback.
   */
  labels?: string[];
}

/**
 * Turn a canonical label into human-readable display text:
 * `DISCLOSING_PARTY` → `Disclosing Party`.
 */
function titleCase(label: string): string {
  return label
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/** Mono uppercase tone classes for the jurisdiction-evidence chip. */
function evidenceToneClass(sourceType: "stated" | "inferred" | "unknown"): string {
  if (sourceType === "stated") return "border-ok/60 text-ok bg-ok-soft";
  if (sourceType === "inferred") return "border-warn/60 text-warn bg-warn-soft";
  return "border-paper-edge text-ink-muted bg-paper-2";
}

/** Renders structured contract metadata at the top of the report. */
export function ContractOverview({ overview, labels }: ContractOverviewProps) {
  const t = useTranslations("ContractOverview");
  const { rehydrate } = useRehydrate();
  const resolvedLabels = labels ?? deriveLabels(overview);

  // Role-first display; legal name disclosed only when rehydrate is on.
  const partyDisplay = overview.parties
    .map((party, i) => {
      const label = resolvedLabels[i];
      const pretty = label ? titleCase(label) : party.name;
      return rehydrate ? `${pretty} (${party.name})` : pretty;
    })
    .join(" · ");

  /** Standfirst cells — built piecewise so absent fields collapse. */
  const cells: { kicker: string; value: ReactNode }[] = [];
  if (overview.effective_date) {
    cells.push({ kicker: t("effectiveLabel"), value: overview.effective_date });
  }
  if (overview.duration) {
    cells.push({ kicker: t("durationLabel"), value: overview.duration });
  }
  if (overview.total_value) {
    cells.push({ kicker: t("valueLabel"), value: overview.total_value });
  }
  if (overview.jurisdiction_evidence) {
    cells.push({
      kicker: t("jurisdictionLabel"),
      value: (
        <span className="inline-flex flex-wrap items-baseline gap-2">
          <span>{overview.governing_jurisdiction ?? "—"}</span>
          <span
            data-testid="jurisdiction-pill"
            title={overview.jurisdiction_evidence.source_text ?? undefined}
            className={`inline-block border px-1.5 py-[1px] font-mono text-[9.5px] font-semibold uppercase tracking-[1.2px] ${evidenceToneClass(overview.jurisdiction_evidence.source_type)}`}
          >
            {t(`jurisdictionEvidence.${overview.jurisdiction_evidence.source_type}`)}
          </span>
        </span>
      ),
    });
  }

  return (
    <header className="mb-10">
      <MonoLabel tone="muted" className="block">
        {partyDisplay}
      </MonoLabel>
      <h2 className="mt-3 font-serif text-[40px] font-light leading-[1.02] tracking-[-0.02em] text-ink m-0 md:text-[52px]">
        {overview.contract_type}
      </h2>
      <div aria-hidden className="mt-6 border-b-2 border-ink" />

      {cells.length > 0 && (
        <dl
          className="mt-5 grid gap-x-8 gap-y-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(cells.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((cell, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <dt>
                <MonoLabel tone="muted">{cell.kicker}</MonoLabel>
              </dt>
              <dd className="font-serif text-[19px] leading-tight text-ink m-0">
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {overview.key_terms.length > 0 && (
        <section className="mt-8 border-t border-paper-edge pt-4">
          <Kicker tone="ink">{t("keyTerms")}</Kicker>
          <ul className="mt-3 grid gap-y-2 sm:grid-cols-2 sm:gap-x-8">
            {overview.key_terms.map((term, i) => (
              <li
                key={i}
                className="t-reading grid grid-cols-[auto_1fr] gap-x-3 text-[15px] text-ink-2"
              >
                <span className="font-mono text-[10.5px] uppercase tracking-[1.2px] text-ink-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{term}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </header>
  );
}
