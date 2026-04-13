/** Auth state provider — hydrates from backend, re-checks on window focus. */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AuthUser } from "@/types";
import {
  getCurrentUser,
  login as loginApi,
  logout as logoutApi,
} from "@/lib/api";

/** Shape of the auth context consumed by useAuth(). */
interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Send a magic link email. Resolves with backend message. */
  login: (email: string) => Promise<{ message: string }>;
  /** Clear session cookie and local state. */
  logout: () => Promise<void>;
  /** Force re-check auth (e.g. after verify in another tab). */
  recheck: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provides auth state to the component tree.
 *
 * Hydrates from `GET /api/auth/me` on mount. Listens for window
 * `focus` events to detect cross-tab magic link verification — when
 * the user verifies in a new tab and returns, the original tab picks
 * up the session automatically.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** Guards against concurrent checkAuth calls (mount + focus racing). */
  const isFetching = useRef(false);

  /** Fetch current user from backend and update state. */
  const checkAuth = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      isFetching.current = false;
      setIsLoading(false);
    }
  }, []);

  // Hydrate on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Re-check on window focus (cross-tab login detection)
  useEffect(() => {
    const handleFocus = () => {
      checkAuth();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [checkAuth]);

  const login = useCallback(
    async (email: string) => loginApi(email),
    [],
  );

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Clear client state even if backend call fails — the user
      // intends to log out regardless of network issues.
    }
    setUser(null);
    setIsLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      recheck: checkAuth,
    }),
    [user, isLoading, login, logout, checkAuth],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

/** Access auth state and actions. Must be used within AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
