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
    // Target the collapsed summary directly (the expanded panel stays
    // DOM-mounted for the accordion transition, which would make a
    // plain getByText ambiguous).
    const summary = screen.getByTestId("collapsed-summary");
    expect(summary.textContent).toContain("mistral-small-2503");
    expect(summary.textContent).toContain("eu-west");
    expect(summary.textContent).toContain("2026-04-15T12:00:00.000Z");
    expect(screen.getByText(/Recorded by/i)).toBeTruthy();
  });

  it("each identifier is its own select-all span (copy-friendly)", () => {
    render(<AnalysisFooter provenance={freshProvenance} />);
    const summary = screen.getByTestId("collapsed-summary");
    const ids = Array.from(summary.querySelectorAll("span.select-all"));
    expect(ids.map((n) => n.textContent)).toEqual([
      "mistral-small-2503",
      "eu-west",
      "2026-04-15T12:00:00.000Z",
    ]);
    const separators = Array.from(summary.querySelectorAll("span.select-none"));
    expect(separators.length).toBe(2);
  });

  it("renders em-dash when an expanded-panel field is empty", () => {
    const provenance = { ...freshProvenance, snapshot: "" };
    render(<AnalysisFooter provenance={provenance} />);
    fireEvent.click(screen.getByRole("button", { name: /details/i }));
    // Expanded Snapshot field falls back to em-dash when the value is
    // blank — the label stays visible so the grid reads correctly.
    const snapshotLabel = screen.getByText("Snapshot");
    const snapshotRow = snapshotLabel.parentElement;
    expect(snapshotRow?.textContent).toContain("\u2014");
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
