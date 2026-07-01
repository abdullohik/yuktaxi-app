"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MapPin, Crosshair, Search, Loader2, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { loadYandexMaps, TASHKENT_CENTER, type YMapsAPI } from "@/lib/yandex-maps";
import type { GeoPoint } from "@/lib/types";

interface MapPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (point: GeoPoint) => void;
  initialCenter?: [number, number];
  initialPoint?: GeoPoint | null;
  title?: string;
  accentColor?: "emerald" | "primary";
}

interface NomResult {
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * MapPickerModal — Yandex Maps powered full-screen map modal.
 * Fixed center pin (Yandex Go style), reverse-geocoding, search.
 */
export function MapPickerModal({
  open,
  onClose,
  onSelect,
  initialCenter = TASHKENT_CENTER,
  initialPoint,
  title = "Manzilni xaritada tanlang",
  accentColor = "emerald",
}: MapPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const ymapsRef = useRef<YMapsAPI | null>(null);
  const mapRef = useRef<YMapsAPI["Map"] | null>(null);
  const [center, setCenter] = useState<[number, number]>(
    initialPoint ? [initialPoint.lat, initialPoint.lng] : initialCenter
  );
  const [address, setAddress] = useState<string>(initialPoint?.address ?? "");
  const [reverseLoading, setReverseLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NomResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [apt, setApt] = useState("");
  const [entrance, setEntrance] = useState("");
  const [floor, setFloor] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || !mapContainerRef.current || mapRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || undefined;
    let destroyed = false;

    const startCenter = initialPoint
      ? [initialPoint.lat, initialPoint.lng] as [number, number]
      : initialCenter;

    loadYandexMaps(apiKey)
      .then((ymaps) => {
        if (destroyed || !mapContainerRef.current) return;
        ymapsRef.current = ymaps;

        const map = new ymaps.Map(mapContainerRef.current, {
          center: startCenter,
          zoom: 16,
          controls: [],
          behaviors: ["default", "scrollZoom"],
          type: "yandex#map",
        }, { suppressMapOpenBlock: true });

        try {
          const zc = new (ymaps as unknown as Record<string, unknown>).control.ZoomControl({
            options: { size: "small", position: { bottom: 16, left: 10 } },
          });
          map.controls.add(zc);
        } catch { /* optional */ }

        mapRef.current = map;

        map.events.add("boundschange", () => {
          if (destroyed) return;
          const c = map.getCenter();
          setCenter([c[0], c[1]]);
          debouncedReverseGeocode(c[0], c[1]);
        });

        setTimeout(() => {
          if (destroyed) return;
          map.container.fitToViewport();
          const c = map.getCenter();
          debouncedReverseGeocode(c[0], c[1]);
        }, 300);
      })
      .catch(() => {});

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      ymapsRef.current = null;
    };
    }, [open]);

  function debouncedReverseGeocode(lat: number, lng: number) {
    if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
    reverseDebounceRef.current = setTimeout(() => reverseGeocode(lat, lng), 500);
  }

  async function reverseGeocode(lat: number, lng: number) {
    setReverseLoading(true);
    try {
      const r = await api<{ ok: boolean; data: { display_name: string } }>(
        `/api/geo/reverse?lat=${lat}&lng=${lng}`
      );
      setAddress(r.data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setReverseLoading(false);
    }
  }

  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      setShowResults(true);
      try {
        const r = await api<{ ok: boolean; data: { display_name: string; lat: number; lng: number }[] }>(
          `/api/geo/search?q=${encodeURIComponent(query)}`
        );
        setResults(
          (r.data ?? []).map((x) => ({
            display_name: x.display_name,
            lat: String(x.lat),
            lon: String(x.lng),
          }))
        );
      } catch { setResults([]); }
      finally { setSearchLoading(false); }
    }, 400);
  }, [query]);

  function pickSearchResult(r: NomResult) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setQuery("");
    setShowResults(false);
    setResults([]);
    setAddress(r.display_name);
    mapRef.current?.setCenter([lat, lng], 17, { duration: 1000, flying: true });
    setCenter([lat, lng]);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.setCenter([latitude, longitude], 17, { duration: 1000, flying: true });
        setCenter([latitude, longitude]);
        reverseGeocode(latitude, longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function confirm() {
    const extras: string[] = [];
    if (apt.trim()) extras.push(`Kv ${apt.trim()}`);
    if (entrance.trim()) extras.push(`Pod'ezd ${entrance.trim()}`);
    if (floor.trim()) extras.push(`Qavat ${floor.trim()}`);
    const fullAddress = extras.length > 0 ? `${address} (${extras.join(", ")})` : address;
    onSelect({ lat: center[0], lng: center[1], address: fullAddress });
    onClose();
  }

  if (!open) return null;
  const pinColor = accentColor === "emerald" ? "#10b981" : "#C2700F";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className="fixed inset-0 z-[100] flex flex-col bg-background"
      >
        {/* Header */}
        <div className="safe-top shrink-0 border-b border-border/60 bg-card px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background ring-1 ring-border/70 active:scale-95" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <h2 className="flex-1 truncate text-[16px] font-bold text-foreground">{title}</h2>
          </div>
          <div className="relative mt-3">
            <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-2.5 ring-1 ring-border/70 focus-within:ring-2 focus-within:ring-primary">
              <Search className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setShowResults(true)}
                placeholder="Ko'cha, mahalla yoki joy nomi..."
                className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              {searchLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {query && (
                <button onClick={() => { setQuery(""); setResults([]); }} className="text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {showResults && results.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl bg-popover py-1.5 shadow-xl ring-1 ring-border/70 yt-scroll">
                {results.map((r, i) => (
                  <button key={i} onClick={() => pickSearchResult(r)} className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-muted/50">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-[13px] leading-snug text-foreground line-clamp-2">{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="relative flex-1">
          <div ref={mapContainerRef} className="absolute inset-0 z-0" />
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="yuktaxi-pin relative flex flex-col items-center">
              <div className="yuktaxi-pin-inner h-10 w-10 rounded-full shadow-lg ring-2 ring-white" style={{ background: pinColor }}>
                <div className="flex h-full w-full items-center justify-center text-white">
                  <MapPin className="h-5 w-5" />
                </div>
              </div>
              <div className="absolute -bottom-1.5 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent" style={{ borderTopColor: pinColor }} />
            </div>
          </div>
          <div className="absolute right-3 top-3 z-10">
            <button onClick={useMyLocation} className="grid h-11 w-11 place-items-center rounded-full bg-card shadow-lg ring-1 ring-border/60 active:scale-95" aria-label="My location">
              <Crosshair className="h-5 w-5 text-primary" />
            </button>
          </div>
        </div>

        {/* Bottom sheet */}
        <div className="safe-bottom shrink-0 overflow-y-auto yt-scroll rounded-t-3xl bg-card px-4 pb-6 pt-4 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.2)]" style={{ maxHeight: "55%" }}>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-start gap-3">
            <div className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full",
              accentColor === "emerald" ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
            )}>
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Tanlangan manzil</div>
              <p className="mt-0.5 flex-1 text-[14px] leading-snug text-foreground line-clamp-3">
                {reverseLoading ? "Manzil aniqlanmoqda..." : (address || "Manzilni xaritada tanlang")}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <input value={apt} onChange={(e) => setApt(e.target.value)} placeholder="Kv." className="h-10 rounded-lg bg-background px-2.5 text-[13px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary" />
            <input value={entrance} onChange={(e) => setEntrance(e.target.value)} placeholder="Podyezd" className="h-10 rounded-lg bg-background px-2.5 text-[13px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary" />
            <input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Qavat" className="h-10 rounded-lg bg-background px-2.5 text-[13px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button
            onClick={confirm}
            disabled={!address || reverseLoading}
            className={cn(
              "mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none",
              accentColor === "emerald" ? "bg-emerald-500 shadow-emerald-500/25" : "bg-primary shadow-primary/25"
            )}
          >
            <Check className="h-5 w-5" /> Tasdiqlash
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}