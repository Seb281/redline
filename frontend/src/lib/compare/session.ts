/**
 * Thin `sessionStorage` helpers for the `/compare` feature.
 *
 * The compare page uses `sessionStorage` for two very different jobs:
 *
 * 1. **Sample cache** — when a user picks an EU sample contract in a
 *    slot, we run the full Mistral pipeline client-side once and stash
 *    the result. A second pick of the same sample (in either slot, in
 *    the same tab) reuses the cached analysis instead of paying the
 *    ~30 s + ~0,02 € tax twice.
 *
 * 2. **Carry-over from ReportView** — when the user clicks "Compare" in
 *    the report view, the current `AnalyzeResponse` is stashed here and
 *    the compare page hydrates slot A from it on mount, then clears the
 *    key so navigating back doesn't duplicate it.
 *
 * Both helpers swallow storage errors because `sessionStorage` may be
 * unavailable (Safari private mode, strict cookie blockers) — the
 * compare page must still render in that case, just without the cache.
 */

import type { AnalyzeResponse } from "@/types";

/** Namespace prefix for every key this module writes. */
const PREFIX = "redline:compare:";

/** Per-sample cache key; analysis-locale-scoped so EN/FR caches don't mix. */
function sampleKey(sampleId: string, analysisLocale: string): string {
  return `${PREFIX}sample:${sampleId}:${analysisLocale}`;
}

/** Single key carrying the analysis handed off from ReportView. */
const CARRY_KEY = `${PREFIX}carry`;

/** Typed payload of a carry-over handoff from ReportView. */
export interface CarriedAnalysis {
  label: string;
  data: AnalyzeResponse;
}

/**
 * Reads a cached sample analysis. Returns `null` when the key is
 * absent, unparseable, or when `sessionStorage` is inaccessible.
 */
export function getCachedSample(
  sampleId: string,
  analysisLocale: string,
): AnalyzeResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(
      sampleKey(sampleId, analysisLocale),
    );
    if (!raw) return null;
    return JSON.parse(raw) as AnalyzeResponse;
  } catch {
    return null;
  }
}

/**
 * Stores a freshly analysed sample in the cache. Silently no-ops on
 * storage quota errors or when `sessionStorage` is unavailable.
 */
export function setCachedSample(
  sampleId: string,
  analysisLocale: string,
  data: AnalyzeResponse,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      sampleKey(sampleId, analysisLocale),
      JSON.stringify(data),
    );
  } catch {
    // Quota exceeded or blocked — not fatal for the compare UX.
  }
}

/**
 * Pops the carry-over payload left by ReportView. Returns `null` when
 * nothing is carried. The key is ALWAYS cleared on read so a browser
 * back-button doesn't replay the handoff.
 */
export function takeCarriedAnalysis(): CarriedAnalysis | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CARRY_KEY);
    window.sessionStorage.removeItem(CARRY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CarriedAnalysis;
  } catch {
    return null;
  }
}

/**
 * Stores an analysis for ReportView → compare page handoff. Caller
 * navigates to `/compare` immediately after.
 */
export function writeCarriedAnalysis(payload: CarriedAnalysis): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CARRY_KEY, JSON.stringify(payload));
  } catch {
    // Same fallback as the sample cache — handoff fails open.
  }
}
