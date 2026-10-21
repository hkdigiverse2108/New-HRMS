import { useState, useEffect } from "react";

// Like useState, but the value survives a page refresh (kept per browser tab in sessionStorage)
export function usePersistentState<T>(key: string, initialValue: T) {
  const storageKey = `hrms:ui:${key}`;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved !== null ? (JSON.parse(saved) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  }, [storageKey, value]);

  return [value, setValue] as const;
}
