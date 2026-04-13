/** Magic link landing page — validates token and establishes session. */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyToken } from "@/lib/api";

type VerifyState = "verifying" | "success" | "error";

/** Loading spinner shown while Suspense resolves search params. */
function VerifyLoading() {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-primary)] border-t-[var(--accent)]" />
      <p className="text-[17px] text-[var(--text-primary)] font-[var(--font-body)]">
        Verifying your login...
      </p>
    </div>
  );
}

/**
 * Reads the token from the URL, calls the backend verify endpoint,
 * and shows success or error. On success the session cookie is set
 * by the backend response — the user can close this tab and return
 * to their original tab where the focus-recheck detects the new
 * session.
 */
function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<VerifyState>(token ? "verifying" : "error");
  const [error, setError] = useState<string | null>(
    token ? null : "No verification token found.",
  );

  useEffect(() => {
    if (!token) return;

    verifyToken(token)
      .then(() => setState("success"))
      .catch((err) => {
        setState("error");
        setError(
          err instanceof Error ? err.message : "Verification failed",
        );
      });
  }, [token]);

  if (state === "verifying") {
    return <VerifyLoading />;
  }

  if (state === "success") {
    return (
      <>
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-500/30 bg-green-500/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-green-600 dark:text-green-400"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-medium text-[var(--text-primary)] font-[var(--font-heading)]">
          You&apos;re logged in
        </h1>
        <p className="mb-6 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
          You can close this tab and return to your analysis.
        </p>
        <Link
          href="/"
          className="text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
        >
          Go to Redline
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-xl font-medium text-[var(--text-primary)] font-[var(--font-heading)]">
        Verification failed
      </h1>
      <p className="mb-6 text-[15px] text-[var(--text-muted)] font-[var(--font-body)]">
        {error ?? "The link may have expired or already been used."}
      </p>
      <Link
        href="/"
        className="text-[15px] text-[var(--accent)] font-[var(--font-body)] hover:underline"
      >
        Go to Redline
      </Link>
    </>
  );
}

export default function VerifyPage() {
  return (
    <main className="mx-auto max-w-md px-5 py-24 text-center">
      <Suspense fallback={<VerifyLoading />}>
        <VerifyContent />
      </Suspense>
    </main>
  );
}
