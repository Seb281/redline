/**
 * Unit tests for ActiveFilterPills.
 *
 * Covers: null render, single-pill render, dual-pill render,
 * dismiss callbacks, clear-all callback, and aria-label content.
 *
 * Uses renderWithIntl so ICU messages go through the real next-intl path.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test-fixtures/i18n";
import { ActiveFilterPills } from "./ActiveFilterPills";

afterEach(cleanup);

const noop = () => {};

describe("ActiveFilterPills — render behaviour", () => {
  it("renders nothing when both filters are 'all'", () => {
    const { container } = renderWithIntl(
      <ActiveFilterPills
        riskFilter="all"
        categoryFilter="all"
        onClearRisk={noop}
        onClearCategory={noop}
        onClearAll={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders one pill when only riskFilter is set", () => {
    renderWithIntl(
      <ActiveFilterPills
        riskFilter="high"
        categoryFilter="all"
        onClearRisk={noop}
        onClearCategory={noop}
        onClearAll={noop}
      />,
    );
    // One pill button (risk) + one clear-all button = 2 total buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2);
    // Pill text includes the risk prefix and label
    expect(screen.getByText("High", { exact: false })).toBeTruthy();
  });

  it("renders one pill when only categoryFilter is set", () => {
    renderWithIntl(
      <ActiveFilterPills
        riskFilter="all"
        categoryFilter="liability"
        onClearRisk={noop}
        onClearCategory={noop}
        onClearAll={noop}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2);
    expect(screen.getByText("Liability", { exact: false })).toBeTruthy();
  });

  it("renders two pills + 'Clear all' button when both filters are set", () => {
    renderWithIntl(
      <ActiveFilterPills
        riskFilter="medium"
        categoryFilter="termination"
        onClearRisk={noop}
        onClearCategory={noop}
        onClearAll={noop}
      />,
    );
    const buttons = screen.getAllByRole("button");
    // risk pill + category pill + clear-all = 3
    expect(buttons.length).toBe(3);
    expect(screen.getByText("Medium", { exact: false })).toBeTruthy();
    expect(screen.getByText("Termination", { exact: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: /clear all/i })).toBeTruthy();
  });
});

describe("ActiveFilterPills — callbacks", () => {
  it("clicking risk pill fires onClearRisk", () => {
    const onClearRisk = vi.fn();
    renderWithIntl(
      <ActiveFilterPills
        riskFilter="low"
        categoryFilter="all"
        onClearRisk={onClearRisk}
        onClearCategory={noop}
        onClearAll={noop}
      />,
    );
    // Risk pill is the only dismiss pill
    const pill = screen.getByRole("button", { name: /Low/i });
    fireEvent.click(pill);
    expect(onClearRisk).toHaveBeenCalledOnce();
  });

  it("clicking category pill fires onClearCategory", () => {
    const onClearCategory = vi.fn();
    renderWithIntl(
      <ActiveFilterPills
        riskFilter="all"
        categoryFilter="confidentiality"
        onClearRisk={noop}
        onClearCategory={onClearCategory}
        onClearAll={noop}
      />,
    );
    const pill = screen.getByRole("button", { name: /Confidentiality/i });
    fireEvent.click(pill);
    expect(onClearCategory).toHaveBeenCalledOnce();
  });

  it("clicking 'Clear all' fires onClearAll", () => {
    const onClearAll = vi.fn();
    renderWithIntl(
      <ActiveFilterPills
        riskFilter="high"
        categoryFilter="liability"
        onClearRisk={noop}
        onClearCategory={noop}
        onClearAll={onClearAll}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});

describe("ActiveFilterPills — accessibility", () => {
  it("risk pill aria-label contains the translated risk label", () => {
    renderWithIntl(
      <ActiveFilterPills
        riskFilter="informational"
        categoryFilter="all"
        onClearRisk={noop}
        onClearCategory={noop}
        onClearAll={noop}
      />,
    );
    const pill = screen.getByRole("button", { name: /Informational/i });
    // aria-label from "removeFilter" ICU message: "Remove filter: Informational"
    expect(pill.getAttribute("aria-label")).toContain("Informational");
  });

  it("category pill aria-label contains the translated category label", () => {
    renderWithIntl(
      <ActiveFilterPills
        riskFilter="all"
        categoryFilter="governing_law"
        onClearRisk={noop}
        onClearCategory={noop}
        onClearAll={noop}
      />,
    );
    const pill = screen.getByRole("button", { name: /Governing Law/i });
    expect(pill.getAttribute("aria-label")).toContain("Governing Law");
  });
});
