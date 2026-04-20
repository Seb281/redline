/**
 * Locale-scoped root layout — owns `<html lang>`, fonts, provider tree,
 * and the global chrome (Header / Footer / CookieBanner).
 *
 * Rendering the `<html>` element here (rather than in
 * `src/app/layout.tsx`) is the next-intl App Router pattern: it lets
 * the `lang` attribute match the active locale so screen readers and
 * search engines see the right language for every page.
 *
 * `setRequestLocale` opts this subtree into static rendering — without
 * it every page becomes dynamic and loses the build-time cache.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lora, DM_Sans } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { AnalysisLocaleProvider } from "@/contexts/AnalysisLocaleContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { RehydrateProvider } from "@/contexts/RehydrateContext";
import { CookieBanner } from "@/components/CookieBanner";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { routing, type Locale } from "@/i18n/routing";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Redline — AI Contract Analyzer",
  description: "Upload a contract. Understand what you're signing.",
};

/** Pre-render one variant per supported locale at build time. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale as Locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${lora.variable} ${dmSans.variable}`}
    >
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased theme-transition font-[var(--font-body)]">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <RehydrateProvider>
              <AnalysisLocaleProvider>
                <Header />
                {children}
                <Footer />
                <CookieBanner />
              </AnalysisLocaleProvider>
            </RehydrateProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
