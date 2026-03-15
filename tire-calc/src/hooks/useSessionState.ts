"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Like `useState`, but mirrors the value in `sessionStorage` so it survives
 * client-side navigations (component unmount / remount) while still clearing
 * automatically when the tab is closed.
 *
 * @param key     Storage key (should be unique per page / context).
 * @param initial Default value when nothing is stored yet.
 */
export function useSessionState<T>(key: string, initial: T) {
  // Lazy initialiser – read from sessionStorage on first render only
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const stored = sessionStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });

  // Keep a ref to the key so the effect always writes under the current key
  const keyRef = useRef(key);
  keyRef.current = key;

  // When the key itself changes (e.g. event switch) re-seed from storage
  const prevKeyRef = useRef(key);
  useEffect(() => {
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        setValue(JSON.parse(stored) as T);
      } else {
        setValue(initial);
      }
    } catch {
      setValue(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist to sessionStorage whenever the value changes
  useEffect(() => {
    try {
      sessionStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [value]);

  // Stable setter (same signature as React's setState)
  const set = useCallback(
    (action: T | ((prev: T) => T)) => {
      setValue(action);
    },
    []
  );

  return [value, set] as const;
}
