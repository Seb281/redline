/**
 * Centralised next/font/google loader for the editorial type system.
 *
 * Four families, each bound to a CSS custom property consumed by
 * `globals.css` and the Tailwind 4 @theme block:
 *
 *  - Fraunces         → --font-serif   (display, masthead, clause titles)
 *  - Newsreader       → --font-reading (long-form body, clause quotes)
 *  - Inter            → --font-sans    (UI: buttons, nav, forms)
 *  - JetBrains Mono   → --font-mono    (kickers, statute IDs, timestamps)
 *
 * Fonts are self-hosted by next/font/google — no runtime CDN leak to Google.
 * `display: "swap"` keeps first paint usable while the variable font loads.
 *
 * Each family declares weights actually referenced in the designs; adding
 * weights here is the correct place to extend them later.
 */

import { Fraunces, Inter, JetBrains_Mono, Newsreader } from "next/font/google";

export const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-reading",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * Space-separated list of all four variable class names, to be applied
 * on the top-level `<html>` element so every descendant can reference
 * any family via `var(--font-...)`.
 */
export const fontVariables = [
  fraunces.variable,
  newsreader.variable,
  inter.variable,
  jetbrainsMono.variable,
].join(" ");
