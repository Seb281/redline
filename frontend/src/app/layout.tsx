/**
 * Bare root layout — required by Next.js but delegates `<html>`/`<body>`
 * rendering to `[locale]/layout.tsx` so the locale-scoped layout can
 * set `lang` correctly. Keeping this shell avoids duplicate `<html>`
 * elements when a request slips past the locale middleware (e.g.
 * direct Server Action calls).
 */

import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
