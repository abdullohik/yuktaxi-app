"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Power, Star, Wallet, TrendingUp, Clock, MapPin, Check, X, Loader2, ChevronRight, Phone, Camera } from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, STATUS_META, DRIVER_NEXT_ACTION, cargoInfo } from "@/lib/api";
import { formatSom, formatKm, formatMin, formatPhone } from "@/lib/format";
import { ScreenHeader } from "../ScreenHeader";
import { StatCard } from "../StatCard";
import { LiveMap, type MapMarker } from "../shared/LiveMap";
import { DriverPhotoCapture } from "./DriverPhotoCapture";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useSocket } from "@/hooks/use-socket";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus, AIComparison } from "@/lib/types";
import { toast } from "sonner";

export function DriverHome() {
  const { language, user, driverOnline, setDriverOnline, navigate, setActiveOrderId } = useApp();
  const { pos } = useGeolocation(driverOnline);
  const [incoming, setIncoming] = useState<Order | null>(null);
  const [countdown, setCountdown] = useState(15);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [stats, setStats] = useState<{ today: number; week: number; trips: number; rating: number }>({ today: 0, week: 0, trips: 0, rating: 5 });
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [target, setTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [photoCaptureOpen, setPhotoCaptureOpen] = useState(false);
  const [aiComparison, setAiComparison] = useState<AIComparison | null>(null);
  const cdRef = useRef<number | null>(null);
  const moveRef = useRef<number | null>(null);

  // load driver stats
  useEffect(() => {
    if (!user) return;
    api<{ ok: boolean; data: { today: number; week: number; totalTrips: number; avgRating: number } }>(`/api/earnings?driverPhone=${user.phone}`)
      .then((r) => {
        const s = { today: r.data.today, week: r.data.week, trips: r.data.totalTrips, rating: r.data.avgRating };
        setStats(s);
        // If all zeros, seed demo data and reload once
        if (s.today === 0 && s.week === 0 && s.trips === 0) {
          api("/api/seed", { method: "POST" })
            .then(() => api<{ ok: boolean; data: { today: number; week: number; totalTrips: number; avgRating: number } }>(`/api/earnings?driverPhone=${user.phone}`)
              .then((r2) => setStats({ today: r2.data.today, week: r2.data.week, trips: r2.data.totalTrips, rating: r2.data.avgRating })))
            .catch(() => {});
        }
      })
      .catch(() => {});
    // load active order if any
    api<{ ok: boolean; data: Order[] }>(`/api/orders?phone=${user.phone}&role=DRIVER`)
      .then((r) => {
        const active = (r.data ?? []).find((o) => ["ACCEPTED", "ARRIVING", "ARRIVED", "LOADED", "IN_TRANSIT"].includes(o.status));
        if (active) {
          setActiveOrder(active);
          setActiveOrderId(active.id);
          setDriverPos({ lat: active.pickupLat + 0.005, lng: active.pickupLng + 0.003 });
          setTarget({ lat: active.pickupLat, lng: active.pickupLng });
        }
      })
      .catch(() => {});
  }, [user]);

  // Listen for incoming orders via WebSocket (real orders from customers)
  // In production, the realtime service broadcasts new orders to nearby drivers.
  // For demo, we still poll the API for new SEARCHING orders assigned to this driver.
  useEffect(() => {
    if (!driverOnline || activeOrder || incoming || !user) return;
    const pollInterval = setInterval(async () => {
      try {
        const r: any = await api(
          `/api/orders?phone=${user.phone}&role=DRIVER`
        );
        // Find orders in ACCEPTED status that we haven't shown yet
        const orders: Order[] = r?.data ?? [];
        const newOrder = orders.find(
          (o: Order) => o.status === "ACCEPTED" && (!activeOrder || o.id !== (activeOrder as Order).id)
        );
        if (newOrder && !incoming) {
          setIncoming(newOrder);
          setCountdown(15);
        }
      } catch {
        // ignore — offline or error
      }
    }, 5000); // poll every 5 seconds
    return () => clearInterval(pollInterval);
  }, [driverOnline, activeOrder, incoming, user]);

  // countdown for incoming order
  useEffect(() => {
    if (!incoming) return;
    cdRef.current = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          // auto-decline: clear + cancel inline
          const orderToCancel = incoming;
          setIncoming(null);
          api(`/api/orders/${orderToCancel.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "driver_declined" }) }).catch(() => {});
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [incoming]);

  // driver movement simulation for active order
  useEffect(() => {
    if (!activeOrder || !driverPos || !target) return;
    moveRef.current = window.setInterval(() => {
      setDriverPos((prev) => {
        if (!prev) return prev;
        const dlat = target.lat - prev.lat;
        const dlng = target.lng - prev.lng;
        const dist = Math.hypot(dlat, dlng);
        if (dist < 0.0008) return prev;
        const move = Math.min(0.001, dist * 0.3);
        return { lat: prev.lat + (dlat / dist) * move, lng: prev.lng + (dlng / dist) * move };
      });
    }, 1500);
    return () => { if (moveRef.current) clearInterval(moveRef.current); };
  }, [activeOrder, driverPos, target]);

  async function accept(order: Order) {
    if (cdRef.current) clearInterval(cdRef.current);
    setIncoming(null);
    setActiveOrder(order);
    setActiveOrderId(order.id);
    setDriverPos({ lat: order.pickupLat + 0.005, lng: order.pickupLng + 0.003 });
    setTarget({ lat: order.pickupLat, lng: order.pickupLng });
    toast.success(t(language, "orderAccepted"));
    // ensure status ACCEPTED (order was created with SEARCHING->ACCEPTED by backend)
  }

  function decline(order: Order) {
    if (cdRef.current) clearInterval(cdRef.current);
    setIncoming(null);
    api(`/api/orders/${order.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "driver_declined" }) }).catch(() => {});
  }

  async function advance() {
    if (!activeOrder) return;
    const next = DRIVER_NEXT_ACTION[activeOrder.status];
    if (!next) return;
    if (next === "ARRIVED" || next === "LOADED") setTarget({ lat: activeOrder.pickupLat, lng: activeOrder.pickupLng });
    if (next === "IN_TRANSIT" || next === "DELIVERED") setTarget({ lat: activeOrder.dropoffLat, lng: activeOrder.dropoffLng });
    try {
      const r = await api<{ ok: boolean; data: Order }>(`/api/orders/${activeOrder.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      setActiveOrder(r.data);
      if (next === "DELIVERED") {
        toast.success(t(language, "delivered"));
        setTimeout(() => {
          setActiveOrder(null);
          setActiveOrderId(null);
          navigate("earnings");
        }, 1200);
      }
    } catch { toast.error(t(language, "error")); }
  }

  const mapMarkers: MapMarker[] = activeOrder ? [
    { id: "p", lat: activeOrder.pickupLat, lng: activeOrder.pickupLng, kind: "pickup" },
    { id: "d", lat: activeOrder.dropoffLat, lng: activeOrder.dropoffLng, kind: "dropoff" },
    ...(driverPos ? [{ id: "me", lat: driverPos.lat, lng: driverPos.lng, kind: "driver" as const }] : []),
  ] : [];

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader brand subtitle={user?.name ? `${t(language, "hello")}, ${user.name}` : t(language, "hello")} />

      {/* Online toggle banner */}
      <div className={cn(
        "shrink-0 px-4 py-3 transition",
        driverOnline ? "bg-emerald-500/10" : "bg-muted/50"
      )}>
        <button
          onClick={() => {
            setDriverOnline(!driverOnline);
            toast.info(driverOnline ? t(language, "goOffline") : t(language, "goOnline"));
          }}
          className={cn(
            "flex h-14 w-full items-center justify-between rounded-2xl px-4 shadow-sm transition active:scale-[0.99]",
            driverOnline ? "bg-emerald-500 text-white" : "bg-card text-foreground ring-1 ring-border/70"
          )}
        >
          <div className="flex items-center gap-3">
            <span className={cn(
              "grid h-10 w-10 place-items-center rounded-full",
              driverOnline ? "bg-white/20" : "bg-muted"
            )}>
              <Power className="h-5 w-5" />
            </span>
            <div className="text-left">
              <div className="text-[16px] font-bold">{driverOnline ? t(language, "goOffline") : t(language, "goOnline")}</div>
              <div className={cn("text-[12px]", driverOnline ? "text-white/80" : "text-muted-foreground")}>
                {driverOnline ? t(language, "youAreOnline") : t(language, "youAreOffline")}
              </div>
            </div>
          </div>
          <span className={cn(
            "relative h-6 w-11 rounded-full transition",
            driverOnline ? "bg-white/30" : "bg-muted"
          )}>
            <span className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
              driverOnline ? "left-[22px]" : "left-0.5 bg-muted-foreground"
            )} />
          </span>
        </button>
      </div>

      {/* Active order or map */}
      {activeOrder ? (
        <ActiveTripView
          order={activeOrder}
          driverPos={driverPos}
          markers={mapMarkers}
          onAdvance={advance}
          onOpenPhotoCapture={() => setPhotoCaptureOpen(true)}
          aiComparison={aiComparison}
          language={language}
        />
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <LiveMap
            center={pos ? [pos.lat, pos.lng] : [41.31218, 69.25138]}
            zoom={14}
            markers={pos ? [{ id: "me", lat: pos.lat, lng: pos.lng, kind: "driver" }] : []}
            interactive
          />
          {/* Idle overlay */}
          {!driverOnline && (
            <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
              <div className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Power className="h-8 w-8" />
                </div>
                <p className="mt-3 text-[15px] font-medium text-muted-foreground">{t(language, "goOnlineToReceive")}</p>
              </div>
            </div>
          )}
          {driverOnline && (
            <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-card/95 p-3.5 shadow-lg ring-1 ring-border/60 backdrop-blur">
              <div className="flex items-center gap-2 text-[14px] font-medium text-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {t(language, "youAreOnline")}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick stats footer */}
      {!activeOrder && (
        <div className="shrink-0 grid grid-cols-3 gap-2.5 border-t border-border/50 bg-background px-4 py-3">
          <StatCard label={t(language, "todayEarnings")} value={formatSom(stats.today, language)} icon={Wallet} accent="success" />
          <StatCard label={t(language, "totalTrips")} value={String(stats.trips)} icon={TrendingUp} accent="primary" />
          <StatCard label={t(language, "avgRating")} value={stats.rating.toFixed(1)} hint="★" icon={Star} accent="warning" />
        </div>
      )}

      {/* Incoming order modal */}
      <AnimatePresence>
        {incoming && (
          <IncomingOrderModal
            order={incoming}
            countdown={countdown}
            onAccept={() => accept(incoming)}
            onDecline={() => decline(incoming)}
            language={language}
          />
        )}
      </AnimatePresence>

      {/* Driver photo capture modal (4 sides + AI compare) — driver-only */}
      <AnimatePresence>
        {photoCaptureOpen && activeOrder && user && (
          <DriverPhotoCapture
            orderId={activeOrder.id}
            driverPhone={user.phone}
            cargoTitle={activeOrder.cargoTitle}
            cargoDescription={activeOrder.cargoDescription}
            cargoCategory={activeOrder.cargoCategory}
            onClose={() => setPhotoCaptureOpen(false)}
            onComplete={(comparison) => {
              setAiComparison(comparison);
              setPhotoCaptureOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ActiveTripView({ order, driverPos, markers, onAdvance, onOpenPhotoCapture, aiComparison, language }: {
  order: Order;
  driverPos: { lat: number; lng: number } | null;
  markers: MapMarker[];
  onAdvance: () => void;
  onOpenPhotoCapture: () => void;
  aiComparison: AIComparison | null;
  language: "uz" | "ru" | "en";
}) {
  const nextStatus = DRIVER_NEXT_ACTION[order.status];
  const actionLabel: Partial<Record<OrderStatus, string>> = {
    ACCEPTED: t(language, "driverActionAccepted"),
    ARRIVING: t(language, "driverActionArrived"),
    ARRIVED: t(language, "driverActionLoaded"),
    LOADED: t(language, "driverActionInTransit"),
    IN_TRANSIT: t(language, "driverActionDelivered"),
  };
  // The 4-side photo capture should be available from ARRIVED onwards (driver is at pickup)
  const canInspect = order.status === "ARRIVED" || order.status === "LOADED" || order.status === "IN_TRANSIT";

  // Build route line: driver → pickup → dropoff (depending on status)
  const routeLine: [number, number][] = (() => {
    if (!driverPos) return [[order.pickupLat, order.pickupLng], [order.dropoffLat, order.dropoffLng]];
    if (order.status === "ACCEPTED" || order.status === "ARRIVING") {
      // Driver heading to pickup
      return [[driverPos.lat, driverPos.lng], [order.pickupLat, order.pickupLng]];
    }
    if (order.status === "ARRIVED" || order.status === "LOADED") {
      // At pickup — show both legs
      return [[order.pickupLat, order.pickupLng], [order.dropoffLat, order.dropoffLng]];
    }
    if (order.status === "IN_TRANSIT" || order.status === "DELIVERED") {
      // Heading to dropoff
      return [[driverPos.lat, driverPos.lng], [order.dropoffLat, order.dropoffLng]];
    }
    return [[order.pickupLat, order.pickupLng], [order.dropoffLat, order.dropoffLng]];
  })();

  // Determine which address to highlight
  const activeAddress = (order.status === "ACCEPTED" || order.status === "ARRIVING")
    ? "pickup"
    : (order.status === "IN_TRANSIT" || order.status === "DELIVERED")
    ? "dropoff"
    : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="relative z-0 h-[38%] min-h-[200px] w-full overflow-hidden">
        <LiveMap markers={markers} route={routeLine} followDriver interactive={false} />
      </div>
      <div className="relative z-10 flex-1 overflow-y-auto yt-scroll rounded-t-3xl bg-background px-4 pb-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        {/* Customer + route */}
        <div className="rounded-2xl bg-card p-3.5 ring-1 ring-border/60">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">👤</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-foreground">{order.customerName ?? t(language, "customer")}</div>
              <a href="tel:+998901234567" className="flex items-center gap-1 text-[13px] text-emerald-600 dark:text-emerald-400">
                <Phone className="h-3.5 w-3.5" /> {formatPhone(order.customerPhone)}
              </a>
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", STATUS_META[order.status].bg, STATUS_META[order.status].color)}>
              {t(language, STATUS_META[order.status].key as "driverArriving")}
            </span>
          </div>
          <div className="mt-3 flex items-start gap-3 border-t border-border/50 pt-3">
            <div className="flex flex-col items-center pt-0.5">
              <span className={cn("h-2.5 w-2.5 rounded-full transition", activeAddress === "pickup" ? "bg-emerald-500 ring-4 ring-emerald-500/20" : "bg-emerald-500/40")} />
              <span className="my-1 h-6 border-l-2 border-dashed border-border" />
              <span className={cn("h-2.5 w-2.5 rounded-full transition", activeAddress === "dropoff" ? "bg-primary ring-4 ring-primary/20" : "bg-primary/40")} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className={cn("truncate text-[14px] font-medium", activeAddress === "pickup" ? "text-foreground" : "text-muted-foreground")}>
                <span className="mr-1 text-[11px] font-semibold uppercase text-emerald-600">{t(language, "pickup")}</span>
                {order.pickupAddress}
                {order.pickupApt && `, кв.${order.pickupApt}`}
                {order.pickupEntrance && `, п.${order.pickupEntrance}`}
                {order.pickupFloor && `, эт.${order.pickupFloor}`}
              </div>
              <div className={cn("truncate text-[14px] font-medium", activeAddress === "dropoff" ? "text-foreground" : "text-muted-foreground")}>
                <span className="mr-1 text-[11px] font-semibold uppercase text-primary">{t(language, "dropoff")}</span>
                {order.dropoffAddress}
                {order.dropoffApt && `, кв.${order.dropoffApt}`}
                {order.dropoffEntrance && `, п.${order.dropoffEntrance}`}
                {order.dropoffFloor && `, эт.${order.dropoffFloor}`}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-[14px]">
            <span className="text-muted-foreground">{formatKm(order.distanceKm)} · {formatMin(order.durationMin, language)}</span>
            <span className="text-lg font-bold text-primary">{formatSom(order.priceSom, language)}</span>
          </div>
          {order.note && (
            <div className="mt-2 rounded-lg bg-amber-500/10 p-2.5 text-[13px] text-amber-700 dark:text-amber-300">
              📝 {order.note}
            </div>
          )}
          {/* Cargo manifest — driver sees what they're carrying */}
          {(order.cargoTitle || order.cargoCategory || order.isFragile || order.needsLoadingHelp || order.cargoValueSom) && (
            <div className="mt-2 rounded-lg bg-primary/5 p-2.5 ring-1 ring-primary/15">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">{t(language, "cargoDetails")}</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-foreground">
                {order.cargoTitle && <span className="font-semibold">{order.cargoTitle}</span>}
                {order.cargoCategory && <span className="text-muted-foreground">{order.cargoCategory}</span>}
                {order.weightKg > 0 && <span>{order.weightKg} kg</span>}
                {order.cargoLengthCm && order.cargoWidthCm && order.cargoHeightCm && (
                  <span className="text-muted-foreground">{order.cargoLengthCm}×{order.cargoWidthCm}×{order.cargoHeightCm} см</span>
                )}
                {order.cargoValueSom && <span className="text-muted-foreground">{t(language, "declaredValue")}: {formatSom(order.cargoValueSom, language)}</span>}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {order.isFragile && (
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    ⚠️ {t(language, "isFragile")}
                  </span>
                )}
                {order.needsLoadingHelp && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    💪 {t(language, "needsLoadingHelp")}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cargo inspection button (driver-only feature) — visible from ARRIVED onwards */}
        {canInspect && (
          <button
            onClick={onOpenPhotoCapture}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-3.5 text-left transition active:scale-[0.99]"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Camera className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-foreground">{t(language, "cargoInspection")}</div>
              <div className="text-[12px] text-muted-foreground">
                {aiComparison
                  ? `${t(language, "matchScore")}: ${aiComparison.matchPercentage}% · ${t(language, "conditionScore")}: ${aiComparison.conditionPercentage}%`
                  : t(language, "captureFourSidesDesc")}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-primary" />
          </button>
        )}

        {/* AI comparison summary (driver-only) */}
        {aiComparison && canInspect && (
          <div className={cn(
            "mt-3 rounded-2xl p-3.5 ring-1",
            aiComparison.recommendation === "OK_TO_PROCEED" && "bg-emerald-500/10 ring-emerald-500/30",
            aiComparison.recommendation === "INSPECT_WITH_CUSTOMER" && "bg-amber-500/10 ring-amber-500/30",
            aiComparison.recommendation === "REFUSE_PICKUP" && "bg-rose-500/10 ring-rose-500/30",
          )}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {t(language, "aiInspectionResult")}
              </span>
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                {t(language, "driverOnly")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">{t(language, "matchScore")}</div>
                <div className={cn(
                  "text-xl font-extrabold",
                  aiComparison.matchPercentage >= 70 ? "text-emerald-600 dark:text-emerald-400"
                    : aiComparison.matchPercentage >= 40 ? "text-amber-600 dark:text-amber-400"
                    : "text-rose-600 dark:text-rose-400"
                )}>{aiComparison.matchPercentage}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">{t(language, "conditionScore")}</div>
                <div className={cn(
                  "text-xl font-extrabold",
                  aiComparison.conditionPercentage >= 60 ? "text-emerald-600 dark:text-emerald-400"
                    : aiComparison.conditionPercentage >= 30 ? "text-amber-600 dark:text-amber-400"
                    : "text-rose-600 dark:text-rose-400"
                )}>{aiComparison.conditionPercentage}%</div>
              </div>
            </div>
            <div className={cn(
              "mt-2 text-[12px] font-semibold",
              aiComparison.recommendation === "OK_TO_PROCEED" && "text-emerald-700 dark:text-emerald-300",
              aiComparison.recommendation === "INSPECT_WITH_CUSTOMER" && "text-amber-700 dark:text-amber-300",
              aiComparison.recommendation === "REFUSE_PICKUP" && "text-rose-700 dark:text-rose-300",
            )}>
              {t(language, `rec_${aiComparison.recommendation}` as "rec_OK_TO_PROCEED")}
            </div>
          </div>
        )}

        {/* Action button */}
        {nextStatus && (
          <button
            onClick={onAdvance}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground shadow-lg shadow-primary/25 active:scale-[0.98]"
          >
            <Check className="h-5 w-5" />
            {actionLabel[order.status] ?? t(language, "nextStep")}
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function IncomingOrderModal({ order, countdown, onAccept, onDecline, language }: {
  order: Order;
  countdown: number;
  onAccept: () => void;
  onDecline: () => void;
  language: "uz" | "ru" | "en";
}) {
  const info = cargoInfo(order.cargoType);
  const pct = (countdown / 15) * 100;
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      className="absolute inset-x-0 bottom-0 z-50 rounded-t-3xl bg-background p-5 pb-6 shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.3)] safe-bottom"
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-xl">{info.emoji}</span>
          <div>
            <div className="text-[15px] font-bold text-foreground">{t(language, "newOrderRequest")}</div>
            <div className="text-[12px] text-muted-foreground">{info.emoji} {t(language, ("cargo_" + order.cargoType) as "cargo_truck_small")} · {order.weightKg} kg</div>
          </div>
        </div>
        {/* countdown ring */}
        <div className="relative grid h-12 w-12 place-items-center">
          <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
            <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary" strokeDasharray={2 * Math.PI * 20} strokeDashoffset={2 * Math.PI * 20 * (1 - pct / 100)} />
          </svg>
          <span className="absolute text-[14px] font-bold text-primary">{countdown}</span>
        </div>
      </div>

      {/* Route */}
      <div className="mt-4 rounded-2xl bg-card p-3.5 ring-1 ring-border/60">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center pt-0.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="my-1 h-8 border-l-2 border-dashed border-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="truncate text-[14px] font-medium text-foreground">{order.pickupAddress}</div>
            <div className="truncate text-[14px] font-medium text-foreground">{order.dropoffAddress}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-center">
          <div><div className="text-[12px] text-muted-foreground">{t(language, "distance")}</div><div className="text-[14px] font-bold text-foreground">{formatKm(order.distanceKm)}</div></div>
          <div><div className="text-[12px] text-muted-foreground">{t(language, "estimatedTime")}</div><div className="text-[14px] font-bold text-foreground">{formatMin(order.durationMin, language)}</div></div>
          <div><div className="text-[12px] text-muted-foreground">{t(language, "estimatedPrice")}</div><div className="text-[14px] font-bold text-primary">{formatSom(order.priceSom, language)}</div></div>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={onDecline}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-[15px] font-bold text-destructive active:scale-[0.98]"
        >
          <X className="h-5 w-5" /> {t(language, "decline")}
        </button>
        <button
          onClick={onAccept}
          className="flex h-14 flex-[1.6] items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground shadow-lg shadow-primary/25 active:scale-[0.98]"
        >
          <Check className="h-5 w-5" /> {t(language, "accept")}
        </button>
      </div>
    </motion.div>
  );
}

// (no trailing exports)
