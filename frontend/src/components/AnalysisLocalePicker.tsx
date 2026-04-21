/**
 * SP-7 Layer B' Phase 5 — upload-screen control that lets the user pick
 * the language the *analysis output* (clause prose, risk explanations,
 * suggestions) should be written in, independently of the UI locale.
 *
 * Reads/writes the choice through {@link useAnalysisLocale}; the
 * underlying context persists it to localStorage so a return visitor
 * sees their previous pick. Reuses the `LanguagePicker` namespace for
 * locale display names so we do not duplicate six strings across
 * catalogs; the component's own namespace only owns the `label` string.
 */

"use client";

import { useTranslations } from "next-intl";
import { useAnalysisLocale } from "@/contexts/AnalysisLocaleContext";
import { routing, type Locale } from "@/i18n/routing";

export function AnalysisLocalePicker() {
  const t = useTranslations("AnalysisLocalePicker");
  const tLang = useTranslations("LanguagePicker");
  const { analysisLocale, setAnalysisLocale } = useAnalysisLocale();

  return (
    <label className="inline-flex items-center gap-3">
      <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-ink-muted">
        {t("label")}
      </span>
      <select
        value={analysisLocale}
        aria-label={t("label")}
        onChange={(e) => setAnalysisLocale(e.target.value as Locale)}
        className="border border-paper-edge bg-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-[1.2px] text-ink transition-colors focus:border-ink focus:outline-none"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {tLang(loc)}
          </option>
        ))}
      </select>
    </label>
  );
}
