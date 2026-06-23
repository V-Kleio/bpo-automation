"use client";
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "theme";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Toggle the `.dark` class on <html> for the given theme choice. */
function applyTheme(theme: Theme): void {
  const dark =
    theme === "dark" || (theme === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

function readStored(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch {
    /* storage blocked */
  }
  return "system";
}

/**
 * Light/dark/system theme with localStorage persistence. The `.dark` class is
 * also set pre-paint by an inline script in the root layout (no flash); this
 * hook keeps it in sync once React is interactive.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  // Adopt the stored choice after mount (avoids SSR/hydration divergence).
  useEffect(() => {
    const stored = readStored();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  // While in "system", follow live OS preference changes.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked — still applies for this session */
    }
    setThemeState(next);
    applyTheme(next);
  }, []);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;

  return { theme, resolvedTheme, setTheme };
}
