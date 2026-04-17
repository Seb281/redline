/**
 * Session-only toggle: "Show real names" reverses SP-1.9's role-label
 * display across the report. No localStorage — privacy-default,
 * opt-in-per-session only. Lives at app layout so every screen
 * (RolePicker, ContractOverview, ChatPanel, …) can consume it.
 */

"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface RehydrateContextValue {
  /** When true, UI swaps role labels (⟦PROVIDER⟧) back to original party names. */
  rehydrate: boolean;
  /** Toggle the session flag. Not persisted anywhere. */
  setRehydrate: (v: boolean) => void;
}

const Ctx = createContext<RehydrateContextValue | null>(null);

/**
 * Wrap the app to make the rehydrate flag available to every screen.
 * Must sit above any component that calls {@link useRehydrate}.
 */
export function RehydrateProvider({ children }: { children: ReactNode }) {
  const [rehydrate, setRehydrate] = useState(false);
  const value = useMemo(() => ({ rehydrate, setRehydrate }), [rehydrate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Read + mutate the session-only rehydrate flag. Throws if used outside
 * {@link RehydrateProvider} — a loud failure is preferable to silently
 * leaking names because a consumer forgot to mount the provider.
 */
export function useRehydrate(): RehydrateContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRehydrate must be used inside RehydrateProvider");
  return ctx;
}
