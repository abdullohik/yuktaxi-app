"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowUpRight,
  Wallet,
  BarChart3,
  PieChart,
  Clock,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { formatSom } from "@/lib/format";
import { ScreenHeader } from "../ScreenHeader";
import { cn } from "@/lib/utils";

interface EarningsData {
  today: number;
  week: number;
  month: number;
  lastWeek: number;
  lastMonth: number;
  weekChange: number;
  monthChange: number;
  totalPayouts: number;
  pendingPayouts: number;
  commissionEarned: number;
  dailyBreakdown: { date: string; revenue: number; orders: number }[];
  topDrivers: { name: string; earnings: number; trips: number }[];
}

export function FleetEarnings() {
  const { language } = useApp();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month">("week");

  useEffect(() => {
    loadEarnings();
  }, []);

  async function loadEarnings() {
    try {
      const r = await api<{ ok: boolean; data: EarningsData }>(`/api/fleet/earnings?period=${period}`);
      setData(r.data);
    } catch {
      // Demo data
      setData({
        today: 4850000,
        week: 32450000,
        month: 145000000,
        lastWeek: 28900000,
        lastMonth: 128000000,
        weekChange: 12.3,
        monthChange: 13.3,
        totalPayouts: 120000000,
        pendingPayouts: 8500000,
        commissionEarned: 25000000,
        dailyBreakdown: [
          { date: "Dush", revenue: 5200000, orders: 24 },
          { date: "Sesh", revenue: 4800000, orders: 21 },
          { date: "Chor", revenue: 6100000, orders: 28 },
          { date: "Pay", revenue: 5500000, orders: 25 },
          { date: "Jum", revenue: 7200000, orders: 32 },
          { date: "Shan", revenue: 4800000, orders: 22 },
          { date: "Yak", revenue: 4500000, orders: 20 },
        ],
        topDrivers: [
          { name: "Jasur Umarov", earnings: 4800000, trips: 18 },
          { name: "Sardor Karimov", earnings: 3900000, trips: 15 },
          { name: "Sherzod Xolmatov", earnings: 3200000, trips: 14 },
          { name: "Bobur Toshmatov", earnings: 2800000, trips: 12 },
          { name: "Doston Rahimov", earnings: 2400000, trips: 10 },
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex h-full flex-col bg-background">
        <ScreenHeader title={t(language, "earnings")} />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.dailyBreakdown.map((d) => d.revenue));

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={t(language, "earnings")} />

      <div className="flex-1 overflow-y-auto yt-scroll px-4 pb-6">
        {/* Period Toggle */}
        <div className="mt-4 flex rounded-xl bg-muted p-1">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "flex-1 rounded-lg py-2 text-[13px] font-semibold transition",
                period === p
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              {p === "week" ? t(language, "week") : t(language, "month")}
            </button>
          ))}
        </div>

        {/* Main Revenue Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl bg-gradient-to-br from-primary via-amber-700 to-amber-900 p-5 shadow-xl shadow-primary/20"
        >
          <div className="text-[12px] font-medium uppercase tracking-wider text-white/60">
            {period === "week" ? t(language, "thisWeek") : t(language, "thisMonth")} {t(language, "revenue")}
          </div>
          <div className="mt-1 text-3xl font-black text-white">
            {formatSom(period === "week" ? data.week : data.month)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[13px] text-emerald-300">
            {(period === "week" ? data.weekChange > 0 : data.monthChange > 0) ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>
              {Math.abs(period === "week" ? data.weekChange : data.monthChange).toFixed(1)}%
              {t(language, "vsLast")} {period === "week" ? t(language, "week").toLowerCase() : t(language, "month").toLowerCase()}
            </span>
          </div>
        </motion.div>

        {/* Revenue Stats */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <RevenueStat
            icon={DollarSign}
            label={t(language, "today")}
            value={formatSom(data.today)}
          />
          <RevenueStat
            icon={Wallet}
            label={t(language, "commission")}
            value={formatSom(data.commissionEarned)}
          />
          <RevenueStat
            icon={ArrowUpRight}
            label={t(language, "totalPayouts")}
            value={formatSom(data.totalPayouts)}
          />
          <RevenueStat
            icon={Clock}
            label={t(language, "pendingPayouts")}
            value={formatSom(data.pendingPayouts)}
          />
        </div>

        {/* Daily Chart */}
        <div className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-border/60">
          <h3 className="text-sm font-bold text-foreground">{t(language, "dailyBreakdown")}</h3>
          <div className="mt-4 flex items-end gap-2 h-32">
            {data.dailyBreakdown.map((day, i) => {
              const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-medium text-muted-foreground">
                    {(day.revenue / 1000000).toFixed(1)}M
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: i * 0.05, duration: 0.4 }}
                    className={cn(
                      "w-full rounded-t-md min-w-[16px]",
                      i === 4 ? "bg-primary" : "bg-primary/25"
                    )}
                  />
                  <span className="text-[10px] text-muted-foreground font-medium">{day.date}</span>
                  <span className="text-[9px] text-muted-foreground">{day.orders}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {t(language, "highest")}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary/25" />
              {t(language, "other")}
            </span>
          </div>
        </div>

        {/* Top Drivers */}
        <div className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-border/60">
          <h3 className="text-sm font-bold text-foreground">{t(language, "topDriversThisWeek")}</h3>
          <div className="mt-3 space-y-2.5">
            {data.topDrivers.map((driver, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" :
                  i === 1 ? "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300" :
                  i === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" :
                  "bg-muted text-muted-foreground"
                )}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-foreground">{driver.name}</div>
                  <div className="text-[11px] text-muted-foreground">{driver.trips} {t(language, "trips")}</div>
                </div>
                <span className="text-[13px] font-bold text-primary">{formatSom(driver.earnings)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Distribution */}
        <div className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-border/60">
          <h3 className="text-sm font-bold text-foreground">{t(language, "revenueDistribution")}</h3>
          <div className="mt-3 space-y-3">
            <DistributionBar label={t(language, "fuelCosts")} value={35} color="bg-destructive" />
            <DistributionBar label={t(language, "driverPayouts")} value={45} color="bg-primary" />
            <DistributionBar label={t(language, "maintenance")} value={8} color="bg-amber-500" />
            <DistributionBar label={t(language, "netProfit")} value={12} color="bg-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueStat({ icon: Icon, label, value }: {
  icon: typeof DollarSign;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-border/60">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="mt-1 text-[15px] font-bold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function DistributionBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className="text-[12px] font-bold text-foreground">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6 }}
          className={cn("h-2 rounded-full", color)}
        />
      </div>
    </div>
  );
}
