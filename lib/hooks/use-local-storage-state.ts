"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * `useState` that transparently persists to localStorage under `key`.
 *
 * The persisted value is loaded once after mount (never during render), so the
 * first client render always matches the server-rendered HTML and React
 * hydration stays happy. Writes are skipped until that initial load has run so
 * the default value can't clobber a stored one. JSON is the wire format, so the
 * stored type must be serializable (use arrays, not Sets/Maps).
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  // Skip the persist effect until after the load effect has had a chance to run.
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      /* malformed or blocked storage — fall back to the default */
    }
    loaded.current = true;
    // Re-load only if the key itself changes.
  }, [key]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked — state still works for this session */
    }
  }, [key, value]);

  return [value, setValue];
}
