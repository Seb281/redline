/**
 * SP-7 Layer A — LanguagePicker swaps the active locale while
 * preserving the current resolved pathname. Verifies the picker
 * calls `router.replace` with the selected locale and renders one
 * option per configured locale.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test-fixtures/i18n";

const replace = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/history/abc-123",
}));

vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl");
  return {
    ...actual,
    useLocale: () => "en",
  };
});

import { LanguagePicker } from "./LanguagePicker";
import { routing } from "@/i18n/routing";

describe("LanguagePicker", () => {
  afterEach(() => {
    cleanup();
    replace.mockReset();
  });

  it("renders one option per configured locale", () => {
    renderWithIntl(<LanguagePicker />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual([...routing.locales]);
  });

  it("calls router.replace with the selected locale and preserved pathname", () => {
    renderWithIntl(<LanguagePicker />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "fr" } });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/history/abc-123", { locale: "fr" });
  });

  it("exposes an accessible label via aria-label", () => {
    renderWithIntl(<LanguagePicker />);
    // aria-label resolves to the translated "Language" string.
    expect(screen.getByLabelText(/language/i)).toBeTruthy();
  });
});
