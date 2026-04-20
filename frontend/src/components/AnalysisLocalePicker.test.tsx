/**
 * Tests for AnalysisLocalePicker. Assertions cover:
 * - Label comes from its own namespace ("Analysis language").
 * - Options come from the LanguagePicker namespace (shared locale names).
 * - Selected value mirrors the context's `analysisLocale`.
 * - Changing the select calls `setAnalysisLocale` with the chosen value.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../messages/en.json";
import { AnalysisLocaleProvider } from "@/contexts/AnalysisLocaleContext";
import { AnalysisLocalePicker } from "./AnalysisLocalePicker";

/** Same shim the context test uses — Vitest 4 localStorage is not reliable. */
function installStorageShim() {
  const backing = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
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
    },
  });
}

function Harness({
  uiLocale,
  children,
}: {
  uiLocale: string;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={uiLocale} messages={enMessages} timeZone="UTC">
      <AnalysisLocaleProvider>{children}</AnalysisLocaleProvider>
    </NextIntlClientProvider>
  );
}

describe("AnalysisLocalePicker", () => {
  beforeEach(() => {
    installStorageShim();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the label from the AnalysisLocalePicker namespace", () => {
    render(
      <Harness uiLocale="en">
        <AnalysisLocalePicker />
      </Harness>,
    );
    // Label text rendered once, plus an aria-label on the select (same string).
    expect(screen.getAllByText("Analysis language").length).toBeGreaterThan(0);
  });

  it("default value mirrors the UI locale", () => {
    render(
      <Harness uiLocale="fr">
        <AnalysisLocalePicker />
      </Harness>,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("fr");
  });

  it("listing options uses LanguagePicker display names", () => {
    render(
      <Harness uiLocale="en">
        <AnalysisLocalePicker />
      </Harness>,
    );
    const options = screen
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(["en", "fr", "de", "nl", "es", "it"]);
    // Display names pulled from LanguagePicker namespace (EN catalog).
    expect(screen.getByRole("option", { name: "English" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Français" })).toBeTruthy();
  });

  it("changing the select persists the pick to localStorage", () => {
    render(
      <Harness uiLocale="en">
        <AnalysisLocalePicker />
      </Harness>,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "de" } });
    expect(window.localStorage.getItem("redline-analysis-locale")).toBe("de");
    expect(select.value).toBe("de");
  });
});
