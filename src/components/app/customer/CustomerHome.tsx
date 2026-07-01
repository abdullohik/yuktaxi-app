"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { MapPin, Navigation, Search, Star, Clock, ChevronRight, Zap, Home, Briefcase, Map as MapIcon } from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, cargoInfo } from "@/lib/api";
import { formatSom } from "@/lib/format";
import { ScreenHeader } from "../ScreenHeader";
import { AddressSearch } from "../shared/AddressSearch";
import { LiveMap, type MapMarker } from "../shared/LiveMap";
import { MapPickerModal } from "../shared/MapPickerModal";
import type { GeoPoint, NearbyDriver, SavedAddress } from "@/lib/types";
import { useGeolocation } from "@/hooks/use-geolocation";
import { cn } from "@/lib/utils";

export function CustomerHome() {
  const { language, user, isGuest, navigate, setBookingDraft } = useApp();
  const [pickup, setPickup] = useState<GeoPoint | null>(null);
  const [dropoff, setDropoff] = useState<GeoPoint | null>(null);
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const { pos, error: geoErr, loading: geoLoading, denied: geoDenied, isIpBased: geoIpBased, requestAgain: requestGeo } = useGeolocation(true);

  // Map picker modal
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapPickerTarget, setMapPickerTarget] = useState<"pickup" | "dropoff">("pickup");

  function handleMyLocation() {
    requestGeo();
  }

  // Map center — use geolocation if available, otherwise Tashkent center
  const mapCenter: [number, number] = pos ? [pos.lat, pos.lng] : [41.31218, 69.25138];

  // load nearby drivers around current center
  useEffect(() => {
    api<{ ok: boolean; data: NearbyDriver[] }>(
      `/api/drivers/nearby?lat=${mapCenter[0]}&lng=${mapCenter[1]}&radius=5`
    )
      .then((r) => {
        const list = r.data ?? [];
        setDrivers(list);
        // If no drivers found, seed demo data and reload once
        if (list.length === 0) {
          api("/api/seed", { method: "POST" })
            .then(() => api<{ ok: boolean; data: NearbyDriver[] }>(`/api/drivers/nearby?lat=${mapCenter[0]}&lng=${mapCenter[1]}&radius=5`).then((r2) => setDrivers(r2.data ?? [])))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [mapCenter[0], mapCenter[1]]);

  // load saved addresses
  useEffect(() => {
    if (!user || isGuest) return;
    api<{ ok: boolean; data: SavedAddress[] }>(`/api/addresses?phone=${user.phone}`)
      .then((r) => setAddresses(r.data ?? []))
      .catch(() => {});
  }, [user, isGuest]);

  function startBooking() {
    if (!pickup || !dropoff) return;
    setBookingDraft({ pickup, dropoff });
    navigate("booking");
  }

  function useCurrentLocation() {
    if (pos) {
      // reverse geocode
      api<{ ok: boolean; data: { display_name: string } }>(
        `/api/geo/reverse?lat=${pos.lat}&lng=${pos.lng}`
      )
        .then((r) =>
          setPickup({ lat: pos.lat, lng: pos.lng, address: r.data.display_name })
        )
        .catch(() => setPickup({ lat: pos.lat, lng: pos.lng, address: t(language, "useCurrentLocation") }));
    }
  }

  const driverMarkers: MapMarker[] = drivers.slice(0, 5).map((d) => ({
    id: d.id,
    lat: d.lat,
    lng: d.lng,
    kind: "driver" as const,
  }));

  const greeting = user?.name ? `${t(language, "hello")}, ${user.name}!` : t(language, "hello");

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        brand
        subtitle={greeting}
        right={
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
              {drivers.length} {t(language, "driversCount")}
            </span>
          </div>
        }
      />

      {/* Map fills the upper portion */}
      <div className="relative z-0 h-[42%] min-h-[220px] w-full shrink-0 overflow-hidden">
        <LiveMap
          center={mapCenter}
          zoom={14}
          markers={driverMarkers}
          interactive
          userPosition={pos}
          showMyLocationBtn
          onMyLocation={handleMyLocation}
          geoLoading={geoLoading}
          geoDenied={geoDenied}
          isIpBased={geoIpBased}
        />
        {geoLoading && !pos && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-medium text-zinc-600 shadow-sm backdrop-blur dark:bg-zinc-800/90 dark:text-zinc-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            {t(language, "locating")}
          </div>
        )}
        {pos && geoIpBased && !geoDenied && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-amber-500/90 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {t(language, "approxLocation")}
          </div>
        )}
        {pos && !geoIpBased && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {t(language, "locationGranted")}
          </div>
        )}
        {geoDenied && !pos && (
          <div className="absolute bottom-3 left-3 right-14 rounded-lg bg-red-600/90 px-3 py-2 text-[13px] text-white backdrop-blur">
            {t(language, "geoDenied")}
          </div>
        )}
        {geoErr && !geoDenied && !pos && (
          <div className="absolute bottom-3 left-3 right-14 rounded-lg bg-black/70 px-3 py-2 text-[13px] text-white backdrop-blur">
            {t(language, "geoError")}
          </div>
        )}
      </div>

      {/* Bottom sheet — address inputs + actions */}
      <div className="relative z-10 flex-1 overflow-y-auto yt-scroll rounded-t-3xl bg-background px-4 pb-6 pt-2 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-bold text-foreground">{t(language, "whereToSend")}</h2>
        </div>

        {/* Address cards */}
        <div className="space-y-2.5">
          <AddressRow
            kind="pickup"
            value={pickup}
            placeholder={t(language, "pickup")}
            onSelect={setPickup}
            onUseCurrent={useCurrentLocation}
            language={language}
            onOpenMap={() => { setMapPickerTarget("pickup"); setMapPickerOpen(true); }}
          />
          <div className="ml-6 h-4 border-l-2 border-dashed border-border" />
          <AddressRow
            kind="dropoff"
            value={dropoff}
            placeholder={t(language, "dropoff")}
            onSelect={setDropoff}
            language={language}
            onOpenMap={() => { setMapPickerTarget("dropoff"); setMapPickerOpen(true); }}
          />
        </div>

        {/* Saved addresses */}
        {addresses.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(language, "savedAddresses")}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {addresses.map((a) => (
                <SavedAddressChip key={a.id} address={a} onClick={() => setDropoff({ lat: a.lat, lng: a.lng, address: a.address })} />
              ))}
            </div>
          </div>
        )}

        {/* Nearby drivers preview */}
        {drivers.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(language, "nearbyDrivers")}
              </span>
              <span className="text-[12px] text-muted-foreground">{drivers.length} {t(language, "itemsCount")}</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {drivers.slice(0, 4).map((d) => (
                <DriverChip key={d.id} driver={d} language={language} />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-6">
          <button
            onClick={startBooking}
            disabled={!pickup || !dropoff}
            className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            <Search className="h-5 w-5" />
            {t(language, "findDriver")}
            {pickup && dropoff && <ChevronRight className="h-5 w-5" />}
          </button>
          {!pickup || !dropoff ? (
            <p className="mt-2 text-center text-[12px] text-muted-foreground">
              {t(language, "findDriverHint")}
            </p>
          ) : (
            <p className="mt-2 text-center text-[12px] text-primary">
              {t(language, "findDriverReady")}
            </p>
          )}
        </div>

        {/* Quick stats */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <QuickStat icon={Zap} label={t(language, "fast")} value={t(language, "fastValue")} />
          <QuickStat icon={Star} label={t(language, "rating")} value="4.8" />
          <QuickStat icon={Clock} label={t(language, "online247")} value={t(language, "online")} />
        </div>
      </div>

      <AnimatePresence>
        <MapPickerModal
          open={mapPickerOpen}
          onClose={() => setMapPickerOpen(false)}
          onSelect={(p) => {
            if (mapPickerTarget === "pickup") setPickup(p);
            else setDropoff(p);
          }}
          initialPoint={mapPickerTarget === "pickup" ? pickup : dropoff}
          title={mapPickerTarget === "pickup" ? t(language, "pickupSelect") : t(language, "dropoffSelect")}
          accentColor={mapPickerTarget === "pickup" ? "emerald" : "primary"}
        />
      </AnimatePresence>
    </div>
  );
}

function AddressRow({
  kind,
  value,
  placeholder,
  onSelect,
  onUseCurrent,
  language,
  onOpenMap,
}: {
  kind: "pickup" | "dropoff";
  value: GeoPoint | null;
  placeholder: string;
  onSelect: (p: GeoPoint) => void;
  onUseCurrent?: () => void;
  language: "uz" | "ru" | "en";
  onOpenMap?: () => void;
}) {
  const dot = kind === "pickup" ? "bg-emerald-500" : "bg-primary";
  return (
    <div className="flex items-center gap-3">
      <span className={cn("h-3 w-3 shrink-0 rounded-full ring-4 ring-card", dot)} />
      <div className="min-w-0 flex-1">
        <AddressSearch
          value={value}
          onSelect={onSelect}
          placeholder={placeholder}
          variant="input"
          icon={kind}
        />
      </div>
      {kind === "pickup" && onUseCurrent && (
        <button
          onClick={onUseCurrent}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary active:scale-95"
          aria-label={t(language, "useCurrentLocation")}
        >
          <Navigation className="h-5 w-5" />
        </button>
      )}
      {onOpenMap && (
        <button
          onClick={onOpenMap}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 active:scale-95"
          aria-label={t(language, "selectOnMap")}
        >
          <MapIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function SavedAddressChip({ address, onClick }: { address: SavedAddress; onClick: () => void }) {
  const Icon = address.label.toLowerCase().includes("uy") ? Home : address.label.toLowerCase().includes("ish") ? Briefcase : MapPin;
  return (
    <button
      onClick={onClick}
      className="flex w-32 shrink-0 flex-col gap-1.5 rounded-2xl bg-card p-3 text-left ring-1 ring-border/60 active:scale-95"
    >
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold text-foreground">{address.label}</div>
        <div className="truncate text-[12px] text-muted-foreground">{address.address}</div>
      </div>
    </button>
  );
}

function DriverChip({ driver, language }: { driver: NearbyDriver; language: "uz" | "ru" | "en" }) {
  const info = cargoInfo(driver.vehicleType);
  return (
    <div className="flex w-44 shrink-0 flex-col gap-2 rounded-2xl bg-card p-3 ring-1 ring-border/60">
      <div className="flex items-center gap-2.5">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-xl">
          {info.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-foreground">{driver.name}</div>
          <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span>{driver.rating.toFixed(1)}</span>
            <span>·</span>
            <span>{driver.etaMin} {t(language, "min")}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{driver.vehiclePlate}</span>
        <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">{t(language, "online")}</span>
      </div>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 ring-1 ring-border/50">
      <Icon className="h-4.5 w-4.5 text-primary" />
      <div className="text-[13px] font-bold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
