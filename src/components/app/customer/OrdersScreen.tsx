"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Package, RotateCcw, Plus, Clock, MapPin, ChevronRight, Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, STATUS_META } from "@/lib/api";
import { formatSom, formatDate, timeAgo } from "@/lib/format";
import { ScreenHeader } from "../ScreenHeader";
import { EmptyState } from "../EmptyState";
import { StatusBadge } from "../StatusBadge";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { toast } from "sonner";

const ACTIVE = ["SEARCHING", "ACCEPTED", "ARRIVING", "ARRIVED", "LOADED", "IN_TRANSIT", "DELIVERED"];

export function OrdersScreen() {
  const { language, user, isGuest, role, navigate, setActiveOrderId, setBookingDraft } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "history">("active");

  useEffect(() => {
    if (!user || isGuest) return;
    let alive = true;
    api<{ ok: boolean; data: Order[] }>(`/api/orders?phone=${user.phone}&role=${role}`)
      .then((r) => { if (alive) setOrders(r.data ?? []); })
      .catch(() => { if (alive) setOrders([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user, isGuest, role]);

  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const history = orders.filter((o) => !ACTIVE.includes(o.status));
  const shown = tab === "active" ? active : history;

  if (isGuest) {
    return (
      <div className="flex h-full flex-col bg-background">
        <ScreenHeader title={t(language, "orders")} />
        <EmptyState
          icon={Package}
          title={t(language, "noOrders")}
          description={t(language, "noOrdersDesc")}
          actionLabel={t(language, "enterPhone")}
          onAction={() => navigate("auth")}
          className="flex-1"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        title={t(language, "orders")}
        subtitle={user?.name ?? undefined}
        right={
          role === "CUSTOMER" ? (
            <button
              onClick={() => navigate("customer_home")}
              className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50 px-4 py-2">
        <TabBtn active={tab === "active"} onClick={() => setTab("active")} label={t(language, "activeOrders")} count={active.length} />
        <TabBtn active={tab === "history"} onClick={() => setTab("history")} label={t(language, "historyOrders")} count={history.length} />
      </div>

      <div className="flex-1 overflow-y-auto yt-scroll px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Package}
            title={tab === "active" ? t(language, "noActiveOrders") : t(language, "noOrders")}
            description={tab === "active"
              ? t(language, "noActiveOrdersDesc")
              : t(language, "noOrdersDesc")}
            actionLabel={role === "CUSTOMER" ? t(language, "newOrder") : undefined}
            onAction={role === "CUSTOMER" ? () => navigate("customer_home") : undefined}
            className="flex-1"
          />
        ) : (
          <div className="space-y-3">
            {shown.map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <OrderCard
                  order={o}
                  language={language}
                  onOpen={() => {
                    setActiveOrderId(o.id);
                    navigate(role === "DRIVER" ? "driver_trip" : "tracking");
                  }}
                  onRepeat={role === "CUSTOMER" ? async () => {
                    setBookingDraft({
                      pickup: { lat: o.pickupLat, lng: o.pickupLng, address: o.pickupAddress },
                      dropoff: { lat: o.dropoffLat, lng: o.dropoffLng, address: o.dropoffAddress },
                    });
                    navigate("booking");
                  } : undefined}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex h-11 items-center gap-1.5 rounded-lg px-3.5 text-[14px] font-semibold transition",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      {label}
      {count > 0 && (
        <span className={cn("rounded-full px-1.5 py-0.5 text-[11px]", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {count}
        </span>
      )}
      {active && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-2 h-0.5 rounded-full bg-primary" />}
    </button>
  );
}

function OrderCard({ order, language, onOpen, onRepeat }: { order: Order; language: "uz"|"ru"|"en"; onOpen: () => void; onRepeat?: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
      <button onClick={onOpen} className="w-full p-4 text-left active:scale-[0.99]">
        <div className="mb-3 flex items-center justify-between">
          <StatusBadge status={order.status} size="sm" />
          <span className="text-[12px] text-muted-foreground">#{order.id.slice(-6).toUpperCase()}</span>
        </div>
        {/* Route */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center pt-0.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="my-1 h-6 border-l-2 border-dashed border-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="truncate text-[14px] font-medium text-foreground">{order.pickupAddress}</div>
            <div className="truncate text-[14px] font-medium text-foreground">{order.dropoffAddress}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
          <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {timeAgo(order.createdAt, language)}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {order.distanceKm.toFixed(1)} km</span>
          </div>
          <span className="text-[15px] font-bold text-foreground">{formatSom(order.priceSom, language)}</span>
        </div>
      </button>
      {onRepeat && (order.status === "COMPLETED" || order.status === "CANCELLED") && (
        <button
          onClick={onRepeat}
          className="flex w-full items-center justify-center gap-2 border-t border-border/50 bg-primary/5 py-2.5 text-[13px] font-semibold text-primary active:bg-primary/10"
        >
          <RotateCcw className="h-3.5 w-3.5" /> {t(language, "repeatOrder")}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
