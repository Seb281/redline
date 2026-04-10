/** Persistent header with Redline wordmark and dark mode toggle. */

"use client";

import { useTheme } from "@/hooks/useTheme";

/** Top bar shown on every screen. */
export function Header() {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/95 backdrop-blur-sm theme-transition">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5">
        {/* Red dash + wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="h-[3px] w-5 bg-[var(--accent)]" />
          <span className="font-[var(--font-body)] text-sm font-semibold uppercase tracking-[1.5px] text-[var(--text-primary)]">
            Redline
          </span>
        </div>
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
    </header>
  );
}
