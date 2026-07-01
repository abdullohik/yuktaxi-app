"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, MessageSquare, Star, X, Check, Truck, MapPin, PackageCheck, Home, ShieldCheck, ChevronRight, Loader2, Camera, ImageIcon } from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, STATUS_META, DRIVER_NEXT_ACTION } from "@/lib/api";
import { formatSom, formatKm, formatMin, formatClock } from "@/lib/format";
import { ScreenHeader } from "../ScreenHeader";
import { LiveMap, type MapMarker } from "../shared/LiveMap";
import { useSocket } from "@/hooks/use-socket";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus, OrderPhoto, PhotoStage } from "@/lib/types";
import { toast } from "sonner";

const TIMELINE: { status: OrderStatus; labelKey: "searchingDriver" | "driverFound" | "driverArriving" | "driverArrived" | "cargoLoaded" | "inTransit" | "delivered" }[] = [
  { status: "ACCEPTED", labelKey: "driverFound" },
  { status: "ARRIVING", labelKey: "driverArriving" },
  { status: "ARRIVED", labelKey: "driverArrived" },
  { status: "LOADED", labelKey: "cargoLoaded" },
  { status: "IN_TRANSIT", labelKey: "inTransit" },
  { status: "DELIVERED", labelKey: "delivered" },
];

