/**
 * SectionHead — smoke-test the editorial H2 block.
 *
 * Verifies the label is exposed as a heading with the requested level
 * and that optional number + meta slots render.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SectionHead } from "./SectionHead";

describe("SectionHead", () => {
  afterEach(cleanup);

  it("renders an h2 by default with the children as label", () => {
    render(<SectionHead>How it reads</SectionHead>);
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "How it reads",
    });
    expect(heading).not.toBeNull();
  });

  it("renders optional number and meta slots", () => {
    render(
      <SectionHead number="§ 02" meta="6 items">
        Statute catalog
      </SectionHead>,
    );
    expect(screen.getByText("§ 02")).not.toBeNull();
    expect(screen.getByText("6 items")).not.toBeNull();
  });

  it("accepts h3 override", () => {
    render(<SectionHead as="h3">Sub-section</SectionHead>);
    expect(
      screen.getByRole("heading", { level: 3, name: "Sub-section" }),
    ).not.toBeNull();
  });
});
