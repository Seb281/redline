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
