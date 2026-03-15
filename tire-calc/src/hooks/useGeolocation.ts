"use client";

import { useState, useEffect } from "react";

interface GeolocationState {
  latitude: number | undefined;
  longitude: number | undefined;
  error: string | null;
  loading: boolean;
}

/**
 * Simple browser geolocation hook.
 * Only fires when `enabled` is true (default).
 * Caches the result for the lifetime of the hook.
 */
export function useGeolocation(enabled = true): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    latitude: undefined,
    longitude: undefined,
    error: null,
    loading: enabled,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ latitude: undefined, longitude: undefined, error: null, loading: false });
      return;
    }

    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported", loading: false }));
      return;
    }

    setState((s) => ({ ...s, loading: true }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          error: null,
          loading: false,
        });
      },
      (err) => {
        setState((s) => ({
          ...s,
          error: err.message,
          loading: false,
        }));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 }
    );
  }, [enabled]);

  return state;
}
