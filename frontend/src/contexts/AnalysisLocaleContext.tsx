/**
 * SP-7 Layer B' Phase 5 — decouples the *analysis* locale from the UI
 * locale so a user can keep the interface in one language (e.g. English)
 * while asking the pipeline to produce clause prose in another (e.g.
 * French). The choice is persisted to localStorage so a return visitor
 * sees their previous selection; absent a saved value, the effective
 * analysis locale tracks the current UI locale.
 *
 * Only the pipeline payload is affected: chat, history cards, and
 * static chrome continue to render in the UI locale. The saved
 * analysis carries `provenance.analysis_locale` so the history detail
 * view can replay the prose under the correct locale scope.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";

const STORAGE_KEY = "redline-analysis-locale";

interface AnalysisLocaleContextValue {
  /**
   * The locale that will be forwarded to `/api/analyze/*`. Falls back
   * to the current UI locale when the user has not made an explicit
   * choice yet.
   */
  analysisLocale: Locale;
  /**
   * Persist an explicit choice. Passing the current UI locale still
   * counts as explicit — once the user has opened the picker, we
   * remember the value so it does not drift when they later switch UI.
   */
  setAnalysisLocale: (locale: Locale) => void;
  /** True when a saved value exists in localStorage. */
  isExplicit: boolean;
  /** Clear the saved choice; effective value returns to UI locale. */
  resetAnalysisLocale: () => void;
}

const Ctx = createContext<AnalysisLocaleContextValue | null>(null);

function isSupportedLocale(value: string | null): value is Locale {
  return value !== null && (routing.locales as readonly string[]).includes(value);
}

/**
 * `useSyncExternalStore` wiring — the store is localStorage itself.
 * We keep a module-level subscriber set so every provider instance can
 * observe writes made by any other provider (or by another tab via the
 * native `storage` event).
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

/** Server render always returns null so hydration stays stable. */
function getServerSnapshot(): string | null {
  return null;
}

function notify() {
  for (const l of listeners) l();
}

/**
 * Provider that keeps the analysis locale in sync with localStorage.
 * Default value tracks the active UI locale until the user picks
 * explicitly via {@link AnalysisLocalePicker}. `useSyncExternalStore`
 * reads the persisted value on mount without triggering the lint rule
 * against setState-in-effect, and keeps every mounted provider in sync
 * when one of them writes.
 */
export function AnalysisLocaleProvider({ children }: { children: ReactNode }) {
  const uiLocale = useLocale() as Locale;
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const validStored = isSupportedLocale(stored) ? stored : null;

  const setAnalysisLocale = useCallback((locale: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    notify();
  }, []);

  const resetAnalysisLocale = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    notify();
  }, []);

  const value = useMemo<AnalysisLocaleContextValue>(
    () => ({
      analysisLocale: validStored ?? uiLocale,
      setAnalysisLocale,
      isExplicit: validStored !== null,
      resetAnalysisLocale,
    }),
    [validStored, uiLocale, setAnalysisLocale, resetAnalysisLocale],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Read and mutate the effective analysis locale. Throws when used
 * outside {@link AnalysisLocaleProvider} — mirrors the strict pattern
 * from `RehydrateContext` so a missing provider surfaces loudly.
 */
export function useAnalysisLocale(): AnalysisLocaleContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useAnalysisLocale must be used inside AnalysisLocaleProvider",
    );
  }
  return ctx;
}
