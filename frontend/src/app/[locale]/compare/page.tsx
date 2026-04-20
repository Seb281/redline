/**
 * /compare route — side-by-side contract comparison.
 *
 * The server shell only opts the subtree into static rendering for the
 * active locale; all state (slot loaders, filter, radar, summary) lives
 * in the client orchestrator because `sessionStorage` + client hooks
 * (useSearchParams) have nothing to contribute at build time.
 *
 * Header and Footer come from the root layout.
 */

import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { ComparePageClient } from "./ComparePageClient";
import type { Locale } from "@/i18n/routing";

export default async function ComparePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // ComparePageClient reads query params via `useSearchParams`, which
  // opts the page into client-side rendering and therefore needs to sit
  // under a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <ComparePageClient />
    </Suspense>
  );
}
