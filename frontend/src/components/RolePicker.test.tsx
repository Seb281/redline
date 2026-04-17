/**
 * Tests the SP-1.9 RolePicker UX: role labels render by default, legal
 * names appear only when the user flips the session rehydrate toggle,
 * and the picked value is the canonical label (not the party name).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RolePicker } from "./RolePicker";
import { RehydrateProvider, useRehydrate } from "@/contexts/RehydrateContext";

afterEach(() => cleanup());

const baseParties = [
  { name: "ACME Corp", role_label: "Provider" },
  { name: "Beta LLC", role_label: "Client" },
];
const baseLabels = ["PROVIDER", "CLIENT"];

/**
 * Test helper — exposes the context setter so a test can flip the
 * rehydrate flag at runtime without hunting for a DOM element.
 */
function RehydrateHandle({ onReady }: { onReady: (set: (v: boolean) => void) => void }) {
  const { setRehydrate } = useRehydrate();
  onReady(setRehydrate);
  return null;
}

describe("RolePicker (SP-1.9)", () => {
  it("renders role labels (title-cased), not party names, by default", () => {
    render(
      <RehydrateProvider>
        <RolePicker parties={baseParties} labels={baseLabels} onPick={vi.fn()} />
      </RehydrateProvider>,
    );
    expect(screen.getByText(/I'm the Provider/i)).toBeTruthy();
    expect(screen.getByText(/I'm the Client/i)).toBeTruthy();
    expect(screen.queryByText(/ACME Corp/)).toBeNull();
    expect(screen.queryByText(/Beta LLC/)).toBeNull();
  });

  it("onPick receives the canonical label, not the party name", () => {
    const onPick = vi.fn();
    render(
      <RehydrateProvider>
        <RolePicker parties={baseParties} labels={baseLabels} onPick={onPick} />
      </RehydrateProvider>,
    );
    fireEvent.click(screen.getByText(/I'm the Provider/i));
    expect(onPick).toHaveBeenCalledWith("PROVIDER");
  });

  it("title-cases multi-word labels with underscores", () => {
    render(
      <RehydrateProvider>
        <RolePicker
          parties={[{ name: "X", role_label: null }]}
          labels={["DISCLOSING_PARTY"]}
          onPick={vi.fn()}
        />
      </RehydrateProvider>,
    );
    expect(screen.getByText(/I'm the Disclosing Party/i)).toBeTruthy();
  });

  it("shows party names as sub-text when rehydrate is on", () => {
    let flipRehydrate: ((v: boolean) => void) | undefined;
    render(
      <RehydrateProvider>
        <RehydrateHandle onReady={(s) => (flipRehydrate = s)} />
        <RolePicker parties={baseParties} labels={baseLabels} onPick={vi.fn()} />
      </RehydrateProvider>,
    );
    // Before toggle: names hidden.
    expect(screen.queryByText(/ACME Corp/)).toBeNull();
    act(() => flipRehydrate?.(true));
    // After toggle: names surfaced as sub-label.
    expect(screen.getByText(/ACME Corp/)).toBeTruthy();
    expect(screen.getByText(/Beta LLC/)).toBeTruthy();
  });

  it("still supports Other and Skip flows", () => {
    const onPick = vi.fn();
    render(
      <RehydrateProvider>
        <RolePicker parties={baseParties} labels={baseLabels} onPick={onPick} />
      </RehydrateProvider>,
    );
    fireEvent.click(screen.getByText(/Other/));
    const input = screen.getByPlaceholderText(/Subcontractor/i);
    fireEvent.change(input, { target: { value: "Subcontractor" } });
    fireEvent.click(screen.getByText(/^Confirm$/));
    expect(onPick).toHaveBeenCalledWith("Subcontractor");

    fireEvent.click(screen.getByText(/Skip/));
    expect(onPick).toHaveBeenCalledWith(null);
  });
});
