/** Minimal site footer with privacy policy link. */

import Link from "next/link";

export function Footer() {
  return (
    <footer className="mx-auto mt-12 max-w-4xl border-t border-[var(--border-primary)] px-5 py-5 text-center sm:px-7">
      <p className="text-sm text-[var(--text-muted)] font-[var(--font-body)]">
        Redline{" "}
        <span className="mx-1">&middot;</span>{" "}
        <Link href="/privacy" className="hover:text-[var(--text-secondary)] hover:underline">
          Privacy Policy
        </Link>
      </p>
    </footer>
  );
}
