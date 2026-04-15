/** Tests for AnalysisFooter — transparency colophon per EU AI Act. */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AnalysisFooter } from "./AnalysisFooter";
import { LEGACY_PROVENANCE_PROVIDER } from "@/lib/analyzer";
import type { AnalysisProvenance } from "@/types";

const freshProvenance: AnalysisProvenance = {
  provider: "mistral",
  model: "mistral-small-4",
  snapshot: "mistral-small-2503",
  region: "eu-west",
  reasoning_effort_per_pass: {
    overview: "low",
    extraction: "medium",
    risk: "high",
    think_hard: "high",
  },
  prompt_template_version: "1.0",
  timestamp: "2026-04-15T12:00:00.000Z",
};

const legacyProvenanceFixture: AnalysisProvenance = {
  ...freshProvenance,
  provider: LEGACY_PROVENANCE_PROVIDER,
};

describe("AnalysisFooter", () => {
  afterEach(cleanup);

  it("renders collapsed row with snapshot, region, timestamp", () => {
    render(<AnalysisFooter provenance={freshProvenance} />);
    // Snapshot/region/timestamp appear in both the collapsed summary
    // line and the always-mounted expanded panel (kept in DOM so the
    // max-h accordion can animate). At least one match is enough here.
    expect(screen.getAllByText(/mistral-small-2503/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/eu-west/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/2026-04-15T12:00:00\.000Z/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Recorded by/i)).toBeTruthy();
  });

  it("reveals all four reasoning-effort labels when expanded", () => {
    render(<AnalysisFooter provenance={freshProvenance} />);
    const toggle = screen.getByRole("button", { name: /details/i });
    fireEvent.click(toggle);
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Extraction")).toBeTruthy();
    expect(screen.getByText("Risk")).toBeTruthy();
    expect(screen.getByText("Think hard")).toBeTruthy();
  });

  it("flips aria-expanded + glyph rotation class on click", () => {
    render(<AnalysisFooter provenance={freshProvenance} />);
    const toggle = screen.getByRole("button", { name: /details/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const glyphBefore = toggle.querySelector("[data-glyph]");
    expect(glyphBefore?.className).not.toMatch(/rotate-180/);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const glyphAfter = toggle.querySelector("[data-glyph]");
    expect(glyphAfter?.className).toMatch(/rotate-180/);
  });

  it("legacy sentinel renders graceful single-line variant without disclosure", () => {
    render(<AnalysisFooter provenance={legacyProvenanceFixture} />);
    expect(
      screen.getByText(/Recorded before transparency logging was enabled/i),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /details/i })).toBeNull();
  });
});
