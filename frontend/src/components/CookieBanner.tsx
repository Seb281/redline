/** Informational cookie/storage banner shown once to first-time visitors. */

"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

const STORAGE_KEY = "redline-cookie-dismissed";

/** Read dismissed state from localStorage, defaulting to hidden during SSR. */
function getInitialDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

/**
 * Non-blocking informational banner. No consent gate — Redline uses only
 * essential localStorage (theme preference), so GDPR does not require
 * prior opt-in. The banner simply informs and links to the privacy policy.
 */
export function CookieBanner() {
  const [dismissed, setDismissed] = useState(getInitialDismissed);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]/95 backdrop-blur-sm theme-transition">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-7">
        <p className="text-[15px] text-[var(--text-secondary)] font-[var(--font-body)]">
          Redline uses localStorage for theme preference only. No cookies or tracking.{" "}
          <Link
            href="/privacy"
            className="text-[var(--accent)] hover:underline"
          >
            Privacy Policy
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="rounded border border-[var(--border-primary)] px-4 py-2 text-[15px] font-medium text-[var(--text-secondary)] font-[var(--font-body)] transition-colors hover:bg-[var(--bg-tertiary)]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
