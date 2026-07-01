"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ChevronRight, Package, Weight, StickyNote, MapPin, Clock, Wallet,
  Check, Info, Sparkles, Camera, X, AlertTriangle, Lightbulb, Route,
  CreditCard, Ruler, ShieldAlert, Boxes,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, CARGO_TYPES, cargoInfo, estimatePriceLocal } from "@/lib/api";
import { formatSom, formatKm, formatMin } from "@/lib/format";
import { ScreenHeader } from "../ScreenHeader";
import { LiveMap } from "../shared/LiveMap";
import { MapPickerModal } from "../shared/MapPickerModal";
import { CardPayment } from "./CardPayment";
import { cn } from "@/lib/utils";
import type { CargoType, GeoPoint, Order, AIAnalysis, Payment } from "@/lib/types";
import { toast } from "sonner";

type PhotoDraft = { dataUrl: string; note?: string };

const CARGO_CATEGORIES = [
  { id: "furniture", labelKey: "catFurniture", emoji: "🛋️" },
  { id: "appliances", labelKey: "catAppliances", emoji: "🔌" },
  { id: "construction", labelKey: "catConstruction", emoji: "🧱" },
  { id: "boxes", labelKey: "catBoxes", emoji: "📦" },
  { id: "vehicles", labelKey: "catVehicles", emoji: "🚲" },
  { id: "other", labelKey: "catOther", emoji: "❓" },
] as const;

