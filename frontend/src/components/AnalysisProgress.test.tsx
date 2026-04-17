/** Tests for AnalysisProgress — verifies step rendering per status. */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AnalysisProgress } from "./AnalysisProgress";

describe("AnalysisProgress", () => {
  afterEach(cleanup);

  it("shows overview subtitle during analyzing_overview", () => {
    render(
      <AnalysisProgress
        status="analyzing_overview"
        analyzedCount={0}
        totalCount={null}
      />,
    );

    expect(
      screen.getByText("Extracting contract metadata..."),
    ).toBeTruthy();
  });

  it("shows role subtitle when awaiting_role", () => {
    render(
      <AnalysisProgress
        status="awaiting_role"
        analyzedCount={0}
        totalCount={null}
      />,
    );

    expect(screen.getByText("Select your perspective")).toBeTruthy();
  });

  it("shows clause counter during analysis", () => {
    render(
      <AnalysisProgress
        status="analyzing"
        analyzedCount={3}
        totalCount={12}
      />,
    );

    expect(
      screen.getByText("Analyzing clause 4 of 12..."),
    ).toBeTruthy();
  });

  it("shows extracting message when totalCount is unknown", () => {
    render(
      <AnalysisProgress
        status="analyzing"
        analyzedCount={0}
        totalCount={null}
      />,
    );

    expect(screen.getByText("Extracting clauses...")).toBeTruthy();
  });

  it("shows completion message when complete", () => {
    render(
      <AnalysisProgress
        status="complete"
        analyzedCount={12}
        totalCount={12}
      />,
    );

    expect(screen.getByText("Analysis complete")).toBeTruthy();
  });

  it("renders all six step labels", () => {
    render(
      <AnalysisProgress
        status="analyzing"
        analyzedCount={0}
        totalCount={5}
      />,
    );

    expect(screen.getByText("Upload")).toBeTruthy();
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Redact")).toBeTruthy();
    expect(screen.getByText("Role")).toBeTruthy();
    expect(screen.getByText("Analysis")).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
  });

  it("shows redaction subtitle when awaiting_redaction", () => {
    render(
      <AnalysisProgress
        status="awaiting_redaction"
        analyzedCount={0}
        totalCount={null}
      />,
    );

    expect(screen.getByText("Review what will be masked")).toBeTruthy();
  });
});
