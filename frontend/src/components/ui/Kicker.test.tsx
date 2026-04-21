/**
 * Kicker — smoke-test the mono uppercase rule-leader label.
 *
 * Verifies the children render and the editorial class list is applied.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Kicker } from "./Kicker";

describe("Kicker", () => {
  afterEach(cleanup);

  it("renders the children with the rule-leader class applied", () => {
    render(<Kicker>Privacy-first</Kicker>);
    const el = screen.getByText("Privacy-first");
    expect(el.className).toContain("rule-leader");
    expect(el.className).toContain("t-kicker");
  });

  it("applies red tone when requested", () => {
    render(<Kicker tone="red">Danger</Kicker>);
    const el = screen.getByText("Danger");
    expect(el.className).toContain("text-red-accent");
  });
});
