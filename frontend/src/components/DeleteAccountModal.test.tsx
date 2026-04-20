/**
 * Tests for DeleteAccountModal — typed-confirmation gating keeps the
 * irreversible deletion button disabled until the user types their
 * own email. Case-insensitive match mirrors the backend's comparison.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { renderWithIntl } from "@/test-fixtures/i18n";
import { DeleteAccountModal } from "./DeleteAccountModal";

afterEach(cleanup);

describe("DeleteAccountModal", () => {
  it("does not render when closed", () => {
    renderWithIntl(
      <DeleteAccountModal
        email="user@example.com"
        open={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("disables the confirm button until the email matches", () => {
    renderWithIntl(
      <DeleteAccountModal
        email="user@example.com"
        open={true}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const confirmButton = screen.getByTestId(
      "delete-confirm-button",
    ) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    const input = screen.getByTestId("delete-confirm-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "wrong@example.com" } });
    expect(confirmButton.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "user@example.com" } });
    expect(confirmButton.disabled).toBe(false);
  });

  it("enables confirm with case-insensitive match", () => {
    renderWithIntl(
      <DeleteAccountModal
        email="User@Example.com"
        open={true}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const input = screen.getByTestId("delete-confirm-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "user@example.com" } });

    const confirmButton = screen.getByTestId(
      "delete-confirm-button",
    ) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
  });

  it("calls onConfirm with the typed confirmation on submit", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    renderWithIntl(
      <DeleteAccountModal
        email="user@example.com"
        open={true}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByTestId("delete-confirm-input"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByTestId("delete-confirm-button"));

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith("user@example.com"),
    );
  });

  it("surfaces backend errors without closing the modal", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("server down"));

    renderWithIntl(
      <DeleteAccountModal
        email="user@example.com"
        open={true}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByTestId("delete-confirm-input"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByTestId("delete-confirm-button"));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("server down"),
    );
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <DeleteAccountModal
        email="user@example.com"
        open={true}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on Escape key", () => {
    const onCancel = vi.fn();
    renderWithIntl(
      <DeleteAccountModal
        email="user@example.com"
        open={true}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
