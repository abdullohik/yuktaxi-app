"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Search,
  Filter,
  MapPin,
  Clock,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, STATUS_META } from "@/lib/api";
import { formatSom } from "@/lib/format";
import { ScreenHeader } from "../ScreenHeader";
import { cn } from "@/lib/utils";

interface FleetOrder {
  id: string;
  customerPhone: string;
  customerName: string | null;
  driverPhone: string | null;
  driverName: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  cargoType: string;
  status: string;
  priceSom: number;
  distanceKm: number;
  createdAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
}

export function FleetOrders() {
  const { language } = useApp();
  const [orders, setOrders] = useState<FleetOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<FleetOrder | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      const r = await api<{ ok: boolean; data: FleetOrder[] }>("/api/fleet/orders");
      setOrders(r.data);
    } catch {
      // Demo data
      setOrders([
        { id: "1", customerPhone: "998901234567", customerName: "Alisher", driverPhone: "998911112233", driverName: "Sardor K.", pickupAddress: "Chilanzar 9-kvartal, Toshkent", dropoffAddress: "Mirzo Ulug'bek ko'chasi, 15", cargoType: "truck_medium", status: "IN_TRANSIT", priceSom: 180000, distanceKm: 12, createdAt: new Date(Date.now() - 3600000).toISOString(), acceptedAt: new Date(Date.now() - 3000000).toISOString(), deliveredAt: null },
        { id: "2", customerPhone: "998903456789", customerName: "Nodira", driverPhone: "998912233445", driverName: "Bobur T.", pickupAddress: "Yunusobod 5-mavze", dropoffAddress: "Sergeli tumani", cargoType: "truck_small", status: "ACCEPTED", priceSom: 95000, distanceKm: 8, createdAt: new Date(Date.now() - 1800000).toISOString(), acceptedAt: new Date(Date.now() - 900000).toISOString(), deliveredAt: null },
        { id: "3", customerPhone: "998905678901", customerName: "Dilshod", driverPhone: null, driverName: null, pickupAddress: "Shayxontohur, Toshkent", dropoffAddress: "Bektemir, Toshkent", cargoType: "van", status: "SEARCHING", priceSom: 65000, distanceKm: 6, createdAt: new Date(Date.now() - 600000).toISOString(), acceptedAt: null, deliveredAt: null },
        { id: "4", customerPhone: "998907890123", customerName: "Gulnora", driverPhone: "998913344556", driverName: "Jasur U.", pickupAddress: "Olmazor, Toshkent", dropoffAddress: "Chilonzor, Toshkent", cargoType: "truck_large", status: "COMPLETED", priceSom: 250000, distanceKm: 15, createdAt: new Date(Date.now() - 86400000).toISOString(), acceptedAt: new Date(Date.now() - 86000000).toISOString(), deliveredAt: new Date(Date.now() - 80000000).toISOString() },
        { id: "5", customerPhone: "998909012345", customerName: "Jasur", driverPhone: "998914455667", driverName: "Doston R.", pickupAddress: "Uchtepa, Toshkent", dropoffAddress: "Yashnobod, Toshkent", cargoType: "pickup", status: "CANCELLED", priceSom: 45000, distanceKm: 4, createdAt: new Date(Date.now() - 172800000).toISOString(), acceptedAt: new Date(Date.now() - 172000000).toISOString(), deliveredAt: null },
        { id: "6", customerPhone: "998901122334", customerName: "Madina", driverPhone: "998916677889", driverName: "Sherzod X.", pickupAddress: "Hamza ko'chasi, 22", dropoffAddress: "Farg'ona yo'li, Toshkent", cargoType: "truck_medium", status: "DELIVERED", priceSom: 150000, distanceKm: 10, createdAt: new Date(Date.now() - 43200000).toISOString(), acceptedAt: new Date(Date.now() - 43000000).toISOString(), deliveredAt: new Date(Date.now() - 40000000).toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function cancelOrder(orderId: string) {
    try {
      await api(`/api/orders/${orderId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      toast.success(t(language, "orderCancelled"));
      loadOrders();
      setSelectedOrder(null);
    } catch {
      // silent
    }
  }

  const statuses = ["all", "SEARCHING", "ACCEPTED", "IN_TRANSIT", "COMPLETED", "CANCELLED"];
  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.pickupAddress.toLowerCase().includes(q) ||
        o.dropoffAddress.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.id.includes(q)
      );
    }
    return true;
  });

  const activeOrders = orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status)).length;
  const completedToday = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        title={t(language, "allOrders")}
        right={
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              {activeOrders} {t(language, "active")}
            </div>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto yt-scroll px-4 pb-6">
        {/* Stats */}
        <div className="mt-4 flex gap-2">
          <div className="flex-1 rounded-xl bg-card p-3 ring-1 ring-border/60">
            <div className="text-lg font-black text-foreground">{orders.length}</div>
            <div className="text-[11px] text-muted-foreground">{t(language, "totalOrders")}</div>
          </div>
          <div className="flex-1 rounded-xl bg-card p-3 ring-1 ring-border/60">
            <div className="text-lg font-black text-amber-600 dark:text-amber-400">{activeOrders}</div>
            <div className="text-[11px] text-muted-foreground">{t(language, "activeOrders")}</div>
          </div>
          <div className="flex-1 rounded-xl bg-card p-3 ring-1 ring-border/60">
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{completedToday}</div>
            <div className="text-[11px] text-muted-foreground">{t(language, "completed")}</div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(language, "searchOrders")}
            className="h-11 w-full rounded-xl bg-card pl-9 pr-4 text-[14px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Status Filters */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground ring-1 ring-border/60"
              )}
            >
              {s === "all" ? t(language, "all") : (STATUS_META[s as keyof typeof STATUS_META]?.key ? t(language, STATUS_META[s as keyof typeof STATUS_META].key) : s)}
            </button>
          ))}
        </div>

        {/* Order List */}
        {loading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 text-center text-[14px] text-muted-foreground">
            {t(language, "noOrders")}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                language={language}
                onClick={() => setSelectedOrder(order)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="w-full max-h-[85%] overflow-y-auto rounded-t-3xl bg-background p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              <OrderDetail order={selectedOrder} language={language} onClose={() => setSelectedOrder(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OrderCard({ order, language, onClick }: {
  order: FleetOrder;
  language: "uz" | "ru" | "en";
  onClick: () => void;
}) {
  const statusMeta = STATUS_META[order.status as keyof typeof STATUS_META];
  const statusLabel = statusMeta ? t(language, statusMeta.key) : order.status;

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full rounded-2xl bg-card p-3.5 text-left ring-1 ring-border/60 transition hover:ring-primary/30"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          "rounded-md px-2 py-0.5 text-[10px] font-semibold",
          statusMeta?.bg, statusMeta?.color
        )}>
          {statusLabel}
        </span>
        <span className="text-[14px] font-bold text-foreground">{formatSom(order.priceSom)}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="text-[12px] text-muted-foreground truncate">{order.pickupAddress}</span>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-[12px] text-muted-foreground truncate">{order.dropoffAddress}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{order.driverName || t(language, "noDriver")}</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTimeAgo(order.createdAt)}
        </span>
      </div>
    </motion.button>
  );
}

function OrderDetail({ order, language, onClose }: {
  order: FleetOrder;
  language: "uz" | "ru" | "en";
  onClose: () => void;
}) {
  const statusMeta = STATUS_META[order.status as keyof typeof STATUS_META];
  const statusLabel = statusMeta ? t(language, statusMeta.key) : order.status;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">#{order.id.slice(-6)}</h2>
        <span className={cn(
          "rounded-lg px-2.5 py-1 text-[12px] font-semibold",
          statusMeta?.bg, statusMeta?.color
        )}>
          {statusLabel}
        </span>
      </div>

      {/* Route */}
      <div className="rounded-xl bg-card p-3 ring-1 ring-border/60 space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex flex-col items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <div className="h-8 w-0.5 bg-border" />
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <span className="text-[11px] text-muted-foreground">{t(language, "pickup")}</span>
              <p className="text-[13px] font-medium text-foreground">{order.pickupAddress}</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">{t(language, "dropoff")}</span>
              <p className="text-[13px] font-medium text-foreground">{order.dropoffAddress}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-2">
        <DetailItem label={t(language, "price")} value={formatSom(order.priceSom)} />
        <DetailItem label={t(language, "distance")} value={`${order.distanceKm} km`} />
        <DetailItem label={t(language, "cargoType")} value={order.cargoType} />
        <DetailItem label={t(language, "createdAt")} value={formatTimeAgo(order.createdAt)} />
      </div>

      {/* People */}
      <div className="rounded-xl bg-card p-3 ring-1 ring-border/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">{t(language, "customer")}</span>
          <span className="text-[13px] font-medium text-foreground">{order.customerName || order.customerPhone}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">{t(language, "driver")}</span>
          <span className="text-[13px] font-medium text-foreground">{order.driverName || "—"}</span>
        </div>
      </div>

      <button
        onClick={onClose}
        className="h-12 w-full rounded-2xl bg-card text-[15px] font-medium text-foreground ring-1 ring-border/60 transition active:scale-[0.98]"
      >
        {t(language, "close")}
      </button>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card p-2.5 ring-1 ring-border/60">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-[14px] font-bold text-foreground">{value}</div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hozir";
  if (mins < 60) return `${mins} daq`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} soat`;
  const days = Math.floor(hours / 24);
  return `${days} kun`;
}
