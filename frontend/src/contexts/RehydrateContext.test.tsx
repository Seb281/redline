/**
 * Tests for the session-only rehydrate flag. The critical invariant is
 * privacy-by-default: no localStorage, resets to false each session.
 */

import { describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { RehydrateProvider, useRehydrate } from "./RehydrateContext";

type Ctx = ReturnType<typeof useRehydrate>;

function Probe({ onReady }: { onReady: (ctx: Ctx) => void }) {
  const ctx = useRehydrate();
  onReady(ctx);
  return null;
}

describe("RehydrateContext", () => {
  it("defaults to false", () => {
    let captured: Ctx | undefined;
    render(
      <RehydrateProvider>
        <Probe onReady={(c) => (captured = c)} />
      </RehydrateProvider>,
    );
    expect(captured?.rehydrate).toBe(false);
  });

  it("flips when setRehydrate(true) is called", () => {
    let captured: Ctx | undefined;
    render(
      <RehydrateProvider>
        <Probe onReady={(c) => (captured = c)} />
      </RehydrateProvider>,
    );
    act(() => captured?.setRehydrate(true));
    expect(captured?.rehydrate).toBe(true);
  });

  it("does not persist to localStorage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    let captured: Ctx | undefined;
    render(
      <RehydrateProvider>
        <Probe onReady={(c) => (captured = c)} />
      </RehydrateProvider>,
    );
    act(() => captured?.setRehydrate(true));
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("throws if useRehydrate is called without a provider", () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      expect(() =>
        render(<Probe onReady={() => {}} />),
      ).toThrow(/useRehydrate must be used inside RehydrateProvider/);
    } finally {
      console.error = originalError;
    }
  });
});
