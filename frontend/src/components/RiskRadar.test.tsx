/**
 * Component tests for RiskRadar.
 * Uses renderWithIntl to exercise the real next-intl translation path.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render } from "@/test-fixtures/i18n";
import { RiskRadar } from "./RiskRadar";
import type { AnalyzedClause, ClauseCategory } from "@/types";
import { RISK_RADIUS_FRACTION } from "@/lib/viz/risk";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const OUTER_R = 72;

function makeClause(
  category: ClauseCategory,
  risk: AnalyzedClause["risk_level"],
): AnalyzedClause {
  return {
    category,
    risk_level: risk,
    title: category,
    clause_text: "",
    plain_english: "",
    risk_explanation: "",
    negotiation_suggestion: null,
    is_unusual: false,
    unusual_explanation: null,
    applicable_law: null,
  };
}

const fourClauses: AnalyzedClause[] = [
  makeClause("liability", "high"),
  makeClause("termination", "medium"),
  makeClause("confidentiality", "low"),
  makeClause("payment_terms", "informational"),
];

const singleClause: AnalyzedClause[] = [makeClause("liability", "high")];

afterEach(cleanup);

// ─── Empty state ──────────────────────────────────────────────────────────────

describe("RiskRadar — empty state", () => {
  it("returns null when clauses is empty", () => {
    const { container } = render(<RiskRadar clauses={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

// ─── Spoke count ──────────────────────────────────────────────────────────────

describe("RiskRadar — spoke count", () => {
  it("renders one spoke per unique category present", () => {
    const { container } = render(<RiskRadar clauses={fourClauses} />);
    // Each spoke is a <line> element from centre to endpoint
    const lines = container.querySelectorAll("svg line");
    expect(lines.length).toBe(4);
  });

  it("deduplicates: multiple clauses in same category = 1 spoke", () => {
    const clauses = [
      makeClause("liability", "high"),
      makeClause("liability", "medium"),
      makeClause("termination", "low"),
    ];
    const { container } = render(<RiskRadar clauses={clauses} />);
    const lines = container.querySelectorAll("svg line");
    expect(lines.length).toBe(2);
  });

  it("single clause → single spoke", () => {
    const { container } = render(<RiskRadar clauses={singleClause} />);
    const lines = container.querySelectorAll("svg line");
    expect(lines.length).toBe(1);
  });
});

// ─── Vertex radius ────────────────────────────────────────────────────────────

describe("RiskRadar — vertex dots", () => {
  it("vertex dot count matches unique category count", () => {
    const { container } = render(<RiskRadar clauses={fourClauses} />);
    // Vertex dots are <circle r="4"> elements
    const dots = Array.from(container.querySelectorAll("svg circle")).filter(
      (el) => el.getAttribute("r") === "4",
    );
    expect(dots.length).toBe(4);
  });

  it("vertex dot for high-risk category is at correct radius", () => {
    const clauses = [makeClause("liability", "high")];
    const { container } = render(<RiskRadar clauses={clauses} />);
    const dot = Array.from(container.querySelectorAll("svg circle")).find(
      (el) => el.getAttribute("r") === "4",
    );
    expect(dot).toBeTruthy();
    const cx = parseFloat(dot!.getAttribute("cx") ?? "0");
    const cy = parseFloat(dot!.getAttribute("cy") ?? "0");
    // Centre is 100,100; dot should be at radius = RISK_RADIUS_FRACTION.high × OUTER_R from centre
    const dx = cx - 100;
    const dy = cy - 100;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeCloseTo(RISK_RADIUS_FRACTION.high * OUTER_R, 0);
  });

  it("vertex dot for informational category is at 25% radius", () => {
    const clauses = [makeClause("payment_terms", "informational")];
    const { container } = render(<RiskRadar clauses={clauses} />);
    const dot = Array.from(container.querySelectorAll("svg circle")).find(
      (el) => el.getAttribute("r") === "4",
    );
    expect(dot).toBeTruthy();
    const cx = parseFloat(dot!.getAttribute("cx") ?? "0");
    const cy = parseFloat(dot!.getAttribute("cy") ?? "0");
    const dx = cx - 100;
    const dy = cy - 100;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeCloseTo(RISK_RADIUS_FRACTION.informational * OUTER_R, 0);
  });
});

// ─── Polygon ─────────────────────────────────────────────────────────────────

describe("RiskRadar — polygon", () => {
  it("polygon element has non-empty points attribute when clauses present", () => {
    const { container } = render(<RiskRadar clauses={fourClauses} />);
    const poly = container.querySelector("svg polygon");
    expect(poly).toBeTruthy();
    expect(poly!.getAttribute("points")).toBeTruthy();
  });

  it("polygon points encode correct vertex count", () => {
    const { container } = render(<RiskRadar clauses={fourClauses} />);
    const poly = container.querySelector("svg polygon");
    const pairs = (poly!.getAttribute("points") ?? "").trim().split(" ");
    expect(pairs).toHaveLength(4);
  });
});

// ─── Accessibility — non-interactive ─────────────────────────────────────────

describe("RiskRadar — decorative (no onSpokeClick)", () => {
  it("no role=button on spokes", () => {
    const { container } = render(<RiskRadar clauses={fourClauses} />);
    const buttons = container.querySelectorAll('[role="button"]');
    expect(buttons.length).toBe(0);
  });

  it("no tabIndex on spokes", () => {
    const { container } = render(<RiskRadar clauses={fourClauses} />);
    const tabbed = container.querySelectorAll("[tabindex]");
    expect(tabbed.length).toBe(0);
  });

  it("svg has aria-label reflecting category and clause count", () => {
    render(<RiskRadar clauses={fourClauses} />);
    const svg = screen.getByRole("img");
    const label = svg.getAttribute("aria-label") ?? "";
    // 4 categories, 4 clauses
    expect(label).toMatch(/4/);
  });
});

// ─── Accessibility — interactive ─────────────────────────────────────────────

describe("RiskRadar — interactive (with onSpokeClick)", () => {
  it("spokes are focusable with role=button and tabIndex=0", () => {
    render(<RiskRadar clauses={fourClauses} onSpokeClick={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(4);
    buttons.forEach((btn) => {
      expect(btn.getAttribute("tabindex")).toBe("0");
    });
  });

  it("click fires handler with the matching category", () => {
    const handler = vi.fn();
    render(<RiskRadar clauses={singleClause} onSpokeClick={handler} />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(handler).toHaveBeenCalledWith("liability");
  });

  it("click on active spoke fires handler with 'all' (clear)", () => {
    const handler = vi.fn();
    render(
      <RiskRadar
        clauses={singleClause}
        activeCategory="liability"
        onSpokeClick={handler}
      />,
    );
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(handler).toHaveBeenCalledWith("all");
  });

  it("Enter key activates spoke", () => {
    const handler = vi.fn();
    render(<RiskRadar clauses={singleClause} onSpokeClick={handler} />);
    const btn = screen.getByRole("button");
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(handler).toHaveBeenCalledWith("liability");
  });

  it("Space key activates spoke", () => {
    const handler = vi.fn();
    render(<RiskRadar clauses={singleClause} onSpokeClick={handler} />);
    const btn = screen.getByRole("button");
    fireEvent.keyDown(btn, { key: " " });
    expect(handler).toHaveBeenCalledWith("liability");
  });

  it("aria-pressed is true for active category spoke", () => {
    render(
      <RiskRadar
        clauses={singleClause}
        activeCategory="liability"
        onSpokeClick={() => {}}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("aria-pressed is false for inactive category spoke", () => {
    render(
      <RiskRadar
        clauses={fourClauses}
        activeCategory="termination"
        onSpokeClick={() => {}}
      />,
    );
    // liability button should not be pressed
    const buttons = screen.getAllByRole("button");
    const liabilityBtn = buttons.find((b) =>
      (b.getAttribute("aria-label") ?? "").toLowerCase().includes("liability"),
    );
    expect(liabilityBtn?.getAttribute("aria-pressed")).toBe("false");
  });
});
