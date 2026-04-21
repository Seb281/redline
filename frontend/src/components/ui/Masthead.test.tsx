/**
 * Masthead — smoke-test the editorial page header.
 *
 * Exercises: title rendering at the requested heading level, optional
 * meta ribbon, optional lede paragraph, and the standfirst grid when
 * provided. Not pixel-level — asserts semantic structure.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Masthead } from "./Masthead";

describe("Masthead", () => {
  afterEach(cleanup);

  it("renders the title as the requested heading level", () => {
    render(<Masthead title="Report" as="h1" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Report" });
    expect(heading).not.toBeNull();
  });

  it("renders meta, lede, and standfirst cells when provided", () => {
    render(
      <Masthead
        meta="UPLOAD / 04.2026"
        title="Your contract"
        lede="Two minutes, plain English."
        standfirst={[
          { kicker: "CLAUSES", value: "42" },
          { kicker: "RISK", value: "MEDIUM" },
        ]}
      />,
    );
    expect(screen.getByText("UPLOAD / 04.2026")).not.toBeNull();
    expect(screen.getByText("Two minutes, plain English.")).not.toBeNull();
    expect(screen.getByText("CLAUSES")).not.toBeNull();
    expect(screen.getByText("42")).not.toBeNull();
  });
});
