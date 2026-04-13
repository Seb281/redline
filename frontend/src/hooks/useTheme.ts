/** Dark mode state management with localStorage persistence and system preference detection. */

"use client";

import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

/** Reads the persisted theme or falls back to system preference. */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("redline-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Manages dark/light theme, persists to localStorage, respects system preference as default. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  /** Follow system preference changes when the user hasn't explicitly chosen a theme. */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("redline-theme")) {
        setThemeState(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setThemeState(next);
    localStorage.setItem("redline-theme", next);
  }, [theme]);

  return { theme, toggle } as const;
}
