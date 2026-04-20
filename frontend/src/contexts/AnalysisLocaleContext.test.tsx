/**
 * Tests for the analysis-locale context. Invariants:
 * - Default value tracks the UI locale (no saved choice).
 * - Explicit writes persist to localStorage and flip `isExplicit`.
 * - A supported locale rehydrates from storage on mount.
 * - Unsupported / missing storage values are ignored.
 * - `resetAnalysisLocale` clears the stored value and falls back to
 *   the UI locale again.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { ReactNode } from "react";
import { render, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../messages/en.json";
import {
  AnalysisLocaleProvider,
  useAnalysisLocale,
} from "./AnalysisLocaleContext";

type Ctx = ReturnType<typeof useAnalysisLocale>;

function Probe({ onReady }: { onReady: (ctx: Ctx) => void }) {
  onReady(useAnalysisLocale());
  return null;
}

/** Mounts the probe under a controllable UI locale for each test. */
function renderWithLocale(uiLocale: string, onReady: (ctx: Ctx) => void) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={uiLocale} messages={enMessages} timeZone="UTC">
      <AnalysisLocaleProvider>{children}</AnalysisLocaleProvider>
    </NextIntlClientProvider>
  );
  return render(
    <Wrapper>
      <Probe onReady={onReady} />
    </Wrapper>,
  );
}

/**
 * In-memory Storage shim — Vitest 4's jsdom localStorage is not fully
 * functional (missing `clear`, persistence across tests is flaky), so
 * we install a clean shim per test. Mirrors the Web Storage API surface
 * the context actually uses.
 */
function installStorageShim(): Storage {
  const backing = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    key: (i: number) => Array.from(backing.keys())[i] ?? null,
    removeItem: (k: string) => {
      backing.delete(k);
    },
    setItem: (k: string, v: string) => {
      backing.set(k, String(v));
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: shim,
  });
  return shim;
}

describe("AnalysisLocaleContext", () => {
  beforeEach(() => {
    installStorageShim();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to UI locale when no saved choice exists", () => {
    let captured: Ctx | undefined;
    renderWithLocale("fr", (c) => (captured = c));
    expect(captured?.analysisLocale).toBe("fr");
    expect(captured?.isExplicit).toBe(false);
  });

  it("hydrates saved value from localStorage on mount", () => {
    window.localStorage.setItem("redline-analysis-locale", "de");
    let captured: Ctx | undefined;
    renderWithLocale("en", (c) => (captured = c));
    // Effect runs after first render — re-read the latest ctx snapshot.
    expect(captured?.analysisLocale).toBe("de");
    expect(captured?.isExplicit).toBe(true);
  });

  it("ignores unsupported values in storage", () => {
    window.localStorage.setItem("redline-analysis-locale", "xx");
    let captured: Ctx | undefined;
    renderWithLocale("en", (c) => (captured = c));
    expect(captured?.analysisLocale).toBe("en");
    expect(captured?.isExplicit).toBe(false);
  });

  it("setAnalysisLocale persists to storage and flips isExplicit", () => {
    let captured: Ctx | undefined;
    renderWithLocale("en", (c) => (captured = c));
    act(() => captured?.setAnalysisLocale("it"));
    expect(captured?.analysisLocale).toBe("it");
    expect(captured?.isExplicit).toBe(true);
    expect(window.localStorage.getItem("redline-analysis-locale")).toBe("it");
  });

  it("resetAnalysisLocale clears storage and reverts to UI locale", () => {
    window.localStorage.setItem("redline-analysis-locale", "es");
    let captured: Ctx | undefined;
    renderWithLocale("nl", (c) => (captured = c));
    act(() => captured?.resetAnalysisLocale());
    expect(captured?.analysisLocale).toBe("nl");
    expect(captured?.isExplicit).toBe(false);
    expect(window.localStorage.getItem("redline-analysis-locale")).toBeNull();
  });

  it("throws when used without the provider", () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      expect(() =>
        render(
          <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
            <Probe onReady={() => {}} />
          </NextIntlClientProvider>,
        ),
      ).toThrow(/useAnalysisLocale must be used inside AnalysisLocaleProvider/);
    } finally {
      console.error = originalError;
    }
  });
});
