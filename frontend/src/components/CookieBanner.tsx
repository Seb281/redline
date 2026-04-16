/** Informational cookie/storage banner shown once to first-time visitors. */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "redline-cookie-dismissed";

/**
 * Non-blocking informational banner. No consent gate — Redline uses only
 * essential localStorage (theme preference), so GDPR does not require
 * prior opt-in. The banner simply informs and links to the privacy policy.
 *
 * Renders nothing on the server and on the first client paint — we only
 * reveal it after reading localStorage post-mount, so SSR HTML and the
 * client's first render always match.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "true") {
      // Intentional setState-in-effect: we must wait for mount to read
      // localStorage so the SSR HTML matches the first client render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }, []);

  if (!visible) return null;

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
