"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { GeoPoint } from "@/lib/types";

interface AddressSearchProps {
  value?: GeoPoint | null;
  onSelect: (p: GeoPoint) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** visual variant */
  variant?: "input" | "card";
  icon?: "pickup" | "dropoff" | "search";
}

interface NomResult {
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * AddressSearch — Nominatim-backed autocomplete with debounce (400ms) + cache.
 * Proxied through /api/geo/search to respect Nominatim's 1 req/sec limit.
 */
export function AddressSearch({
  value,
  onSelect,
  placeholder,
  autoFocus,
  variant = "input",
  icon = "search",
}: AddressSearchProps) {
  const { language } = useApp();
  const resolvedPlaceholder = placeholder ?? t(language, "searchAddress");
  const [query, setQuery] = useState(value?.address ?? "");
  const [results, setResults] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounced = useDebouncedValue(query, 400);
  const boxRef = useRef<HTMLDivElement>(null);

  // sync query from external `value` prop using the documented "adjust state
  // during render when a prop changes" pattern (no ref, no effect).
  const [prevAddr, setPrevAddr] = useState<string | undefined>(value?.address);
  if (value?.address !== prevAddr) {
    setPrevAddr(value?.address);
    setQuery(value?.address ?? "");
  }

  useEffect(() => {
    if (debounced.trim().length < 3) {
      // defer clear so it isn't a synchronous setState in the effect body
      let alive = true;
      queueMicrotask(() => { if (alive) setResults([]); });
      return () => { alive = false; };
    }
    let active = true;
    queueMicrotask(() => { if (active) setLoading(true); });
    api<{ ok: boolean; data: NomResult[] }>(
      `/api/geo/search?q=${encodeURIComponent(debounced)}`
    )
      .then((r) => {
        if (!active) return;
        setResults(
          (r.data ?? []).map((x) => ({
            display_name: x.display_name,
            lat: +x.lat,
            lng: +x.lon,
            address: x.display_name,
          }))
        );
        setHighlight(0);
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(p: GeoPoint) {
    onSelect(p);
    setQuery(p.address);
    setOpen(false);
  }

  const dotColor =
    icon === "pickup"
      ? "bg-emerald-500"
      : icon === "dropoff"
        ? "bg-primary"
        : "bg-muted-foreground";

  if (variant === "card") {
    return (
      <div ref={boxRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm ring-1 ring-border/60 transition active:scale-[0.99]"
        >
          <span className={cn("h-3 w-3 shrink-0 rounded-full", dotColor)} />
          <div className="min-w-0 flex-1">
            {value ? (
              <p className="truncate text-[15px] font-medium text-foreground">
                {value.address}
              </p>
            ) : (
              <p className="text-[15px] text-muted-foreground">{resolvedPlaceholder}</p>
            )}
          </div>
        </button>
        {open && (
          <ResultsPanel
            query={query}
            setQuery={setQuery}
            loading={loading}
            results={results}
            highlight={highlight}
            setHighlight={setHighlight}
            pick={pick}
            autoFocus={autoFocus}
            language={language}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2.5 rounded-xl bg-card px-3.5 py-3 ring-1 ring-border/70 focus-within:ring-2 focus-within:ring-primary">
        {icon !== "search" ? (
          <span className={cn("h-3 w-3 shrink-0 rounded-full", dotColor)} />
        ) : (
          <Search className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
        )}
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && results[highlight]) {
              e.preventDefault();
              pick(results[highlight]);
            }
          }}
          placeholder={resolvedPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="shrink-0 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {open && results.length > 0 && (
        <ResultsPanel
          query={query}
          setQuery={setQuery}
          loading={loading}
          results={results}
          highlight={highlight}
          setHighlight={setHighlight}
          pick={pick}
          language={language}
        />
      )}
    </div>
  );
}

function ResultsPanel({
  loading,
  results,
  highlight,
  setHighlight,
  pick,
  autoFocus,
  language,
}: {
  query: string;
  setQuery: (s: string) => void;
  loading: boolean;
  results: GeoPoint[];
  highlight: number;
  setHighlight: (n: number | ((h: number) => number)) => void;
  pick: (p: GeoPoint) => void;
  autoFocus?: boolean;
  language: "uz" | "ru" | "en";
}) {
  return (
    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl bg-popover py-1.5 shadow-xl ring-1 ring-border/70 yt-scroll">
      {loading && results.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t(language, "searching")}
        </div>
      )}
      {!loading && results.length === 0 && (
        <div className="px-4 py-3 text-sm text-muted-foreground">
          {t(language, "noResultsFound")}
        </div>
      )}
      {results.map((r, i) => (
        <button
          key={i}
          autoFocus={autoFocus && i === 0}
          onMouseEnter={() => setHighlight(i)}
          onClick={() => pick(r)}
          className={cn(
            "flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition",
            i === highlight ? "bg-accent" : "hover:bg-accent/60"
          )}
        >
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="text-[14px] leading-snug text-foreground line-clamp-2">
            {r.address}
          </span>
        </button>
      ))}
    </div>
  );
}
