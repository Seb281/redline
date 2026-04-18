/**
 * SP-1.7 — Renders the per-clause applicable-law block inside the
 * expanded ClauseCard. Pill flags source type, `[§N]` markers point
 * into a footnote list that resolves each {@link StatuteCode} to its
 * canonical label.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ApplicableLawCite } from "./ApplicableLawCite";

describe("ApplicableLawCite", () => {
  afterEach(cleanup);

  it("renders observation + STATUTE CITED pill + footnote marker when citations present", () => {
    render(
      <ApplicableLawCite
        applicableLaw={{
          observation: "Void under German law",
          source_type: "statute_cited",
          citations: [{ code: "DE_BGB_276" }],
        }}
      />,
    );
    expect(screen.getByText(/Void under German law/)).toBeTruthy();
    expect(screen.getByText(/statute cited/i)).toBeTruthy();
    expect(screen.getAllByText(/\[§1\]/).length).toBeGreaterThan(0);
    expect(screen.getByText(/BGB §276/)).toBeTruthy();
  });

  it("renders GENERAL PRINCIPLE pill with no footnote marker when citations empty", () => {
    render(
      <ApplicableLawCite
        applicableLaw={{
          observation: "General EU unfair-terms principle",
          source_type: "general_principle",
          citations: [],
        }}
      />,
    );
    expect(screen.getByText(/General EU unfair-terms principle/)).toBeTruthy();
    expect(screen.getByText(/general principle/i)).toBeTruthy();
    expect(screen.queryByText(/\[§\d+\]/)).toBeNull();
  });

  it("numbers multiple citations with [§1] [§2] markers and matching footnote list", () => {
    render(
      <ApplicableLawCite
        applicableLaw={{
          observation: "Conflicts with both rules",
          source_type: "statute_cited",
          citations: [{ code: "EU_GDPR" }, { code: "EU_DIR_93_13_EEC" }],
        }}
      />,
    );
    expect(screen.getAllByText(/\[§1\]/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\[§2\]/).length).toBeGreaterThan(0);
    expect(screen.getByText(/GDPR/)).toBeTruthy();
    expect(screen.getByText(/93\/13\/EEC/)).toBeTruthy();
  });
});
