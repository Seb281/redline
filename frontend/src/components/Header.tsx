/** Persistent editorial header — BrandMark, nav links, utility cluster. */

"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useRehydrate } from "@/contexts/RehydrateContext";
import { useTheme } from "@/hooks/useTheme";
import { LanguagePicker } from "@/components/LanguagePicker";
import { BrandMark } from "@/components/ui/BrandMark";

/** Top bar shown on every screen. 49px effective height, 1px ink bottom rule. */
export function Header() {
  const t = useTranslations("Header");
  const { theme, toggle } = useTheme();
  const { isAuthenticated, logout, isLoading } = useAuth();
  const { rehydrate, setRehydrate } = useRehydrate();

  const navLinkBase =
    "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted no-underline transition-colors hover:text-ink";

  return (
    <header className="sticky top-0 z-50 border-b border-ink bg-paper/95 backdrop-blur-sm theme-transition">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-6 py-3 md:px-10">
        <div className="flex items-center gap-8">
          <BrandMark />
          <nav aria-label="Primary">
            <ul className="hidden items-center gap-6 md:flex">
              <li>
                <Link href="/redact" className={navLinkBase}>
                  {t("redact")}
                </Link>
              </li>
              <li>
                <Link href="/compare" className={navLinkBase}>
                  {t("compare")}
                </Link>
              </li>
              <li>
                <Link href="/history" className={navLinkBase}>
                  {t("history")}
                </Link>
              </li>
              <li>
                <Link href="/trust" className={navLinkBase}>
                  {t("trust")}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRehydrate(!rehydrate)}
            aria-pressed={rehydrate}
            aria-label={rehydrate ? t("hideRealNames") : t("showRealNames")}
            title={rehydrate ? t("hideRealNames") : t("showRealNames")}
            className={`font-mono text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${
              rehydrate
                ? "text-red-accent hover:text-red-deep"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {rehydrate ? t("hideNames") : t("showNames")}
          </button>

          <span aria-hidden className="h-4 w-px bg-paper-edge" />

          <LanguagePicker />

          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "light" ? t("switchToDark") : t("switchToLight")}
            className="text-ink-muted transition-colors hover:text-ink"
          >
            {theme === "light" ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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

          <span aria-hidden className="h-4 w-px bg-paper-edge" />

          {!isLoading && isAuthenticated ? (
            <>
              <Link href="/account" className={navLinkBase}>
                {t("account")}
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted transition-colors hover:text-ink"
              >
                {t("logOut")}
              </button>
            </>
          ) : (
            <Link href="/auth" className={navLinkBase}>
              {t("signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
