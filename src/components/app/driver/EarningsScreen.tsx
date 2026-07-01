"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, Star, Truck, ArrowDownToLine, BarChart3, Loader2, ChevronRight } from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { formatSom, formatDate } from "@/lib/format";
import { ScreenHeader } from "../ScreenHeader";
import { StatCard } from "../StatCard";
import { EmptyState } from "../EmptyState";
import { cn } from "@/lib/utils";
import type { EarningsSummary } from "@/lib/types";
import { toast } from "sonner";

export function EarningsScreen() {
  const { language, user, isGuest, navigate } = useApp();
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");

  useEffect(() => {
    if (!user || isGuest) return;
    let alive = true;
    api<{ ok: boolean; data: EarningsSummary }>(`/api/earnings?driverPhone=${user.phone}`)
      .then((r) => { if (alive) setData(r.data); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user, isGuest]);

  if (isGuest) {
    return (
      <div className="flex h-full flex-col bg-background">
        <ScreenHeader title={t(language, "earnings")} />
        <EmptyState icon={Wallet} title="Kirish kerak" description="Daromadni ko'rish uchun tizimga kiring" actionLabel={t(language, "enterPhone")} onAction={() => navigate("auth")} className="flex-1" />
      </div>
    );
  }

  const hasData = data && (data.history.some((h) => h.total > 0) || data.totalTrips > 0);
  const maxBar = Math.max(1, ...(data?.history.map((h) => h.total) ?? [0]));

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={t(language, "earnings")} subtitle={user?.name ?? undefined} />

      <div className="flex-1 overflow-y-auto yt-scroll px-4 pb-6 pt-4">
        {loading ? (
          <div className="flex h-full items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : !data ? (
          <EmptyState icon={Wallet} title="Ma'lumot yo'q" description="Hozircha daromad ma'lumotlari mavjud emas." className="flex-1" />
        ) : (
          <>
            {/* Balance hero card — per audit: big number center, full-width withdraw button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-amber-700 p-5 text-primary-foreground shadow-xl shadow-primary/30"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-12 -left-4 h-32 w-32 rounded-full bg-black/10" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-primary-foreground/80">{t(language, "balance")}</span>
                  <Wallet className="h-5 w-5 text-primary-foreground/70" />
                </div>
                <div className="mt-1.5 text-4xl font-extrabold tracking-tight">
                  {formatSom(data.balance, language)}
                </div>
                <button
                  onClick={() => toast.info("Pul yechish so'rovi yuborildi", { description: "Admin 24 soat ichida tasdiqlaydi" })}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-foreground/95 text-[15px] font-bold text-primary shadow-md transition active:scale-[0.98]"
                >
                  <ArrowDownToLine className="h-5 w-5" />
                  {t(language, "withdraw")}
                </button>
              </div>
            </motion.div>

            {/* Stat cards — VERTICAL per audit, 1-col mobile / 3-col md */}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <StatCard label={t(language, "todayEarnings")} value={formatSom(data.today, language)} icon={Wallet} accent="success" />
              <StatCard label={t(language, "weekEarnings")} value={formatSom(data.week, language)} icon={TrendingUp} accent="primary" />
              <StatCard label={t(language, "monthEarnings")} value={formatSom(data.month, language)} icon={BarChart3} accent="warning" />
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <StatCard label={t(language, "totalTrips")} value={String(data.totalTrips)} icon={Truck} accent="primary" />
              <StatCard label={t(language, "avgRating")} value={data.avgRating.toFixed(1)} hint={`${data.totalTrips} reys · ★`} icon={Star} accent="warning" />
            </div>

            {/* Chart — per audit: if little data, show message not empty bars */}
            <section className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-border/60">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-foreground">{t(language, "weeklyChart")}</h3>
                <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                  {(["today", "week", "month"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[12px] font-semibold transition",
                        period === p ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      {p === "today" ? t(language, "today") : p === "week" ? t(language, "week") : t(language, "month")}
                    </button>
                  ))}
                </div>
              </div>

              {hasData ? (
                <div className="flex h-40 items-end justify-between gap-1.5">
                  {data.history.map((h, i) => {
                    const heightPct = maxBar > 0 ? (h.total / maxBar) * 100 : 0;
                    const isMax = h.total === maxBar && h.total > 0;
                    return (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                        <div className="flex w-full flex-1 items-end">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(heightPct, h.total > 0 ? 6 : 2)}%` }}
                            transition={{ delay: i * 0.05, duration: 0.4 }}
                            className={cn(
                              "w-full rounded-t-md",
                              h.total > 0
                                ? isMax ? "bg-primary" : "bg-primary/60"
                                : "bg-muted"
                            )}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-muted-foreground">{h.label}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title={t(language, "noDataYet")}
                  description={t(language, "noDataYetDesc")}
                  className="py-6"
                />
              )}
            </section>

            {/* Payouts history */}
            <section className="mt-5">
              <h3 className="mb-2.5 text-[15px] font-bold text-foreground">{t(language, "withdrawHistory")}</h3>
              {data.payouts.length === 0 ? (
                <div className="rounded-2xl bg-card p-4 text-center text-[14px] text-muted-foreground ring-1 ring-border/60">
                  Hozircha yechib olish so'rovlari yo'q
                </div>
              ) : (
                <div className="space-y-2">
                  {data.payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl bg-card p-3.5 ring-1 ring-border/60">
                      <div className="flex items-center gap-3">
                        <span className={cn("grid h-9 w-9 place-items-center rounded-full", p.status === "DONE" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                          <ArrowDownToLine className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="text-[14px] font-semibold text-foreground">{formatSom(p.amount, language)}</div>
                          <div className="text-[12px] text-muted-foreground">{formatDate(p.createdAt, language)}</div>
                        </div>
                      </div>
                      <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", p.status === "DONE" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                        {p.status === "DONE" ? "Yechib olindi" : "Kutilmoqda"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
