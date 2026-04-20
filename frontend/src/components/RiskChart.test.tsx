/**
 * Component tests for RiskChart.
 * Uses renderWithIntl to exercise the real next-intl translation path.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render } from "@/test-fixtures/i18n";
import { RiskChart } from "./RiskChart";
import type { RiskBreakdown } from "@/types";

const allBuckets: RiskBreakdown = {
  high: 3,
  medium: 4,
  low: 2,
  informational: 1,
};

const singleBucket: RiskBreakdown = {
  high: 5,
  medium: 0,
  low: 0,
  informational: 0,
};

const emptyBreakdown: RiskBreakdown = {
  high: 0,
  medium: 0,
  low: 0,
  informational: 0,
};

afterEach(cleanup);

describe("RiskChart — non-interactive (no onSegmentClick)", () => {
  it("renders total count when breakdown has clauses", () => {
    render(<RiskChart breakdown={allBuckets} />);
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("returns null when total is 0", () => {
    const { container } = render(<RiskChart breakdown={emptyBreakdown} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders 4 segment <g> elements when all buckets have entries", () => {
    const { container } = render(<RiskChart breakdown={allBuckets} />);
    // Each segment is a <g> inside the <svg>
    const gs = container.querySelectorAll("svg g");
    expect(gs.length).toBe(4);
  });

  it("segments are decorative — no role=button, no tabIndex", () => {
    const { container } = render(<RiskChart breakdown={allBuckets} />);
    const buttons = container.querySelectorAll('[role="button"]');
    expect(buttons.length).toBe(0);
    const tabbed = container.querySelectorAll("[tabindex]");
    expect(tabbed.length).toBe(0);
  });

  it("has aria-label describing the breakdown", () => {
    render(<RiskChart breakdown={allBuckets} />);
    // The SVG has role=img with the aria-label from t("ariaLabel", ...)
    const svg = screen.getByRole("img");
    expect(svg.getAttribute("aria-label")).toMatch(/3 high/);
    expect(svg.getAttribute("aria-label")).toMatch(/4 medium/);
    expect(svg.getAttribute("aria-label")).toMatch(/2 low/);
    expect(svg.getAttribute("aria-label")).toMatch(/1 informational/);
  });
});

describe("RiskChart — interactive (with onSegmentClick)", () => {
  it("segments are focusable with role=button and tabIndex=0", () => {
    render(<RiskChart breakdown={allBuckets} onSegmentClick={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(4);
    buttons.forEach((btn) => {
      expect(btn.getAttribute("tabindex")).toBe("0");
    });
  });

  it("click fires handler with matching risk level", () => {
    const handler = vi.fn();
    render(<RiskChart breakdown={allBuckets} onSegmentClick={handler} />);
    const highBtn = screen.getByRole("button", { name: /High/ });
    fireEvent.click(highBtn);
    expect(handler).toHaveBeenCalledWith("high");
  });

  it("click on active segment fires handler with 'all' (clear)", () => {
    const handler = vi.fn();
    render(
      <RiskChart
        breakdown={allBuckets}
        activeRisk="high"
        onSegmentClick={handler}
      />,
    );
    const highBtn = screen.getByRole("button", { name: /High/ });
    fireEvent.click(highBtn);
    expect(handler).toHaveBeenCalledWith("all");
  });

  it("Enter key fires handler", () => {
    const handler = vi.fn();
    render(<RiskChart breakdown={singleBucket} onSegmentClick={handler} />);
    const btn = screen.getByRole("button");
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(handler).toHaveBeenCalledWith("high");
  });

  it("Space key fires handler", () => {
    const handler = vi.fn();
    render(<RiskChart breakdown={singleBucket} onSegmentClick={handler} />);
    const btn = screen.getByRole("button");
    fireEvent.keyDown(btn, { key: " " });
    expect(handler).toHaveBeenCalledWith("high");
  });
});

describe("RiskChart — tooltip", () => {
  it("renders label, clause-plural count, and percentage once on hover", () => {
    render(<RiskChart breakdown={singleBucket} onSegmentClick={() => {}} />);
    const btn = screen.getByRole("button", { name: /High/ });
    fireEvent.mouseEnter(btn);
    // Tooltip content: "High — 5 clauses (100%)"
    // Regression guard: ICU plural owns the count interpolation (via `#`).
    // Prefixing a raw count would produce "High — 5 5 clauses (100%)".
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toMatch(/^High\s*—\s*5 clauses\s*\(100%\)\s*$/);
  });

  it("hides tooltip on mouse leave", () => {
    render(<RiskChart breakdown={singleBucket} onSegmentClick={() => {}} />);
    const btn = screen.getByRole("button", { name: /High/ });
    fireEvent.mouseEnter(btn);
    expect(screen.queryByRole("tooltip")).toBeTruthy();
    fireEvent.mouseLeave(btn);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
