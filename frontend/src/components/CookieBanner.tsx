/** Informational cookie/storage banner shown once to first-time visitors. */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui";

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
  const t = useTranslations("CookieBanner");
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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-4 md:px-10">
        <p className="m-0 t-reading text-[14.5px] text-ink-2">
          {t("body")}{" "}
          <Link
            href="/privacy"
            className="text-ink underline underline-offset-4 decoration-paper-edge transition-colors hover:text-red-accent hover:decoration-red-accent"
          >
            {t("privacyPolicy")}
          </Link>
        </p>
        <Button variant="ghost" size="md" onClick={dismiss}>
          {t("gotIt")}
        </Button>
      </div>
    </div>
  );
}
