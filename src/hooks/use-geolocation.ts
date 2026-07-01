"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface GeoResult {
  pos: { lat: number; lng: number } | null;
  error: string | null;
  loading: boolean;
  denied: boolean;
  isIpBased: boolean;
  /** True when IP geo returned a fallback/default (not the user's real location) */
  isFallback: boolean;
  requestAgain: () => void;
}

/**
 * useGeolocation — Gets user location with a dual strategy:
 *
 * 1. **Immediately** fetches IP-based location (fast, ~500ms, approximate)
 * 2. **In parallel**, tries browser geolocation (GPS/WiFi, accurate, may be blocked)
 * 3. If browser geo succeeds, it overrides the IP-based position
 *
 * SSR-safe. Returns { pos, error, loading, denied, isIpBased, isFallback, requestAgain }.
 */
export function useGeolocation(enabled: boolean): GeoResult {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [isIpBased, setIsIpBased] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const watchIdRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const supported =
    typeof navigator !== "undefined" && !!navigator.geolocation;

  // Reset all refs on every call (handles StrictMode remounts)
  mountedRef.current = true;

  const fetchIpLocation = useCallback(async () => {
    try {
      const resp = await fetch("/api/geo/ip");
      if (!resp.ok) {
        // API returned an error — use fallback
        if (mountedRef.current) {
          setPos({ lat: 41.31218, lng: 69.25138 });
          setIsIpBased(true);
          setIsFallback(true);
          setLoading(false);
        }
        return;
      }
      const json = (await resp.json()) as {
        ok: boolean;
        data?: { lat: number; lng: number; city?: string };
        fallback?: boolean;
      };
      if (json.ok && json.data && mountedRef.current) {
        setPos({ lat: json.data.lat, lng: json.data.lng });
        setIsIpBased(true);
        setIsFallback(!!json.fallback);
        setError(null);
      }
    } catch {
      // Network error — set fallback position so map still works
      if (mountedRef.current) {
        setPos({ lat: 41.31218, lng: 69.25138 });
        setIsIpBased(true);
        setIsFallback(true);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const requestAgain = useCallback(() => {
    if (!supported) {
      setLoading(true);
      setIsFallback(false);
      fetchIpLocation();
      return;
    }
    setLoading(true);
    setError(null);
    setDenied(false);
    setIsFallback(false);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (mountedRef.current) {
          setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
          setIsIpBased(false);
          setIsFallback(false);
          setLoading(false);
        }
      },
      () => {
        // Browser geo failed again — try IP fallback
        fetchIpLocation();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  }, [supported, fetchIpLocation]);

  useEffect(() => {
    if (!enabled) return;

    mountedRef.current = true;
    setLoading(true);

    // 1. Immediately try IP-based location (works everywhere, no permissions needed)
    fetchIpLocation();

    // 2. In parallel, try browser geolocation (more accurate, may be blocked)
    if (supported) {
      const id = navigator.geolocation.watchPosition(
        (p) => {
          if (!mountedRef.current) return;
          setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
          setIsIpBased(false); // Override IP-based with accurate GPS
          setIsFallback(false);
          setError(null);
          setLoading(false);
          setDenied(false);
        },
        (e) => {
          if (!mountedRef.current) return;
          setError(e.message);
          setLoading(false);
          if (e.code === e.PERMISSION_DENIED) {
            setDenied(true);
          }
          // IP location should already be set from step 1, no need to retry
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      );

      watchIdRef.current = id;
    }

    return () => {
      mountedRef.current = false;
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = 0;
      }
    };
  }, [enabled, supported, fetchIpLocation]);

  if (!enabled)
    return { pos: null, error: null, loading: false, denied: false, isIpBased: false, isFallback: false, requestAgain };
  if (!supported)
    return { pos, error: "no_geo", loading, denied: true, isIpBased, isFallback, requestAgain };

  return { pos, error, loading, denied, isIpBased, isFallback, requestAgain };
}