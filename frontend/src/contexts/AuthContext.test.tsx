/**
 * Tests for AuthContext — verifies hydration, logout, and cross-tab
 * login detection via window focus events.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

import { getCurrentUser, logout } from "@/lib/api";
import { AuthProvider, useAuth } from "./AuthContext";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockLogout = vi.mocked(logout);

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates user from getCurrentUser on mount", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "u1", email: "a@b.com" });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({ id: "u1", email: "a@b.com" });
  });

  it("sets user to null when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("clears user on logout", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "u1", email: "a@b.com" });
    mockLogout.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("clears user even when logout API fails", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "u1", email: "a@b.com" });
    mockLogout.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("re-checks auth on window focus", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);

    // Simulate login completed in another tab
    mockGetCurrentUser.mockResolvedValueOnce({ id: "u1", email: "a@b.com" });

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.email).toBe("a@b.com");
  });
});
