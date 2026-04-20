/**
 * Integration test — proves chart ↔ pill ↔ dropdown synchronisation.
 *
 * All three controls (RiskChart, RiskRadar, ActiveFilterPills, ClauseFilters)
 * write to the same riskFilter / categoryFilter state in ReportView.
 * Mutations via any one control must be visible through all others.
 *
 * Auth: ReportView calls useAuth(). We mock @/lib/api so AuthProvider's
 * network hydration resolves to null (not authenticated) without real HTTP.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { renderWithIntl } from "@/test-fixtures/i18n";
import { AuthProvider } from "@/contexts/AuthContext";
import { RehydrateProvider } from "@/contexts/RehydrateContext";
import type { AnalyzeResponse, AnalyzedClause } from "@/types";

// ─── Stub i18n navigation (avoids next/navigation import in jsdom) ────────────

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  redirect: vi.fn(),
  getPathname: vi.fn(),
}));

// ─── Silence network calls from AuthProvider.checkAuth ────────────────────────

vi.mock("@/lib/api", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
  login: vi.fn(),
  logout: vi.fn(),
  saveAnalysis: vi.fn(),
  deleteAnalysis: vi.fn(),
  pinAnalysis: vi.fn(),
  extendAnalysis: vi.fn(),
}));

// ─── Import after mock ─────────────────────────────────────────────────────────

import { ReportView } from "./ReportView";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeClause(
  title: string,
  category: AnalyzedClause["category"],
  riskLevel: AnalyzedClause["risk_level"],
): AnalyzedClause {
  return {
    title,
    category,
    risk_level: riskLevel,
    clause_text: `Sample clause text for ${title}`,
    plain_english: `Plain English for ${title}`,
    risk_explanation: `Risk explanation for ${title}`,
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    applicable_law: null,
  };
}

/** Minimal AnalyzeResponse fixture with clauses spanning liability + termination categories. */
const fixture: AnalyzeResponse = {
  overview: {
    contract_type: "Service Agreement",
    parties: [
      { name: "Acme Corp", role_label: "PROVIDER" },
      { name: "Client Ltd", role_label: "CLIENT" },
    ],
    effective_date: "2026-01-01",
    duration: "12 months",
    total_value: "€10,000",
    governing_jurisdiction: "Germany",
    jurisdiction_evidence: {
      source_type: "stated",
      source_text: "This agreement is governed by the laws of Germany.",
      country: "DE",
    },
    key_terms: ["SLA", "Liability cap"],
    clause_inventory: [
      { title: "Limitation of Liability", section_ref: "§5" },
      { title: "Termination", section_ref: "§8" },
    ],
  },
  summary: {
    total_clauses: 4,
    risk_breakdown: { high: 1, medium: 1, low: 1, informational: 1 },
    top_risks: ["Broad liability exclusion"],
  },
  clauses: [
    makeClause("Liability Cap", "liability", "high"),
    makeClause("Limitation of Liability", "liability", "medium"),
    makeClause("Termination Notice", "termination", "low"),
    makeClause("Background Information", "termination", "informational"),
  ],
  provenance: {
    provider: "mistral",
    model: "mistral-small-latest",
    snapshot: "mistral-small-2603",
    region: "eu-west-paris",
    reasoning_effort_per_pass: {
      overview: "low",
      extraction: "medium",
      risk: "medium",
      think_hard: "high",
    },
    prompt_template_version: "1.0",
    timestamp: "2026-04-20T12:00:00.000Z",
  },
};

// ─── Render helper with AuthProvider ─────────────────────────────────────────

/** Wraps all providers ReportView requires in tests. */
function AppWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RehydrateProvider>{children}</RehydrateProvider>
    </AuthProvider>
  );
}

