/**
 * Tracks "where the user was" when they jumped to a citation footnote,
 * so the footnote's return button can scroll back to the origin element.
 *
 * Lives at ReportView level so the state survives clause-card re-renders
 * caused by filtering or sorting. Consumers read/write it via the
 * `useCitationNav()` hook.
 */

"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface CitationNavValue {
  originId: string | null;
  setOrigin: (id: string) => void;
  clearOrigin: () => void;
}

const CitationNavContext = createContext<CitationNavValue | null>(null);

/** Wraps children with the citation-navigation state provider. */
export function CitationNavProvider({ children }: { children: ReactNode }) {
  const [originId, setOriginId] = useState<string | null>(null);

  const setOrigin = useCallback((id: string) => {
    setOriginId(id);
  }, []);

  const clearOrigin = useCallback(() => {
    setOriginId(null);
  }, []);

  const value = useMemo<CitationNavValue>(
    () => ({ originId, setOrigin, clearOrigin }),
    [originId, setOrigin, clearOrigin],
  );

  return (
    <CitationNavContext.Provider value={value}>
      {children}
    </CitationNavContext.Provider>
  );
}

/** Hook consumers use to read and update the citation-navigation state. */
export function useCitationNav(): CitationNavValue {
  const ctx = useContext(CitationNavContext);
  if (!ctx) {
    // Fallback no-op so components outside the provider still render.
    // The return button is hidden when originId is null, so no UX breakage.
    return {
      originId: null,
      setOrigin: () => {},
      clearOrigin: () => {},
    };
  }
  return ctx;
}