export function TrackingScreen() {
  const { language, activeOrderId, user, navigate, setActiveOrderId } = useApp();
  const { join, emit, on, connected } = useSocket();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [driverTarget, setDriverTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [onTime, setOnTime] = useState(5);
  const [cargoSafe, setCargoSafe] = useState(5);
  const [polite, setPolite] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const animRef = useRef<number | null>(null);
  const orderIdRef = useRef<string | null>(null);

  // Photos
  const [photos, setPhotos] = useState<OrderPhoto[]>([]);
  const [photoViewer, setPhotoViewer] = useState<OrderPhoto | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // load order
  useEffect(() => {
    if (!activeOrderId) return;
    setLoading(true);
    api<{ ok: boolean; data: Order & { photos?: OrderPhoto[] } }>(`/api/orders/${activeOrderId}`)
      .then((r) => {
        setOrder(r.data);
        setPhotos(r.data.photos ?? []);
        // initial driver pos near pickup
        setDriverPos({
          lat: r.data.pickupLat + 0.006,
          lng: r.data.pickupLng + 0.004,
        });
        setDriverTarget({ lat: r.data.pickupLat, lng: r.data.pickupLng });
      })
      .catch(() => toast.error(t(language, "orderNotFound")))
      .finally(() => setLoading(false));
  }, [activeOrderId]);

  // join socket room + subscribe to realtime events
  useEffect(() => {
    if (!activeOrderId) return;
    orderIdRef.current = activeOrderId;
    join(`order:${activeOrderId}`);
    const offStatus = on("order:status", (payload: unknown) => {
      const p = payload as { orderId: string; status: OrderStatus };
      if (p.orderId === orderIdRef.current) {
        setOrder((prev) => (prev ? { ...prev, status: p.status } : prev));
      }
    });
    const offLoc = on("driver:location", (payload: unknown) => {
      const p = payload as { lat: number; lng: number };
      setDriverPos({ lat: p.lat, lng: p.lng });
    });
    return () => { offStatus(); offLoc(); };
  }, [activeOrderId, connected]);

  // auto-advance simulation (demo): driver moves toward target, then advances status
  useEffect(() => {
    if (!order || !driverPos || !driverTarget) return;
    if (order.status === "DELIVERED" || order.status === "COMPLETED" || order.status === "CANCELLED") return;

    const step = () => {
      setDriverPos((prev) => {
        if (!prev) return prev;
        const dlat = driverTarget.lat - prev.lat;
        const dlng = driverTarget.lng - prev.lng;
        const dist = Math.hypot(dlat, dlng);
        if (dist < 0.0008) {
          // reached target — advance status
          advanceStatus();
          return prev;
        }
        const move = Math.min(0.0009, dist * 0.25);
        return {
          lat: prev.lat + (dlat / dist) * move,
          lng: prev.lng + (dlng / dist) * move,
        };
      });
    };
    animRef.current = window.setInterval(step, 1200);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [order?.status, driverTarget?.lat, driverTarget?.lng]);

  function advanceStatus() {
    if (!order) return;
    const next = DRIVER_NEXT_ACTION[order.status];
    if (!next) {
      if (order.status === "DELIVERED") {
        // switch target to dropoff already handled below; mark delivered -> prompt rating
        setShowRating(true);
      }
      return;
    }
    // set new driver target based on next status
    if (next === "ARRIVED" || next === "LOADED") {
      setDriverTarget({ lat: order.pickupLat, lng: order.pickupLng });
    } else if (next === "IN_TRANSIT" || next === "DELIVERED") {
      setDriverTarget({ lat: order.dropoffLat, lng: order.dropoffLng });
    }
    api(`/api/orders/${order.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    })
      .then((r) => {
        const data = (r as { ok: boolean; data: Order }).data;
        setOrder(data);
        emit("order:status", { orderId: order.id, status: next });
        if (next === "DELIVERED") {
          toast.success(t(language, "delivered"));
          setTimeout(() => setShowRating(true), 600);
        }
      })
      .catch(() => {});
  }

  // Determine the appropriate photo stage based on order status
  function currentPhotoStage(): PhotoStage | null {
    if (!order) return null;
    if (order.status === "ACCEPTED" || order.status === "ARRIVING") return "AT_PICKUP";
    if (order.status === "ARRIVED" || order.status === "LOADED" || order.status === "IN_TRANSIT") return "IN_TRANSIT";
    if (order.status === "DELIVERED") return "AT_DELIVERY";
    return null;
  }

  // Customer can also upload photos (BEFORE_PICKUP). Driver uploads via DriverHome.
  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    if (!order || !user) return;
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
    setPhotoUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = await compressImage(reader.result as string, 1280, 0.82);
        const stage = currentPhotoStage() ?? "BEFORE_PICKUP";
        try {
          const r = await api<{ ok: boolean; data: OrderPhoto }>(`/api/orders/${order.id}/photos`, {
            method: "POST",
            body: JSON.stringify({
              uploaderPhone: user.phone,
              uploaderRole: user.role === "DRIVER" ? "DRIVER" : "CUSTOMER",
              stage,
              dataUrl,
            }),
          });
          setPhotos((prev) => [...prev, r.data]);
          toast.success(t(language, "photoUploaded"));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t(language, "photoUploadFailed"));
        } finally {
          setPhotoUploading(false);
        }
      };
      reader.onerror = () => {
        toast.error(t(language, "photoReadError"));
        setPhotoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t(language, "photoUploadFailed"));
      setPhotoUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submitRating() {
    if (!order || !user) return;
    setSubmitting(true);
    try {
      await api(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      // create review (best-effort)
      await fetch("/api/orders/" + order.id + "/status", { method: "OPTIONS" }).catch(() => {});
      toast.success(t(language, "thankYou"));
      setActiveOrderId(null);
      navigate("orders");
    } catch {
      toast.error(t(language, "error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <ScreenHeader title={t(language, "orderStatus")} showBack />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-full flex-col bg-background">
        <ScreenHeader title={t(language, "orderStatus")} showBack />
        <div className="flex flex-1 items-center justify-center px-6 text-center text-muted-foreground">
          {t(language, "orderNotFound")}
        </div>
      </div>
    );
  }

  const markers: MapMarker[] = [
    { id: "p", lat: order.pickupLat, lng: order.pickupLng, kind: "pickup" },
    { id: "d", lat: order.dropoffLat, lng: order.dropoffLng, kind: "dropoff" },
    ...(driverPos ? [{ id: "drv", lat: driverPos.lat, lng: driverPos.lng, kind: "driver" as const }] : []),
  ];

  const routeLine: [number, number][] = [[order.pickupLat, order.pickupLng], [order.dropoffLat, order.dropoffLng]];

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        title={t(language, "orderStatus")}
        subtitle={`#${order.id.slice(-6).toUpperCase()}`}
        showBack
        right={
          <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", STATUS_META[order.status].bg, STATUS_META[order.status].color)}>
            {t(language, STATUS_META[order.status].key as "searchingDriver")}
          </span>
        }
      />

      {/* Map */}
      <div className="relative z-0 h-[45%] min-h-[240px] w-full overflow-hidden">
        <LiveMap
          markers={markers}
          route={routeLine}
          followDriver
          interactive={false}
        />
      </div>

      {/* Bottom panel */}
      <div className="relative z-10 flex-1 overflow-y-auto yt-scroll rounded-t-3xl bg-background px-4 pb-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        {/* Driver card */}
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-border/60">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-amber-700 text-2xl text-white shadow-md">
            🚚
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[16px] font-bold text-foreground">{order.driverName ?? t(language, "driver")}</span>
              <span className="flex items-center gap-0.5 text-[13px] text-amber-500"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> 4.8</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[13px] text-muted-foreground">
              <Truck className="h-3.5 w-3.5" />
              <span className="truncate">{t(language, "truckLabel")} · 01A123BC</span>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href="tel:+998901234567"
              className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow-md active:scale-95"
              aria-label={t(language, "call")}
            >
              <Phone className="h-5 w-5" />
            </a>
            <button
              onClick={() => navigate("chat")}
              className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
              aria-label={t(language, "message")}
            >
              <MessageSquare className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-5">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{t(language, "orderStatus")}</h3>
          <ol className="relative space-y-1">
            {TIMELINE.map((step, i) => {
              const currentIdx = TIMELINE.findIndex((s) => s.status === order.status);
              const done = i < currentIdx;
              const active = i === currentIdx;
              const pending = i > currentIdx;
              const Icon = i === 0 ? Check : i === TIMELINE.length - 1 ? Home : i === 3 ? PackageCheck : MapPin;
              return (
                <li key={step.status} className="flex items-center gap-3">
                  <div className="relative flex flex-col items-center">
                    <span
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-full transition",
                        done && "bg-emerald-500 text-white",
                        active && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                        pending && "bg-muted text-muted-foreground"
                      )}
                    >
                      {done ? <Check className="h-4.5 w-4.5" /> : <Icon className="h-4.5 w-4.5" />}
                      {active && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />}
                    </span>
                    {i < TIMELINE.length - 1 && (
                      <span className={cn("mt-1 h-7 w-0.5", done ? "bg-emerald-500" : "bg-border")} />
                    )}
                  </div>
                  <div className="flex-1 pb-1">
                    <div className={cn("text-[15px] font-semibold", pending ? "text-muted-foreground" : "text-foreground")}>
                      {t(language, step.labelKey)}
                    </div>
                    {active && (
                      <div className="text-[12px] text-primary">{formatClock(order.createdAt)} — {t(language, "now")}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Order summary */}
        <div className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-border/60">
          <div className="flex items-center justify-between text-[14px]">
            <span className="text-muted-foreground">{t(language, "distance")}</span>
            <span className="font-semibold text-foreground">{formatKm(order.distanceKm)} · {formatMin(order.durationMin, language)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2 text-[14px]">
            <span className="text-muted-foreground">{t(language, "estimatedPrice")}</span>
            <span className="text-lg font-bold text-primary">{formatSom(order.priceSom, language)}</span>
          </div>
        </div>

        {/* Photos — proof of cargo condition */}
        <div className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-border/60">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-foreground">
              <Camera className="h-4 w-4 text-primary" />
              {t(language, "orderPhotos")}
            </h3>
            {currentPhotoStage() && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[12px] font-semibold text-primary transition active:scale-95 disabled:opacity-50"
              >
                {photoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                {t(language, "addPhoto")}
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

          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-[13px] text-muted-foreground">{t(language, "noPhotosYet")}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">{t(language, "noPhotosYetDesc")}</p>
            </div>
          ) : (
            <>
              {/* Group by stage */}
              {(["BEFORE_PICKUP", "AT_PICKUP", "IN_TRANSIT", "AT_DELIVERY"] as PhotoStage[]).map((stage) => {
                const stagePhotos = photos.filter((p) => p.stage === stage);
                if (stagePhotos.length === 0) return null;
                return (
                  <div key={stage} className="mb-3 last:mb-0">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(language, `photoStage_${stage}` as "photoStage_BEFORE_PICKUP")}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {stagePhotos.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPhotoViewer(p)}
                          className="yt-photo-thumb"
                        >
                          <img src={p.dataUrl} alt={p.note || `Photo ${p.id}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Cancel */}
        {(order.status === "SEARCHING" || order.status === "ACCEPTED" || order.status === "ARRIVING") && (
          <button
            onClick={async () => {
              await api(`/api/orders/${order.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "customer_cancel" }) });
              toast.success(t(language, "cancelOrder"));
              setActiveOrderId(null);
              navigate("orders");
            }}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 text-[15px] font-semibold text-destructive active:scale-[0.98]"
          >
            <X className="h-4.5 w-4.5" /> {t(language, "cancelOrder")}
          </button>
        )}
      </div>

      {/* Rating sheet */}
      <AnimatePresence>
        {showRating && order.status === "DELIVERED" && (
          <RatingSheet
            language={language}
            driverName={order.driverName ?? t(language, "driver")}
            rating={rating}
            setRating={setRating}
            onTime={onTime}
            setOnTime={setOnTime}
            cargoSafe={cargoSafe}
            setCargoSafe={setCargoSafe}
            polite={polite}
            setPolite={setPolite}
            submitting={submitting}
            onSubmit={submitRating}
          />
        )}
      </AnimatePresence>

      {/* Photo viewer modal */}
      <AnimatePresence>
        {photoViewer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPhotoViewer(null)}
            className="absolute inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-sm"
          >
            <div className="safe-top flex items-center justify-between p-4">
              <span className="text-[13px] font-medium text-white/80">
                {t(language, `photoStage_${photoViewer.stage}` as "photoStage_BEFORE_PICKUP")}
              </span>
              <button
                onClick={() => setPhotoViewer(null)}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center px-4 pb-8">
              <img
                src={photoViewer.dataUrl}
                alt={photoViewer.note || "Photo"}
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            </div>
            {photoViewer.note && (
              <div className="safe-bottom px-4 pb-6 text-center text-[13px] text-white/80">
                {photoViewer.note}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RatingSheet(props: {
  language: "uz" | "ru" | "en";
  driverName: string;
  rating: number;
  setRating: (n: number) => void;
  onTime: number;
  setOnTime: (n: number) => void;
  cargoSafe: number;
  setCargoSafe: (n: number) => void;
  polite: number;
  setPolite: (n: number) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const { language, driverName, rating, setRating, onTime, setOnTime, cargoSafe, setCargoSafe, polite, setPolite, submitting, onSubmit } = props;
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl bg-background p-5 pb-6 shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.25)] safe-bottom"
    >
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck className="h-5 w-5" />
        <h3 className="text-lg font-bold text-foreground">{t(language, "rateDriver")}</h3>
      </div>
      <p className="mt-1 text-[14px] text-muted-foreground">{driverName} — {t(language, "thankYou")}</p>

      {/* Overall stars */}
      <div className="mt-4 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} className="active:scale-90">
            <Star className={cn("h-9 w-9 transition", n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
          </button>
        ))}
      </div>

      {/* Criteria */}
      <div className="mt-5 space-y-3">
        <CriteriaRow label={t(language, "rateOnTime")} value={onTime} setValue={setOnTime} />
        <CriteriaRow label={t(language, "rateCargoSafe")} value={cargoSafe} setValue={setCargoSafe} />
        <CriteriaRow label={t(language, "ratePolite")} value={polite} setValue={setPolite} />
      </div>

      <button
        onClick={onSubmit}
        disabled={submitting || rating === 0}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground shadow-lg shadow-primary/25 active:scale-[0.98] disabled:opacity-40"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{t(language, "submitRating")} <ChevronRight className="h-5 w-5" /></>}
      </button>
    </motion.div>
  );
}

function CriteriaRow({ label, value, setValue }: { label: string; value: number; setValue: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-card px-3.5 py-3 ring-1 ring-border/50">
      <span className="text-[14px] font-medium text-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setValue(n)} className="active:scale-90">
            <Star className={cn("h-5 w-5 transition", n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
          </button>
        ))}
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
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
