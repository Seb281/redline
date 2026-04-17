/**
 * SP-1.9 — ContractOverview renders role labels by default and discloses
 * legal party names only when the rehydrate toggle is on. Also covers
 * the history path where no explicit `labels` prop is provided and
 * labels are derived from `role_label` + heuristic.
 */

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ContractOverview } from "./ContractOverview";
import { RehydrateProvider, useRehydrate } from "@/contexts/RehydrateContext";

afterEach(() => cleanup());

const overview = {
  contract_type: "Services Agreement",
  parties: [
    { name: "ACME Corp", role_label: "Provider" },
    { name: "Beta LLC", role_label: "Client" },
  ],
  effective_date: null,
  duration: null,
  total_value: null,
  governing_jurisdiction: null,
  jurisdiction_evidence: { source_type: "unknown", source_text: null } as const,
  key_terms: ["Payment terms", "Termination notice"],
  clause_inventory: [],
};

function RehydrateHandle({ onReady }: { onReady: (set: (v: boolean) => void) => void }) {
  const { setRehydrate } = useRehydrate();
  onReady(setRehydrate);
  return null;
}

describe("ContractOverview (SP-1.9)", () => {
  it("renders role labels by default, not party names", () => {
    render(
      <RehydrateProvider>
        <ContractOverview overview={overview} labels={["PROVIDER", "CLIENT"]} />
      </RehydrateProvider>,
    );
    expect(screen.getByText(/Provider · Client/)).toBeTruthy();
    expect(screen.queryByText(/ACME Corp/)).toBeNull();
  });

  it("shows legal names beside labels when rehydrate is on", () => {
    let flip: ((v: boolean) => void) | undefined;
    render(
      <RehydrateProvider>
        <RehydrateHandle onReady={(s) => (flip = s)} />
        <ContractOverview overview={overview} labels={["PROVIDER", "CLIENT"]} />
      </RehydrateProvider>,
    );
    act(() => flip?.(true));
    expect(screen.getByText(/Provider \(ACME Corp\) · Client \(Beta LLC\)/)).toBeTruthy();
  });

  it("derives labels from overview when `labels` prop is omitted (history path)", () => {
    render(
      <RehydrateProvider>
        <ContractOverview overview={overview} />
      </RehydrateProvider>,
    );
    expect(screen.getByText(/Provider · Client/)).toBeTruthy();
  });

  it("falls back to heuristic when parties lack role_label", () => {
    render(
      <RehydrateProvider>
        <ContractOverview
          overview={{
            ...overview,
            contract_type: "Employment Agreement",
            parties: [
              { name: "ACME Corp", role_label: null },
              { name: "John Doe", role_label: null },
            ],
          }}
        />
      </RehydrateProvider>,
    );
    expect(screen.getByText(/Employer · Employee/)).toBeTruthy();
  });

  it("still renders contract type and key terms", () => {
    render(
      <RehydrateProvider>
        <ContractOverview overview={overview} labels={["PROVIDER", "CLIENT"]} />
      </RehydrateProvider>,
    );
    expect(screen.getByText(/Services Agreement/)).toBeTruthy();
    expect(screen.getByText(/Payment terms/)).toBeTruthy();
    expect(screen.getByText(/Termination notice/)).toBeTruthy();
  });
});

describe("ContractOverview — jurisdiction pill (SP-1.7)", () => {
  it("renders STATED pill next to jurisdiction when source_type is stated", () => {
    render(
      <RehydrateProvider>
        <ContractOverview
          overview={{
            ...overview,
            governing_jurisdiction: "Netherlands",
            jurisdiction_evidence: {
              source_type: "stated",
              source_text: "\u00A714 Governing Law",
            },
          }}
          labels={["PROVIDER", "CLIENT"]}
        />
      </RehydrateProvider>,
    );
    expect(screen.getByText(/Jurisdiction: Netherlands/)).toBeTruthy();
    const pill = screen.getByTestId("jurisdiction-pill");
    expect(pill.textContent).toMatch(/stated/i);
    expect(pill.getAttribute("title")).toContain("\u00A714 Governing Law");
  });

  it("renders INFERRED pill with reason tooltip", () => {
    render(
      <RehydrateProvider>
        <ContractOverview
          overview={{
            ...overview,
            governing_jurisdiction: "Germany",
            jurisdiction_evidence: {
              source_type: "inferred",
              source_text: "Party addresses in Berlin",
            },
          }}
          labels={["PROVIDER", "CLIENT"]}
        />
      </RehydrateProvider>,
    );
    const pill = screen.getByTestId("jurisdiction-pill");
    expect(pill.textContent).toMatch(/inferred/i);
    expect(pill.getAttribute("title")).toContain("Party addresses in Berlin");
  });

  it("renders UNKNOWN pill with em-dash in place of country", () => {
    render(
      <RehydrateProvider>
        <ContractOverview
          overview={{
            ...overview,
            governing_jurisdiction: null,
            jurisdiction_evidence: { source_type: "unknown", source_text: null },
          }}
          labels={["PROVIDER", "CLIENT"]}
        />
      </RehydrateProvider>,
    );
    expect(screen.getByText(/Jurisdiction: —/)).toBeTruthy();
    const pill = screen.getByTestId("jurisdiction-pill");
    expect(pill.textContent).toMatch(/unknown/i);
  });
});
