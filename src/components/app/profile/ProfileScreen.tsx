"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Package, Truck, Building2, Check, ChevronRight, Star, Calendar, Shield, LogOut, Pencil, Phone } from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { formatPhone, formatDate } from "@/lib/format";
import { ScreenHeader } from "../ScreenHeader";
import { StatCard } from "../StatCard";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PaymentSection } from "../customer/PaymentSection";
import type { Role, User, Order } from "@/lib/types";
import { toast } from "sonner";

const ROLE_OPTS: { id: Role; icon: typeof Package; titleKey: "roleCustomer" | "roleDriver" | "roleFleet" }[] = [
  { id: "CUSTOMER", icon: Package, titleKey: "roleCustomer" },
  { id: "DRIVER", icon: Truck, titleKey: "roleDriver" },
  { id: "FLEET", icon: Building2, titleKey: "roleFleet" },
];

export function ProfileScreen() {
  const { language, user, role, setRole, setTheme, theme, setLanguage, isGuest, navigate, logout, setUser, loginAsUser, accessToken } = useApp();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name ?? "");
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [stats, setStats] = useState<{ trips: number; rating: number; memberSince: string | null }>({ trips: 0, rating: 5, memberSince: null });

  useEffect(() => {
    if (!user || isGuest) return;
    const memberSince = user.createdAt ?? null;
    if (role === "DRIVER") {
      // Drivers: pull trips + rating from /api/earnings
      api<{ ok: boolean; data: { totalTrips: number; avgRating: number } }>(`/api/earnings?driverPhone=${user.phone}`)
        .then((r) => setStats({ trips: r.data.totalTrips, rating: r.data.avgRating, memberSince }))
        .catch(() => setStats((s) => ({ ...s, memberSince })));
    } else {
      // Customers: pull trips from /api/orders, rating is always 5 (no driver rating for customers)
      api<{ ok: boolean; data: Order[] }>(`/api/orders?phone=${user.phone}&role=CUSTOMER`)
        .then((r) => {
          const orders = r.data ?? [];
          const completed = orders.filter((o) => o.status === "COMPLETED" || o.status === "DELIVERED").length;
          setStats({ trips: orders.length, rating: 5, memberSince });
        })
        .catch(() => setStats((s) => ({ ...s, memberSince })));
    }
  }, [user, isGuest, role]);

  async function changeRole(r: Role) {
    setSheetOpen(false);
    if (user && accessToken) {
      try {
        const res = await api<{ ok: boolean; data: { user: User } }>(`/api/auth/me?phone=${user.phone}`, {
          method: "PATCH",
          body: JSON.stringify({ role: r }),
        });
        // Atomic update: set user + role + navigate in one call
        loginAsUser(res.data.user, accessToken);
        toast.success(t(language, "roleChanged"));
      } catch {
        toast.error(t(language, "roleChangeFailed"));
      }
    } else {
      // Fallback: guests cannot switch roles, navigate to auth
      navigate(r === "DRIVER" ? "driver_home" : r === "FLEET" ? "fleet_home" : "customer_home");
    }
  }

  async function saveName() {
    if (!user) return;
    try {
      const res = await api<{ ok: boolean; data: { user: User } }>(`/api/auth/me?phone=${user.phone}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nameDraft.trim() || null }),
      });
      setUser(res.data.user);
      setEditingName(false);
      toast.success(t(language, "saved"));
    } catch {
      toast.error(t(language, "saveFailed"));
    }
  }

  function startEditPhone() {
    if (!user) return;
    // Strip +998 prefix for editing, show raw 9 digits
    const raw = user.phone.replace(/^\+?998/, "");
    setPhoneDraft(raw);
    setEditingPhone(true);
  }

  async function savePhone() {
    if (!user || !accessToken) return;
    const digits = phoneDraft.replace(/\D/g, "");
    if (digits.length < 9) {
      toast.error(t(language, "phoneRequired"));
      return;
    }
    const fullPhone = `+998${digits.slice(-9)}`;
    if (fullPhone === user.phone) {
      setEditingPhone(false);
      return;
    }
    setSavingPhone(true);
    try {
      const res = await api<{ ok: boolean; data: { user: User; accessToken: string } }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ phone: fullPhone }),
      });
      loginAsUser(res.data.user, accessToken);
      setEditingPhone(false);
      toast.success(t(language, "saved"));
    } catch {
      toast.error(t(language, "saveFailed"));
    } finally {
      setSavingPhone(false);
    }
  }

  // logout is from store (atomic)

  if (isGuest || !user) {
    return (
      <div className="flex h-full flex-col bg-background">
        <ScreenHeader title={t(language, "myProfile")} />
        <div className="flex-1 overflow-y-auto yt-scroll">
          <div className="px-4 py-6">
            <div className="flex flex-col items-center rounded-3xl bg-gradient-to-br from-primary/10 to-amber-500/10 p-6 text-center ring-1 ring-primary/15">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-card text-3xl shadow-sm">👤</div>
              <h2 className="mt-3 text-lg font-bold text-foreground">{t(language, "guest")}</h2>
              <p className="mt-1 text-[14px] text-muted-foreground">{t(language, "guestProfileHint")}</p>
              <button onClick={() => navigate("auth")} className="mt-4 h-12 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground">
                {t(language, "enterPhone")}
              </button>
            </div>
          </div>
          <SettingsList language={language} theme={theme} setTheme={setTheme} setLanguage={setLanguage} onSupport={() => navigate("support_chat")} />
        </div>
      </div>
    );
  }

  const activeRole = ROLE_OPTS.find((r) => r.id === role)!;

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        title={t(language, "myProfile")}
        right={
          <button onClick={() => { setNameDraft(user.name ?? ""); setEditingName(true); }} className="grid h-10 w-10 place-items-center rounded-full bg-card ring-1 ring-border/70 active:scale-95">
            <Pencil className="h-4.5 w-4.5" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto yt-scroll px-4 pb-6 pt-4">
        {/* Profile hero card — per audit: big avatar + name + phone, centered */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-amber-700 p-5 text-primary-foreground shadow-xl shadow-primary/30"
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
          <div className="relative flex flex-col items-center text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-white/20 text-4xl ring-4 ring-white/20">
              {user.name?.[0]?.toUpperCase() ?? "👤"}
            </div>
            {editingName ? (
              <div className="mt-3 flex w-full items-center gap-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  autoFocus
                  className="h-11 flex-1 rounded-lg bg-white/20 px-3 text-center text-[16px] font-bold text-primary-foreground outline-none placeholder:text-primary-foreground/60"
                  placeholder={t(language, "profileNamePlaceholder")}
                />
                <button onClick={saveName} className="grid h-11 w-11 place-items-center rounded-lg bg-white text-primary active:scale-95">
                  <Check className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <h2 className="mt-3 text-xl font-extrabold">{user.name ?? "Foydalanuvchi"}</h2>
            )}
            {editingPhone ? (
              <div className="mt-2 flex w-full items-center gap-2">
                <div className="flex h-11 flex-1 items-center gap-1 rounded-lg bg-white/20 px-3 text-[15px] text-primary-foreground">
                  <span className="text-primary-foreground/60">+998</span>
                  <input
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    onKeyDown={(e) => e.key === "Enter" && savePhone()}
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-center font-semibold outline-none placeholder:text-primary-foreground/40"
                    placeholder="XX XXX XX XX"
                  />
                </div>
                <button onClick={savePhone} disabled={savingPhone} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-primary active:scale-95 disabled:opacity-50">
                  {savingPhone ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Check className="h-5 w-5" />}
                </button>
                <button onClick={() => setEditingPhone(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/20 text-primary-foreground active:scale-95">
                  <span className="text-[16px]">✕</span>
                </button>
              </div>
            ) : (
              <button onClick={startEditPhone} className="mt-1 flex items-center gap-1.5 text-[14px] text-primary-foreground/80 transition hover:text-primary-foreground">
                <Phone className="h-3.5 w-3.5" />
                {formatPhone(user.phone)}
                <Pencil className="ml-1 h-3 w-3 opacity-60" />
              </button>
            )}

            {/* Current role badge */}
            <button
              onClick={() => setSheetOpen(true)}
              className="mt-4 flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-[13px] font-semibold backdrop-blur active:scale-95"
            >
              <activeRole.icon className="h-4 w-4" />
              {t(language, activeRole.titleKey)}
              <span className="ml-1 text-[11px] text-primary-foreground/70">· {t(language, "switchRole")}</span>
            </button>
          </div>
        </motion.div>

        {/* Stats row — per audit: stats present, no empty space */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <StatCard label={t(language, "totalOrders")} value={String(stats.trips)} icon={Package} accent="primary" />
          <StatCard label={t(language, "rating")} value={stats.rating.toFixed(1)} hint="★" icon={Star} accent="warning" />
          <StatCard label={t(language, "trustScore")} value="80" hint="trust" icon={Shield} accent="success" />
        </div>

        {/* Member since */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-border/60">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
            <Calendar className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <div className="text-[13px] text-muted-foreground">{t(language, "memberSince")}</div>
            <div className="text-[15px] font-semibold text-foreground">
              {stats.memberSince ? formatDate(stats.memberSince, language) : "—"}
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="mt-3">
          <PaymentSection />
        </div>

        {/* Settings list */}
        <SettingsList language={language} theme={theme} setTheme={setTheme} setLanguage={setLanguage} onLogout={() => { logout(); toast.info(t(language, "loggedOut")); }} onSupport={() => navigate("support_chat")} />
      </div>

      {/* Role switcher Sheet — per audit: bottom drawer, NOT dropdown */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0">
          <SheetHeader className="px-5 pt-5 pb-2">
            <SheetTitle className="text-lg font-bold">{t(language, "switchRole")}</SheetTitle>
            <SheetDescription className="text-[14px]">
              {t(language, "currentRole")}: {t(language, activeRole.titleKey)}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-2 p-5 pb-8">
            {ROLE_OPTS.map((r) => {
              const active = r.id === role;
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => changeRole(r.id)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition active:scale-[0.99]",
                    active ? "border-primary bg-primary/5" : "border-border bg-card"
                  )}
                >
                  <div className={cn(
                    "grid h-12 w-12 place-items-center rounded-xl",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[16px] font-bold text-foreground">{t(language, r.titleKey)}</div>
                    <div className="text-[13px] text-muted-foreground">
                      {r.id === "CUSTOMER" ? t(language, "roleCustomerDesc") : r.id === "DRIVER" ? t(language, "roleDriverDesc") : t(language, "roleFleetDesc")}
                    </div>
                  </div>
                  {active && (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SettingsList({
  language,
  theme,
  setTheme,
  setLanguage,
  onLogout,
  onSupport,
}: {
  language: "uz" | "ru" | "en";
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  setLanguage: (l: "uz" | "ru" | "en") => void;
  onLogout?: () => void;
  onSupport?: () => void;
}) {
  const { t: tt } = { t };
  return (
    <div className="mt-5">
      <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{tt(language, "settings")}</h3>
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
        {/* Language */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary text-lg">🌐</span>
          <span className="flex-1 text-[15px] font-medium text-foreground">{tt(language, "languageSetting")}</span>
          <div className="flex gap-1 rounded-lg bg-muted p-0.5">
            {(["uz", "ru", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={cn("rounded-md px-2.5 py-1 text-[12px] font-semibold uppercase transition", language === l ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-border/50" />
        {/* Theme */}
        <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="flex w-full items-center gap-3 px-4 py-3.5 active:bg-muted/50">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary text-lg">{theme === "light" ? "☀️" : "🌙"}</span>
          <span className="flex-1 text-left text-[15px] font-medium text-foreground">{tt(language, "themeSetting")}</span>
          <span className="text-[14px] text-muted-foreground">{theme === "light" ? tt(language, "themeLight") : tt(language, "themeDark")}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="border-t border-border/50" />
        {/* Notifications */}
        <button className="flex w-full items-center gap-3 px-4 py-3.5 active:bg-muted/50">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary text-lg">🔔</span>
          <span className="flex-1 text-left text-[15px] font-medium text-foreground">{tt(language, "notifications")}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="border-t border-border/50" />
        {/* Help — opens support chat */}
        <button
          onClick={() => onSupport?.()}
          className="flex w-full items-center gap-3 px-4 py-3.5 active:bg-muted/50"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary text-lg">🎧</span>
          <span className="flex-1 text-left text-[15px] font-medium text-foreground">{tt(language, "helpSupport")}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="border-t border-border/50" />
        {/* Terms — opens /terms page */}
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-3 px-4 py-3.5 active:bg-muted/50">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary text-lg">📄</span>
          <span className="flex-1 text-left text-[15px] font-medium text-foreground">{tt(language, "termsConditions")}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </a>
        <div className="border-t border-border/50" />
        {/* Privacy — opens /privacy page */}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-3 px-4 py-3.5 active:bg-muted/50">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary text-lg">🔒</span>
          <span className="flex-1 text-left text-[15px] font-medium text-foreground">{tt(language, "privacyPolicy")}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </a>
        {onLogout && (
          <>
            <div className="border-t border-border/50" />
            <button onClick={onLogout} className="flex w-full items-center gap-3 px-4 py-3.5 active:bg-destructive/5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <LogOut className="h-5 w-5" />
              </span>
              <span className="flex-1 text-left text-[15px] font-semibold text-destructive">{tt(language, "logout")}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
