/**
 * Tests for SavedAnalysisReport. Focus on the locale-scoping decision:
 * when the saved analysis was produced in a different language than the
 * UI is currently showing, a nested NextIntlClientProvider wraps the
 * report so `useTranslations("ClauseCategory")` resolves against the
 * saved-locale catalog. We verify this via a probe component that
 * mocks `ReportView` with a `useLocale()` + `ClauseCategory` readout.
 */

import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useLocale, useTranslations } from "next-intl";
import enMessages from "../../messages/en.json";
import type { AnalyzeResponse } from "@/types";

/**
 * Swap the real ReportView for a probe that surfaces the effective
 * locale and a `ClauseCategory` translation. If the nested provider
 * works, a saved-de analysis renders with `de` / "Nicht-Konkurrenz"
 * (or equivalent) even under a UI provider set to `en`.
 */
vi.mock("@/components/ReportView", () => ({
  ReportView: () => {
    const locale = useLocale();
    const tCat = useTranslations("ClauseCategory");
    return (
      <div>
        <span data-testid="effective-locale">{locale}</span>
        <span data-testid="non-compete">{tCat("non_compete")}</span>
      </div>
    );
  },
}));

import { SavedAnalysisReport } from "./SavedAnalysisReport";

function makeAnalyze(savedLocale?: string): AnalyzeResponse {
  return {
    overview: {
      contract_type: "Test",
      parties: [],
      effective_date: null,
      duration: null,
      total_value: null,
      governing_jurisdiction: null,
      jurisdiction_evidence: { source_type: "stated", source_text: null },
      key_terms: [],
      clause_inventory: [],
    },
    summary: {
      total_clauses: 0,
      risk_breakdown: { high: 0, medium: 0, low: 0, informational: 0 },
      top_risks: [],
    },
    clauses: [],
    provenance: {
      provider: "mistral",
      model: "mistral-small",
      snapshot: "mistral-small-2603",
      region: "eu-west-paris",
      reasoning_effort_per_pass: {
        overview: "low",
        extraction: "medium",
        risk: "high",
        think_hard: "high",
      },
      prompt_template_version: "1.0",
      timestamp: "2026-04-20T00:00:00.000Z",
      ...(savedLocale !== undefined ? { analysis_locale: savedLocale } : {}),
    },
  };
}

function renderAt(uiLocale: string, data: AnalyzeResponse) {
  return render(
    <NextIntlClientProvider locale={uiLocale} messages={enMessages} timeZone="UTC">
      <SavedAnalysisReport
        data={data}
        onReset={() => {}}
        onOpenChat={() => {}}
        onAskAboutClause={() => {}}
      />
    </NextIntlClientProvider>,
  );
}

describe("SavedAnalysisReport", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders under UI locale when saved analysis has no analysis_locale", () => {
    renderAt("en", makeAnalyze(undefined));
    expect(screen.getByTestId("effective-locale").textContent).toBe("en");
    expect(screen.getByTestId("non-compete").textContent).toBe("Non-Compete");
  });

  it("renders under UI locale when saved locale matches current UI locale", () => {
    renderAt("en", makeAnalyze("en"));
    expect(screen.getByTestId("effective-locale").textContent).toBe("en");
  });

  it("scopes the report in saved locale when it differs from UI locale", () => {
    // UI is English, analysis was produced in German — the nested
    // provider should swap the effective locale for the report subtree.
    renderAt("en", makeAnalyze("de"));
    expect(screen.getByTestId("effective-locale").textContent).toBe("de");
    // German ClauseCategory.non_compete from de.json — any non-EN value
    // proves the German catalog is actually in effect.
    expect(screen.getByTestId("non-compete").textContent).not.toBe("Non-Compete");
  });

  it("ignores unsupported saved locales and falls back to UI locale", () => {
    renderAt("en", makeAnalyze("xx"));
    expect(screen.getByTestId("effective-locale").textContent).toBe("en");
  });
});
