"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Truck,
  Users,
  Package,
  TrendingUp,
  Clock,
  DollarSign,
  ChevronRight,
  MapPin,
  Star,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { formatSom } from "@/lib/format";
import { ScreenHeader } from "../ScreenHeader";
import { cn } from "@/lib/utils";

interface FleetStats {
  totalDrivers: number;
  onlineDrivers: number;
  totalTrucks: number;
  activeOrders: number;
  completedToday: number;
  todayRevenue: number;
  weekRevenue: number;
  avgRating: number;
}

interface RecentOrder {
  id: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
  priceSom: number;
  driverPhone: string | null;
  createdAt: string;
}

export function FleetHome() {
  const { language, user, navigate } = useApp();
  const [stats, setStats] = useState<FleetStats>({
    totalDrivers: 0, onlineDrivers: 0, totalTrucks: 0,
    activeOrders: 0, completedToday: 0, todayRevenue: 0,
    weekRevenue: 0, avgRating: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        api<{ ok: boolean; data: FleetStats }>("/api/fleet/dashboard"),
        api<{ ok: boolean; data: RecentOrder[] }>("/api/fleet/recent-orders"),
      ]);
      setStats(statsRes.data);
      setRecentOrders(ordersRes.data);
      // If all stats are zero and no orders, seed demo data and reload once
      const isEmpty = statsRes.data.totalDrivers === 0 && statsRes.data.activeOrders === 0 && statsRes.data.todayRevenue === 0 && ordersRes.data.length === 0;
      if (isEmpty) {
        await api("/api/seed", { method: "POST" });
        const [statsRes2, ordersRes2] = await Promise.all([
          api<{ ok: boolean; data: FleetStats }>("/api/fleet/dashboard"),
          api<{ ok: boolean; data: RecentOrder[] }>("/api/fleet/recent-orders"),
        ]);
        setStats(statsRes2.data);
        setRecentOrders(ordersRes2.data);
      }
    } catch {
      // fallback to demo data
      setStats({
        totalDrivers: 12, onlineDrivers: 8, totalTrucks: 15,
        activeOrders: 6, completedToday: 23, todayRevenue: 4850000,
        weekRevenue: 32450000, avgRating: 4.7,
      });
      setRecentOrders([
        { id: "1", customerPhone: "998901234567", pickupAddress: "Chilanzar, Toshkent", dropoffAddress: "Mirzo Ulug'bek, Toshkent", status: "IN_TRANSIT", priceSom: 180000, driverPhone: "998911112233", createdAt: new Date().toISOString() },
        { id: "2", customerPhone: "998903456789", pickupAddress: "Yunusobod, Toshkent", dropoffAddress: "Sergeli, Toshkent", status: "ACCEPTED", priceSom: 220000, driverPhone: "998912233445", createdAt: new Date().toISOString() },
        { id: "3", customerPhone: "998905678901", pickupAddress: "Shayxontohur, Toshkent", dropoffAddress: "Bektemir, Toshkent", status: "SEARCHING", priceSom: 95000, driverPhone: null, createdAt: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const greeting = user?.name ? `${t(language, "hello")}, ${user.name}!` : t(language, "hello");

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        brand
        subtitle={greeting}
        right={
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
              {stats.onlineDrivers}/{stats.totalDrivers} {t(language, "online")}
            </span>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto yt-scroll px-4 pb-6">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <StatCard
            icon={Truck}
            label={t(language, "activeOrders")}
            value={String(stats.activeOrders)}
            color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
          <StatCard
            icon={Package}
            label={t(language, "completedToday")}
            value={String(stats.completedToday)}
            color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            icon={DollarSign}
            label={t(language, "todayRevenue")}
            value={formatSom(stats.todayRevenue)}
            color="bg-primary/10 text-primary"
          />
          <StatCard
            icon={Star}
            label={t(language, "avgRating")}
            value={stats.avgRating.toFixed(1)}
            color="bg-rose-500/10 text-rose-600 dark:text-rose-400"
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-5">
          <h3 className="mb-3 text-sm font-bold text-foreground">{t(language, "quickActions")}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <QuickAction
              icon={Users}
              label={t(language, "manageDrivers")}
              desc={t(language, "manageDriversDesc")}
              color="from-emerald-500 to-teal-600"
              onClick={() => navigate("fleet_drivers")}
            />
            <QuickAction
              icon={Truck}
              label={t(language, "manageTrucks")}
              desc={t(language, "manageTrucksDesc")}
              color="from-amber-500 to-orange-600"
              onClick={() => navigate("fleet_trucks")}
            />
            <QuickAction
              icon={Package}
              label={t(language, "allOrders")}
              desc={t(language, "allOrdersDesc")}
              color="from-primary to-amber-700"
              onClick={() => navigate("fleet_orders")}
            />
            <QuickAction
              icon={TrendingUp}
              label={t(language, "earningsReport")}
              desc={t(language, "earningsReportDesc")}
              color="from-rose-500 to-pink-600"
              onClick={() => navigate("fleet_earnings")}
            />
          </div>
        </div>

        {/* Revenue Overview */}
        <div className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-border/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">{t(language, "revenueOverview")}</h3>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {t(language, "thisWeek")}
            </span>
          </div>
          <div className="text-2xl font-black text-foreground">{formatSom(stats.weekRevenue)}</div>
          <div className="mt-1 flex items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            <span>+12.5% {t(language, "vsLastWeek")}</span>
          </div>
          {/* Simple bar chart */}
          <div className="mt-3 flex items-end gap-1 h-16">
            {[40, 65, 50, 80, 70, 90, 55].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className={cn(
                    "w-full rounded-t-sm min-w-[8px]",
                    i === 5 ? "bg-primary" : "bg-primary/20"
                  )}
                />
                <span className="text-[9px] text-muted-foreground">
                  {["D", "S", "C", "P", "J", "S", "Y"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">{t(language, "recentOrders")}</h3>
            <button
              onClick={() => navigate("fleet_orders")}
              className="flex items-center gap-1 text-[12px] font-semibold text-primary"
            >
              {t(language, "viewAll")}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            {recentOrders.map((order) => (
              <OrderCard key={order.id} order={order} language={language} />
            ))}
          </div>
        </div>

        {/* Online Drivers Indicator */}
        <div className="mt-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-4 ring-1 ring-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">
                {stats.onlineDrivers} {t(language, "driversOnlineNow")}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {stats.totalDrivers - stats.onlineDrivers} {t(language, "driversOffline")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Truck;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className="rounded-2xl bg-card p-3.5 ring-1 ring-border/60"
    >
      <div className={cn("mb-2 grid h-9 w-9 place-items-center rounded-xl", color)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="text-lg font-black text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </motion.div>
  );
}

function QuickAction({ icon: Icon, label, desc, color, onClick }: {
  icon: typeof Users;
  label: string;
  desc: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex items-start gap-2.5 rounded-2xl bg-card p-3.5 text-left ring-1 ring-border/60 transition hover:ring-primary/30"
    >
      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
    </motion.button>
  );
}

function OrderCard({ order, language }: { order: RecentOrder; language: "uz" | "ru" | "en" }) {
  const statusColors: Record<string, string> = {
    SEARCHING: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    ACCEPTED: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    IN_TRANSIT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  };
  const statusLabels: Record<string, string> = {
    SEARCHING: t(language, "searchingDriver"),
    ACCEPTED: t(language, "driverFound"),
    IN_TRANSIT: t(language, "inTransit"),
    DELIVERED: t(language, "delivered"),
    COMPLETED: t(language, "orderCompleted"),
  };

  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-border/60">
      <div className="flex items-center justify-between mb-2">
        <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", statusColors[order.status] || "bg-muted text-muted-foreground")}>
          {statusLabels[order.status] || order.status}
        </span>
        <span className="text-sm font-bold text-foreground">{formatSom(order.priceSom)}</span>
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
    </div>
  );
}
