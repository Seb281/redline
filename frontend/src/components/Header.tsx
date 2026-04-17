/** Persistent header with Redline wordmark, navigation, and user menu. */

"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRehydrate } from "@/contexts/RehydrateContext";
import { useTheme } from "@/hooks/useTheme";

/** Top bar shown on every screen. */
export function Header() {
  const { theme, toggle } = useTheme();
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const { rehydrate, setRehydrate } = useRehydrate();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/95 backdrop-blur-sm theme-transition">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5">
        {/* Red dash + wordmark — links back to landing page */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="h-[3px] w-5 bg-[var(--accent)]" />
          <span className="font-[var(--font-body)] text-sm font-semibold uppercase tracking-[1.5px] text-[var(--text-primary)]">
            Redline
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {/* History link — always visible, page handles auth state */}
          <Link
            href="/history"
            className="text-sm text-[var(--text-tertiary)] font-[var(--font-body)] no-underline transition-colors hover:text-[var(--text-primary)]"
          >
            History
          </Link>

          {/* Session-only toggle — "Show real names" swaps role labels back to
              party names across the report. No localStorage; resets each
              session so privacy is the default. */}
          <button
            type="button"
            onClick={() => setRehydrate(!rehydrate)}
            aria-pressed={rehydrate}
            aria-label={rehydrate ? "Hide real names" : "Show real names"}
            title={rehydrate ? "Hide real names" : "Show real names"}
            className={`rounded px-2 py-1 text-sm font-[var(--font-body)] transition-colors ${
              rehydrate
                ? "text-[var(--accent)] hover:text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {rehydrate ? "Hide names" : "Show names"}
          </button>

          {/* User info + logout — only when authenticated */}
          {!isLoading && isAuthenticated && (
            <>
              <span className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">
                {user?.email}
              </span>
              <button
                type="button"
                onClick={() => logout()}
                className="text-sm text-[var(--text-tertiary)] font-[var(--font-body)] transition-colors hover:text-[var(--text-primary)]"
              >
                Log out
              </button>
            </>
          )}

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            className="rounded p-2.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          >
            {theme === "light" ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
