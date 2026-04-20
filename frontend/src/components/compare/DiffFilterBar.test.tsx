/** Smoke tests for DiffFilterBar — 5 pill tabs + aria-selected state. */

import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render } from "@/test-fixtures/i18n";
import { DiffFilterBar } from "./DiffFilterBar";

describe("DiffFilterBar", () => {
  afterEach(cleanup);

  it("renders 5 tabs with the active one aria-selected", () => {
    render(
      <DiffFilterBar
        value="differences"
        onChange={() => {}}
        labelA="Contract A"
        labelB="Contract B"
      />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);

    const active = tabs.find((t) => t.getAttribute("aria-selected") === "true");
    expect(active?.textContent).toContain("Differences");
  });

  it("interpolates the A/B labels into the 'higher in X' tabs", () => {
    render(
      <DiffFilterBar
        value="all"
        onChange={() => {}}
        labelA="Alpha"
        labelB="Beta"
      />,
    );
    expect(screen.getByText("Higher in Alpha")).toBeDefined();
    expect(screen.getByText("Higher in Beta")).toBeDefined();
  });

  it("fires onChange with the clicked filter value", () => {
    const onChange = vi.fn();
    render(
      <DiffFilterBar
        value="all"
        onChange={onChange}
        labelA="A"
        labelB="B"
      />,
    );
    fireEvent.click(screen.getByText("Unique"));
    expect(onChange).toHaveBeenCalledWith("unique");
  });
});
