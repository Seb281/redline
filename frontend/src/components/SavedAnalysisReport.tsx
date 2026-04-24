/**
 * SP-7 Layer B' Phase 5 — renders a saved analysis under the locale it
 * was produced in, not the active UI locale.
 *
 * A saved analysis carries `provenance.analysis_locale`. When that
 * locale differs from the current UI locale, we wrap `ReportView`
 * (and only `ReportView` — chat stays in UI locale per product
 * decision) in a nested `NextIntlClientProvider` so every
 * `useTranslations` call inside resolves against the saved catalog.
 * That way `ClauseCard`'s category pill, `ClauseFilters` labels, and
 * `ContractOverview` headings all match the locale the clause prose
 * was written in, instead of mixing Spanish prose with German labels.
 *
 * When `savedLocale` is missing (pre-Layer-B' rows) or equals the UI
 * locale, we skip the nested provider and render `ReportView`
 * unchanged — cheaper and avoids the bundled-catalog cost.
 */

"use client";

import { useLocale, NextIntlClientProvider } from "next-intl";
import { ReportView } from "@/components/ReportView";
import { routing, type Locale } from "@/i18n/routing";
import type { AnalyzeResponse, AnalyzedClause } from "@/types";
import enMessages from "../../messages/en.json";
import frMessages from "../../messages/fr.json";
import deMessages from "../../messages/de.json";
import nlMessages from "../../messages/nl.json";
import esMessages from "../../messages/es.json";
import itMessages from "../../messages/it.json";

type MessageCatalog = typeof enMessages;

/**
 * Static switch over the six supported locales. next-intl already
 * bundles every catalog for the upload-screen picker, so paying the
 * additional import cost here is negligible; the alternative
 * (`import()` + Suspense) would flash a loading state for a page
 * whose whole purpose is to render the report.
 */
function loadMessages(locale: Locale): MessageCatalog {
  switch (locale) {
    case "fr":
      return frMessages;
    case "de":
      return deMessages;
    case "nl":
      return nlMessages;
    case "es":
      return esMessages;
    case "it":
      return itMessages;
    case "en":
    default:
      return enMessages;
  }
}

function isSupportedLocale(value: string | null | undefined): value is Locale {
  return (
    typeof value === "string" &&
    (routing.locales as readonly string[]).includes(value)
  );
}

interface SavedAnalysisReportProps {
  data: AnalyzeResponse;
  onReset: () => void;
  onOpenChat: () => void;
  onAskAboutClause: (clause: AnalyzedClause) => void;
  /**
   * SP-10 Arc 3 Task 3.4 — open the similar-clauses drawer for a clause.
   * Threaded straight through to ``ReportView`` / ``ClauseCard``.
   */
  onFindSimilarClauses?: (clause: AnalyzedClause) => void;
  /**
   * SP-9 — original upload filename + saved-analysis id, threaded into
   * the transparency receipt so history-view downloads pull the stable
   * server-side copy by id rather than falling back to a local build.
   */
  filename?: string | null;
  savedId?: string | null;
}

/**
 * Drop-in replacement for `<ReportView />` on history detail pages.
 * Applies a locale-scoping provider when the saved analysis was
 * produced in a different language than the UI is currently set to.
 */
export function SavedAnalysisReport({
  data,
  onReset,
  onOpenChat,
  onAskAboutClause,
  onFindSimilarClauses,
  filename,
  savedId,
}: SavedAnalysisReportProps) {
  const uiLocale = useLocale() as Locale;
  const savedLocale = data.provenance.analysis_locale;

  const report = (
    <ReportView
      data={data}
      onReset={onReset}
      onOpenChat={onOpenChat}
      onAskAboutClause={onAskAboutClause}
      onFindSimilarClauses={onFindSimilarClauses}
      filename={filename}
      savedId={savedId}
    />
  );

  if (!isSupportedLocale(savedLocale) || savedLocale === uiLocale) {
    return report;
  }

  return (
    <NextIntlClientProvider
      locale={savedLocale}
      messages={loadMessages(savedLocale)}
      timeZone="UTC"
    >
      {report}
    </NextIntlClientProvider>
  );
}
