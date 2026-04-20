/**
 * Tests for the account page — auth gating, export button, delete
 * modal plumbing. Full DSAR flow lives in the DeleteAccountModal
 * tests; this file just verifies the page orchestrates the pieces.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { renderWithIntl } from "@/test-fixtures/i18n";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  exportAccount: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("@/components/LoginPrompt", () => ({
  LoginPrompt: () => <div data-testid="login-prompt" />,
}));

import { useAuth } from "@/contexts/AuthContext";
import { exportAccount, deleteAccount } from "@/lib/api";
import AccountPage from "./page";

const mockUseAuth = vi.mocked(useAuth);
const mockExport = vi.mocked(exportAccount);
const mockDelete = vi.mocked(deleteAccount);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setAuth(partial: Partial<ReturnType<typeof useAuth>>) {
  mockUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    recheck: vi.fn(),
    ...partial,
  } as ReturnType<typeof useAuth>);
}

describe("AccountPage", () => {
  beforeEach(() => {
    mockExport.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
  });

  it("shows the login prompt for anonymous visitors", () => {
    setAuth({ isAuthenticated: false, user: null });
    renderWithIntl(<AccountPage />);
    expect(screen.getByTestId("login-prompt")).toBeDefined();
  });

  it("shows a spinner while auth is loading", () => {
    setAuth({ isLoading: true });
    const { container } = renderWithIntl(<AccountPage />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renders export and delete sections when authenticated", () => {
    setAuth({
      isAuthenticated: true,
      user: { id: "u1", email: "u@example.com" },
    });
    renderWithIntl(<AccountPage />);
    expect(screen.getByTestId("export-button")).toBeDefined();
    expect(screen.getByTestId("delete-open-button")).toBeDefined();
    expect(screen.getByText(/u@example\.com/)).toBeDefined();
  });

  it("calls exportAccount when Export is clicked", async () => {
    setAuth({
      isAuthenticated: true,
      user: { id: "u1", email: "u@example.com" },
    });
    renderWithIntl(<AccountPage />);

    fireEvent.click(screen.getByTestId("export-button"));
    await waitFor(() => expect(mockExport).toHaveBeenCalledTimes(1));
  });

  it("surfaces export errors inline", async () => {
    mockExport.mockRejectedValueOnce(new Error("gateway down"));
    setAuth({
      isAuthenticated: true,
      user: { id: "u1", email: "u@example.com" },
    });
    renderWithIntl(<AccountPage />);

    fireEvent.click(screen.getByTestId("export-button"));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("gateway down"),
    );
  });

  it("opens the delete modal from the delete button", () => {
    setAuth({
      isAuthenticated: true,
      user: { id: "u1", email: "u@example.com" },
    });
    renderWithIntl(<AccountPage />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByTestId("delete-open-button"));
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});