function renderReport() {
  return renderWithIntl(
    <ReportView data={fixture} onReset={() => {}} />,
    { wrapper: AppWrapper },
  );
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the donut segment button for a given risk level.
 * The RiskChart segment aria-label follows: "Risk level: {label}, {count} clause(s), {pct}%"
 * which is distinct from the pill aria-label ("Remove filter: High").
 */
function getDonutSegment(riskLabel: RegExp) {
  const buttons = screen.getAllByRole("button");
  const segment = buttons.find(
    (btn) => {
      const label = btn.getAttribute("aria-label") ?? "";
      // Donut segments have "Risk level:" prefix; pills have "Remove filter:"; spokes have "Filter by"
      return /^Risk level:/i.test(label) && riskLabel.test(label);
    },
  );
  if (!segment) throw new Error(`Donut segment matching ${riskLabel} not found`);
  return segment;
}

/**
 * Get the radar spoke button for a given category.
 * The RiskRadar spoke aria-label follows: "Filter by {category}: ..."
 */
function getRadarSpoke(categoryLabel: RegExp) {
  const buttons = screen.getAllByRole("button");
  const spoke = buttons.find(
    (btn) => {
      const label = btn.getAttribute("aria-label") ?? "";
      return /^Filter by/i.test(label) && categoryLabel.test(label);
    },
  );
  if (!spoke) throw new Error(`Radar spoke matching ${categoryLabel} not found`);
  return spoke;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReportView — chart ↔ pill ↔ dropdown synchronisation", () => {
  it("(a) Donut segment click → risk pill appears + dropdown reflects filter", async () => {
    renderReport();

    // Click the 'High' donut segment (aria-label: "Risk level: High, ...")
    fireEvent.click(getDonutSegment(/High/i));

    // Risk pill should appear (aria-label: "Remove filter: High")
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Remove filter.*High/i })).toBeTruthy();
    });

    // Risk dropdown should show "high" value
    const riskDropdown = screen.getByRole("combobox", { name: /filter by risk/i });
    expect((riskDropdown as HTMLSelectElement).value).toBe("high");
  });

  it("(b) Radar spoke click → category pill appears + dropdown reflects filter", async () => {
    renderReport();

    // Click the 'liability' spoke (aria-label: "Filter by Liability: ...")
    fireEvent.click(getRadarSpoke(/Liability/i));

    // Category pill should appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Remove filter.*Liability/i })).toBeTruthy();
    });

    // Category dropdown should show "liability"
    const catDropdown = screen.getByRole("combobox", { name: /filter by category/i });
    expect((catDropdown as HTMLSelectElement).value).toBe("liability");
  });

  it("(c) Pill dismiss → filter resets, donut segment no longer pressed", async () => {
    renderReport();

    // Activate high risk filter via donut
    fireEvent.click(getDonutSegment(/High/i));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Remove filter.*High/i })).toBeTruthy(),
    );

    // Dismiss the risk pill
    fireEvent.click(screen.getByRole("button", { name: /Remove filter.*High/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Remove filter.*High/i })).toBeNull();
    });

    // Donut high segment aria-pressed should be "false"
    expect(getDonutSegment(/High/i).getAttribute("aria-pressed")).toBe("false");

    // Risk dropdown back to "all"
    const riskDropdown = screen.getByRole("combobox", { name: /filter by risk/i });
    expect((riskDropdown as HTMLSelectElement).value).toBe("all");
  });

  it("(d) 'Clear all' pill → both dropdowns reset to 'all', no pills", async () => {
    renderReport();

    // Activate both filters
    fireEvent.click(getDonutSegment(/High/i));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Remove filter.*High/i })).toBeTruthy(),
    );

    fireEvent.click(getRadarSpoke(/Liability/i));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Remove filter.*Liability/i })).toBeTruthy(),
    );

    // Clear all
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Remove filter/i })).toBeNull();
    });

    const riskDropdown = screen.getByRole("combobox", { name: /filter by risk/i });
    expect((riskDropdown as HTMLSelectElement).value).toBe("all");

    const catDropdown = screen.getByRole("combobox", { name: /filter by category/i });
    expect((catDropdown as HTMLSelectElement).value).toBe("all");
  });

  it("(e) Clicking already-active donut segment clears risk filter", async () => {
    renderReport();

    // First click — activate
    fireEvent.click(getDonutSegment(/High/i));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Remove filter.*High/i })).toBeTruthy(),
    );

    // Second click on same segment — should clear (RiskChart fires "all")
    fireEvent.click(getDonutSegment(/High/i));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Remove filter.*High/i })).toBeNull();
    });

    const riskDropdown = screen.getByRole("combobox", { name: /filter by risk/i });
    expect((riskDropdown as HTMLSelectElement).value).toBe("all");
  });

  it("(f) Dropdown change → pill appears with correct label", async () => {
    renderReport();

    const riskDropdown = screen.getByRole("combobox", { name: /filter by risk/i });
    fireEvent.change(riskDropdown, { target: { value: "high" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Remove filter.*High/i })).toBeTruthy();
    });
  });
});