export function BookingFlow() {
  const { language, bookingDraft, user, isGuest, navigate, setActiveOrderId } = useApp();
  const [pickup, setPickup] = useState<GeoPoint | null>(null);
  const [dropoff, setDropoff] = useState<GeoPoint | null>(null);
  const [cargoType, setCargoType] = useState<CargoType>("truck_small");
  const [weight, setWeight] = useState<number>(0);
  const [note, setNote] = useState("");
  const [route, setRoute] = useState<{ distanceKm: number; durationMin: number; geometry: [number, number][] } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [creating, setCreating] = useState(false);

  // Map picker modal state
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapPickerTarget, setMapPickerTarget] = useState<"pickup" | "dropoff">("pickup");

  // Photo drafts (cargo photos for BEFORE_PICKUP stage)
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Address details (apt, entrance, floor)
  const [pickupApt, setPickupApt] = useState("");
  const [pickupEntrance, setPickupEntrance] = useState("");
  const [pickupFloor, setPickupFloor] = useState("");
  const [dropoffApt, setDropoffApt] = useState("");
  const [dropoffEntrance, setDropoffEntrance] = useState("");
  const [dropoffFloor, setDropoffFloor] = useState("");

  // Cargo manifest (detailed cargo info)
  const [cargoTitle, setCargoTitle] = useState("");
  const [cargoDescription, setCargoDescription] = useState("");
  const [cargoCategory, setCargoCategory] = useState<string | null>(null);
  const [cargoLengthCm, setCargoLengthCm] = useState<string>("");
  const [cargoWidthCm, setCargoWidthCm] = useState<string>("");
  const [cargoHeightCm, setCargoHeightCm] = useState<string>("");
  const [cargoValueSom, setCargoValueSom] = useState<string>("");
  const [isFragile, setIsFragile] = useState(false);
  const [needsLoadingHelp, setNeedsLoadingHelp] = useState(false);

  // Payment
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paidPayment, setPaidPayment] = useState<Payment | null>(null);

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    const d = bookingDraft as { pickup?: GeoPoint; dropoff?: GeoPoint } | null;
    if (d?.pickup) setPickup(d.pickup);
    if (d?.dropoff) setDropoff(d.dropoff);
  }, [bookingDraft]);

  // Fetch route when both points set
  useEffect(() => {
    if (!pickup || !dropoff) return;
    setLoadingRoute(true);
    api<{ ok: boolean; data: { distanceKm: number; durationMin: number; geometry: [number, number][] } }>(
      `/api/geo/route?fromLat=${pickup.lat}&fromLng=${pickup.lng}&toLat=${dropoff.lat}&toLng=${dropoff.lng}`
    )
      .then((r) => setRoute(r.data))
      .catch(() => setRoute(null))
      .finally(() => setLoadingRoute(false));
  }, [pickup, dropoff]);

  const distanceKm = route?.distanceKm ?? 0;
  const estimate = estimatePriceLocal(distanceKm, cargoType, weight);

  // ---- Photo handling ----
  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t(language, "photoNotImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t(language, "photoTooBig"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Downscale large images via canvas
      compressImage(dataUrl, 1280, 0.82).then((compressed) => {
        setPhotos((prev) => [...prev, { dataUrl: compressed }]);
      });
    };
    reader.onerror = () => toast.error(t(language, "photoReadError"));
    reader.readAsDataURL(file);
    // Reset input so same file can be picked again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  // ---- AI analysis ----
  async function runAiAnalysis() {
    if (!pickup || !dropoff || distanceKm === 0) {
      toast.error(t(language, "errorAddressesMissing"));
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await api<{ ok: boolean; data: AIAnalysis; error?: string }>("/api/ai/analyze", {
        method: "POST",
        body: JSON.stringify({
          distanceKm,
          cargoType,
          weightKg: weight,
          pickupAddress: pickup.address,
          dropoffAddress: dropoff.address,
          note: note.trim() || null,
          photoDataUrl: photos[0]?.dataUrl ?? null,
          lang: language,
          // Full cargo manifest for accurate AI pricing
          cargoTitle: cargoTitle.trim() || null,
          cargoDescription: cargoDescription.trim() || null,
          cargoCategory,
          cargoLengthCm: cargoLengthCm ? Number(cargoLengthCm) : null,
          cargoWidthCm: cargoWidthCm ? Number(cargoWidthCm) : null,
          cargoHeightCm: cargoHeightCm ? Number(cargoHeightCm) : null,
          cargoValueSom: cargoValueSom ? Number(cargoValueSom) : null,
          isFragile,
          needsLoadingHelp,
        }),
      });
      setAiAnalysis(r.data);
      toast.success(t(language, "aiReady"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t(language, "aiFailed");
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  }

  // Auto-run AI when both addresses are set (debounced)
  // Also re-runs when cargo details change, so AI always has the latest data
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!pickup || !dropoff || distanceKm === 0) {
      setAiAnalysis(null);
      setAiError(null);
      return;
    }
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    aiDebounceRef.current = setTimeout(() => {
      runAiAnalysis();
    }, 1200);
    return () => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    };
  }, [pickup, dropoff, distanceKm, cargoTitle, cargoCategory, cargoLengthCm, cargoWidthCm, cargoHeightCm, cargoValueSom, isFragile, needsLoadingHelp, weight, cargoType]);

  async function confirmOrder() {
    if (!pickup || !dropoff) {
      toast.error(t(language, "errorAddressesMissing"));
      return;
    }
    if (isGuest || !user) {
      toast.info(t(language, "guestOrderBlocked"));
      navigate("auth");
      return;
    }
    // Require payment before creating the order
    if (!paidPayment) {
      setPaymentOpen(true);
      toast.info(t(language, "paymentRequired"));
      return;
    }
    setCreating(true);
    try {
      const r = await api<{ ok: boolean; data: Order }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerPhone: user.phone,
          pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.address },
          pickupApt: pickupApt.trim() || null,
          pickupEntrance: pickupEntrance.trim() || null,
          pickupFloor: pickupFloor.trim() || null,
          dropoff: { lat: dropoff.lat, lng: dropoff.lng, address: dropoff.address },
          dropoffApt: dropoffApt.trim() || null,
          dropoffEntrance: dropoffEntrance.trim() || null,
          dropoffFloor: dropoffFloor.trim() || null,
          cargoType,
          weightKg: weight,
          note: note.trim() || null,
          priceSom: estimate.priceSom,
          distanceKm,
          durationMin: estimate.etaMin,
          // Cargo manifest
          cargoTitle: cargoTitle.trim() || null,
          cargoDescription: cargoDescription.trim() || null,
          cargoCategory,
          cargoLengthCm: cargoLengthCm ? Number(cargoLengthCm) : null,
          cargoWidthCm: cargoWidthCm ? Number(cargoWidthCm) : null,
          cargoHeightCm: cargoHeightCm ? Number(cargoHeightCm) : null,
          cargoValueSom: cargoValueSom ? Number(cargoValueSom) : null,
          isFragile,
          needsLoadingHelp,
        }),
      });
      // Upload photos as BEFORE_PICKUP (best-effort, don't block navigation on failure)
      if (photos.length > 0) {
        for (const p of photos) {
          try {
            await api(`/api/orders/${r.data.id}/photos`, {
              method: "POST",
              body: JSON.stringify({
                uploaderPhone: user.phone,
                uploaderRole: "CUSTOMER",
                stage: "BEFORE_PICKUP",
                dataUrl: p.dataUrl,
                note: p.note ?? null,
              }),
            });
          } catch {
            // swallow — photos are best-effort
          }
        }
      }
      setActiveOrderId(r.data.id);
      toast.success(t(language, "orderCreated"));
      navigate("tracking");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t(language, "orderCreateFailed"));
    } finally {
      setCreating(false);
    }
  }

  function onPaid(payment: Payment) {
    setPaidPayment(payment);
    setPaymentOpen(false);
    toast.success(t(language, "paymentSuccess"));
  }

  const routeLine = route?.geometry ?? (pickup && dropoff ? [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]] as [number, number][] : []);

  function openMapPickerFor(target: "pickup" | "dropoff") {
    setMapPickerTarget(target);
    setMapPickerOpen(true);
  }

  function onMapPickerSelect(point: GeoPoint) {
    if (mapPickerTarget === "pickup") setPickup(point);
    else setDropoff(point);
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={t(language, "newOrder")} subtitle={t(language, "bookingStep1")} showBack />

      <div className="flex-1 overflow-y-auto yt-scroll">
        {/* Map preview */}
        <div className="relative h-48 w-full shrink-0">
          <LiveMap
            markers={[
              ...(pickup ? [{ id: "p", lat: pickup.lat, lng: pickup.lng, kind: "pickup" as const }] : []),
              ...(dropoff ? [{ id: "d", lat: dropoff.lat, lng: dropoff.lng, kind: "dropoff" as const }] : []),
            ]}
            route={routeLine.length >= 2 ? routeLine : undefined}
            interactive={false}
          />
        </div>

        <div className="space-y-5 px-4 py-5">
          {/* Route summary with map picker buttons */}
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-card" />
                <span className="my-1 h-8 border-l-2 border-dashed border-border" />
                <span className="h-3 w-3 rounded-full bg-primary ring-4 ring-card" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <button
                  onClick={() => openMapPickerFor("pickup")}
                  className="block w-full text-left"
                >
                  <div className="text-[12px] font-medium text-muted-foreground">{t(language, "pickup")}</div>
                  <div className="flex items-center gap-1.5 text-[14px] font-medium text-foreground">
                    <span className="truncate flex-1">{pickup?.address ?? t(language, "selectOnMap")}</span>
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </div>
                </button>
                <button
                  onClick={() => openMapPickerFor("dropoff")}
                  className="block w-full text-left"
                >
                  <div className="text-[12px] font-medium text-muted-foreground">{t(language, "dropoff")}</div>
                  <div className="flex items-center gap-1.5 text-[14px] font-medium text-foreground">
                    <span className="truncate flex-1">{dropoff?.address ?? t(language, "selectOnMap")}</span>
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </div>
                </button>
              </div>
            </div>
            {loadingRoute ? (
              <div className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t(language, "calculatingRoute")}
              </div>
            ) : route ? (
              <div className="mt-3 flex items-center gap-4 border-t border-border/50 pt-3 text-[13px]">
                <span className="flex items-center gap-1.5 text-foreground"><MapPin className="h-3.5 w-3.5 text-primary" /> {formatKm(distanceKm)}</span>
                <span className="flex items-center gap-1.5 text-foreground"><Clock className="h-3.5 w-3.5 text-primary" /> {formatMin(estimate.etaMin, language)}</span>
              </div>
            ) : null}
          </div>

          {/* Photos — proof of cargo condition (MOVED TO TOP — most important) */}
          {/* Photos — proof of cargo condition (Yandex Go style "take photo of cargo") */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-foreground">
              <Camera className="h-4.5 w-4.5 text-primary" /> {t(language, "cargoPhotos")}
            </h3>
            <p className="mb-3 text-[12px] leading-snug text-muted-foreground">
              {t(language, "cargoPhotosDesc")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="yt-photo-thumb group relative">
                  <img src={p.dataUrl} alt={`Cargo ${i + 1}`} />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-card text-muted-foreground transition hover:border-primary/40 hover:text-primary active:scale-95"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-[11px] font-medium">{t(language, "addPhoto")}</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPickPhoto}
              className="hidden"
            />
          </section>

          {/* Cargo manifest — detailed cargo info (entered by customer) */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-foreground">
              <Boxes className="h-4.5 w-4.5 text-primary" /> {t(language, "cargoDetails")}
            </h3>
            <p className="mb-3 text-[12px] leading-snug text-muted-foreground">
              {t(language, "cargoDetailsDesc")}
            </p>

            <div className="space-y-3">
              {/* Title */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                  {t(language, "cargoTitle")} <span className="text-muted-foreground/60">*</span>
                </label>
                <input
                  value={cargoTitle}
                  onChange={(e) => setCargoTitle(e.target.value)}
                  placeholder={t(language, "cargoTitlePlaceholder")}
                  className="h-12 w-full rounded-xl bg-card px-4 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                  {t(language, "cargoDescription")}
                </label>
                <textarea
                  value={cargoDescription}
                  onChange={(e) => setCargoDescription(e.target.value)}
                  placeholder={t(language, "cargoDescriptionPlaceholder")}
                  rows={2}
                  className="w-full resize-none rounded-xl bg-card p-3.5 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                  {t(language, "cargoCategory")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CARGO_CATEGORIES.map((c) => {
                    const active = cargoCategory === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setCargoCategory(active ? null : c.id)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 transition active:scale-[0.97]",
                          active ? "border-primary bg-primary/5" : "border-border bg-card"
                        )}
                      >
                        <span className="text-xl">{c.emoji}</span>
                        <span className="text-[11px] font-semibold text-foreground">{t(language, c.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dimensions */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                  <Ruler className="h-3.5 w-3.5" /> {t(language, "dimensions")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    inputMode="numeric"
                    value={cargoLengthCm}
                    onChange={(e) => setCargoLengthCm(e.target.value.replace(/\D/g, ""))}
                    placeholder={t(language, "lengthCm")}
                    className="h-11 rounded-xl bg-card px-3 text-[14px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    inputMode="numeric"
                    value={cargoWidthCm}
                    onChange={(e) => setCargoWidthCm(e.target.value.replace(/\D/g, ""))}
                    placeholder={t(language, "widthCm")}
                    className="h-11 rounded-xl bg-card px-3 text-[14px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    inputMode="numeric"
                    value={cargoHeightCm}
                    onChange={(e) => setCargoHeightCm(e.target.value.replace(/\D/g, ""))}
                    placeholder={t(language, "heightCm")}
                    className="h-11 rounded-xl bg-card px-3 text-[14px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Declared value */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                  {t(language, "declaredValue")}
                </label>
                <div className="flex items-stretch gap-2">
                  <input
                    inputMode="numeric"
                    value={cargoValueSom}
                    onChange={(e) => setCargoValueSom(e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                    className="h-12 min-w-0 flex-1 rounded-xl bg-card px-4 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex items-center rounded-xl bg-card px-3.5 ring-1 ring-border/70">
                    <span className="text-[14px] font-medium text-muted-foreground">{t(language, "som")}</span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground/70">{t(language, "declaredValueHint")}</p>
              </div>

              {/* Toggles: fragile + loading help */}
              <div className="space-y-2">
                <ToggleRow
                  icon={ShieldAlert}
                  iconBg="bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  label={t(language, "isFragile")}
                  desc={t(language, "isFragileDesc")}
                  checked={isFragile}
                  onChange={setIsFragile}
                />
                <ToggleRow
                  icon={Package}
                  iconBg="bg-primary/10 text-primary"
                  label={t(language, "needsLoadingHelp")}
                  desc={t(language, "needsLoadingHelpDesc")}
                  checked={needsLoadingHelp}
                  onChange={setNeedsLoadingHelp}
                />
              </div>
            </div>
          </section>

          {/* Cargo type + Weight (moved below cargo details) */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-foreground">
              <Package className="h-4.5 w-4.5 text-primary" /> {t(language, "cargoType")}
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {CARGO_TYPES.map((c) => {
                const active = cargoType === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCargoType(c.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition active:scale-[0.98]",
                      active ? "border-primary bg-primary/5" : "border-border bg-card"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-2xl">{c.emoji}</span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="text-[13px] font-bold leading-tight text-foreground">{t(language, ("cargo_" + c.id) as "cargo_truck_small")}</div>
                    <div className="text-[12px] text-muted-foreground">{c.cap >= 1000 ? `${c.cap / 1000}t ${t(language, "upTo")}` : `${c.cap} kg`}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Weight */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-foreground">
              <Weight className="h-4.5 w-4.5 text-primary" /> {t(language, "weight")}
            </h3>
            <div className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border/60">
              <input
                type="range"
                min={0}
                max={cargoInfo(cargoType).cap}
                step={50}
                value={weight}
                onChange={(e) => setWeight(+e.target.value)}
                className="flex-1 accent-primary"
              />
              <div className="w-20 text-right">
                <span className="text-lg font-bold text-foreground">{weight}</span>
                <span className="text-[13px] text-muted-foreground"> kg</span>
              </div>
            </div>
          </section>

          {/* Note */}
          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-foreground">
              <StickyNote className="h-4.5 w-4.5 text-primary" /> {t(language, "note")}
            </h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(language, "notePlaceholder")}
              rows={2}
              className="w-full resize-none rounded-2xl bg-card p-3.5 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
            />
          </section>

          {/* AI analysis panel */}
          {(aiLoading || aiAnalysis || aiError) && (
            <section className="yt-ai-glow rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[14px] font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t(language, "aiAnalysis")}
                </h3>
                {aiAnalysis && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    aiAnalysis.provider === "gemini" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                    aiAnalysis.provider === "z-ai" && "bg-violet-500/10 text-violet-600 dark:text-violet-400",
                    aiAnalysis.provider === "heuristic" && "bg-muted text-muted-foreground",
                  )}>
                    {aiAnalysis.provider}
                  </span>
                )}
              </div>

              {aiLoading && (
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {t(language, "aiAnalyzing")}
                </div>
              )}

              {aiError && !aiLoading && (
                <div className="flex items-start gap-2 text-[13px] text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {aiAnalysis && !aiLoading && (
                <div className="space-y-3 text-[13px]">
                  {/* Price recommendation */}
                  <div className="flex items-center justify-between rounded-lg bg-card/60 p-2.5">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(language, "aiRecommendedPrice")}</div>
                      <div className="text-[17px] font-bold text-primary">{formatSom(aiAnalysis.recommendedPriceSom, language)}</div>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground">
                      <div>{t(language, "aiPriceRange")}</div>
                      <div>{formatSom(aiAnalysis.priceRangeLow, language)} – {formatSom(aiAnalysis.priceRangeHigh, language)}</div>
                    </div>
                  </div>

                  {/* Cargo description */}
                  {aiAnalysis.cargoDescription && (
                    <AIInsight icon={Package} label={t(language, "aiCargoDescription")} text={aiAnalysis.cargoDescription} />
                  )}

                  {/* Route notes */}
                  {aiAnalysis.routeNotes && (
                    <AIInsight icon={Route} label={t(language, "aiRouteNotes")} text={aiAnalysis.routeNotes} />
                  )}

                  {/* Loading tips */}
                  {aiAnalysis.loadingTips && (
                    <AIInsight icon={Lightbulb} label={t(language, "aiLoadingTips")} text={aiAnalysis.loadingTips} />
                  )}

                  {/* Risk level */}
                  <div className="flex items-center justify-between border-t border-border/40 pt-2">
                    <span className="text-[12px] text-muted-foreground">{t(language, "aiRiskLevel")}</span>
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                      aiAnalysis.riskLevel === "low" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      aiAnalysis.riskLevel === "medium" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                      aiAnalysis.riskLevel === "high" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                    )}>
                      {t(language, `risk_${aiAnalysis.riskLevel}` as "risk_low")}
                    </span>
                  </div>

                  {/* Apply AI recommendation */}
                  {aiAnalysis.recommendedCargoType !== cargoType && (
                    <button
                      onClick={() => setCargoType(aiAnalysis.recommendedCargoType)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-2 text-[12px] font-semibold text-primary transition active:scale-95"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t(language, "aiApplyCargoType")}: {t(language, ("cargo_" + aiAnalysis.recommendedCargoType) as "cargo_truck_small")}
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Price breakdown */}
          <section className="rounded-2xl bg-gradient-to-br from-primary/8 to-primary/3 p-4 ring-1 ring-primary/20">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[15px] font-bold text-foreground">
                <Wallet className="h-4.5 w-4.5 text-primary" /> {t(language, "estimatedPrice")}
              </span>
              <div className="text-right">
                <div className="text-2xl font-extrabold text-primary">{formatSom(estimate.priceSom, language)}</div>
                <div className="text-[12px] text-muted-foreground">{formatMin(estimate.etaMin, language)} · {formatKm(distanceKm)}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-primary/15 pt-3 text-[12px] text-muted-foreground">
              <span>{t(language, "priceBase")}</span><span className="text-right">{formatSom(estimate.breakdown.base, language)}</span>
              <span>{t(language, "priceDistance")} ({formatKm(distanceKm)})</span><span className="text-right">{formatSom(estimate.breakdown.distance, language)}</span>
              <span>{t(language, "priceCargoType")}</span><span className="text-right">{formatSom(estimate.breakdown.cargo, language)}</span>
              {estimate.breakdown.weight > 0 && (<><span>{t(language, "priceWeight")} ({weight}kg)</span><span className="text-right">{formatSom(estimate.breakdown.weight, language)}</span></>)}
            </div>
          </section>

          <p className="flex items-start gap-1.5 text-[12px] leading-snug text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t(language, "priceDisclaimer")}
          </p>
        </div>
      </div>

      {/* CTA — payment status + confirm */}
      <div className="shrink-0 border-t border-border/50 bg-background px-4 py-3 safe-bottom">
        {/* Payment status row */}
        <div className="mb-2 flex items-center justify-between gap-2">
          {paidPayment ? (
            <button
              onClick={() => setPaymentOpen(true)}
              className="flex flex-1 items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-left active:scale-95"
            >
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {paidPayment.method === "CARD"
                    ? `${paidPayment.cardBrand?.toUpperCase()} •••• ${paidPayment.cardLast4}`
                    : t(language, "payByCash")}
                </div>
                <div className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">
                  {t(language, "paid")} · {formatSom(paidPayment.amount, language)}
                </div>
              </div>
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 underline">
                {t(language, "change")}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setPaymentOpen(true)}
              disabled={!pickup || !dropoff}
              className="flex flex-1 items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-left transition active:scale-95 disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">
                  {t(language, "selectPaymentMethod")}
                </div>
                <div className="text-[10px] text-amber-700/70 dark:text-amber-300/70">
                  {t(language, "paymentRequiredDesc")}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </button>
          )}
        </div>

        <button
          onClick={confirmOrder}
          disabled={creating || !pickup || !dropoff || !paidPayment}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {creating ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> {t(language, "searchingDriver")}</>
          ) : (
            <>{t(language, "confirmOrder")} · {formatSom(estimate.priceSom, language)} <ChevronRight className="h-5 w-5" /></>
          )}
        </button>
      </div>

      <AnimatePresence>
        <MapPickerModal
          open={mapPickerOpen}
          onClose={() => setMapPickerOpen(false)}
          onSelect={onMapPickerSelect}
          initialPoint={mapPickerTarget === "pickup" ? pickup : dropoff}
          title={mapPickerTarget === "pickup" ? t(language, "pickupSelect") : t(language, "dropoffSelect")}
          accentColor={mapPickerTarget === "pickup" ? "emerald" : "primary"}
        />
      </AnimatePresence>

      <AnimatePresence>
        {paymentOpen && (
          <CardPayment
            orderId={`draft_${Date.now()}`}
            amount={estimate.priceSom}
            onPaid={onPaid}
            onClose={() => setPaymentOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  iconBg,
  label,
  desc,
  checked,
  onChange,
}: {
  icon: typeof Package;
  iconBg: string;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition active:scale-[0.99]",
        checked ? "border-primary bg-primary/5" : "border-border bg-card"
      )}
    >
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", iconBg)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-foreground">{label}</div>
        <div className="text-[12px] leading-snug text-muted-foreground">{desc}</div>
      </div>
      <div
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </div>
    </button>
  );
}

function AIInsight({ icon: Icon, label, text }: { icon: typeof Package; label: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-[13px] leading-snug text-foreground">{text}</div>
      </div>
    </div>
  );
}

/**
 * Compress image client-side to keep payload small (under ~500KB per photo).
 * Uses canvas resize + JPEG re-encoding.
 */
async function compressImage(dataUrl: string, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
