/** Magic link landing page — validates token and establishes session. */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { verifyToken } from "@/lib/api";
import { PageShell } from "@/components/PageShell";
import { Kicker, MonoLabel } from "@/components/ui";

type VerifyState = "verifying" | "success" | "error";

/** Loading spinner shown while Suspense resolves search params. */
function VerifyLoading() {
  const t = useTranslations("AuthVerify");
  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 h-8 w-8 animate-spin rounded-full border-2 border-paper-edge border-t-ink" />
      <MonoLabel tone="muted">{t("verifying")}</MonoLabel>
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
  const t = useTranslations("AuthVerify");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<VerifyState>(token ? "verifying" : "error");
  const [error, setError] = useState<string | null>(
    token ? null : t("noToken"),
  );

  useEffect(() => {
    if (!token) return;

    verifyToken(token)
      .then(() => setState("success"))
      .catch((err) => {
        setState("error");
        setError(err instanceof Error ? err.message : t("genericFailure"));
      });
  }, [token, t]);

  if (state === "verifying") {
    return <VerifyLoading />;
  }

  if (state === "success") {
    return (
      <>
        <Kicker tone="red">{t("loggedIn")}</Kicker>
        <h1 className="mt-3 m-0 font-serif text-[36px] font-light italic leading-tight text-ink">
          {t("loggedIn")}
        </h1>
        <p className="mt-4 t-reading text-[16px] text-ink-2">{t("closeTab")}</p>
        <Link
          href="/"
          className="mt-6 inline-block font-mono text-[11px] uppercase tracking-[1.5px] text-ink underline-offset-4 hover:text-red-accent hover:underline"
        >
          {t("goHome")} →
        </Link>
      </>
    );
  }

  return (
    <>
      <Kicker tone="muted">{t("failed")}</Kicker>
      <h1 className="mt-3 m-0 font-serif text-[36px] font-light italic leading-tight text-ink">
        {t("failed")}
      </h1>
      <p className="mt-4 t-reading text-[16px] text-ink-2">
        {error ?? t("expiredLink")}
      </p>
      <Link
        href="/"
        className="mt-6 inline-block font-mono text-[11px] uppercase tracking-[1.5px] text-ink underline-offset-4 hover:text-red-accent hover:underline"
      >
        {t("goHome")} →
      </Link>
    </>
  );
}

export default function VerifyPage() {
  return (
    <main>
      <PageShell width="sm" className="py-24 text-center">
        <Suspense fallback={<VerifyLoading />}>
          <VerifyContent />
        </Suspense>
      </PageShell>
    </main>
  );
}
