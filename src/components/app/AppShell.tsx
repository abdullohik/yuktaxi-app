"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useApp, homeScreen, type Screen } from "@/lib/store";
import { useMounted } from "@/hooks/use-mounted";
import { Home, Package, MessageSquare, Wallet, User, Truck, Users, BarChart3, ClipboardList } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Role, Language } from "@/lib/types";
import type { DictKey } from "@/lib/i18n";

interface AppShellProps {
  children: React.ReactNode;
  /** hide the bottom nav (e.g. on auth / tracking screens) */
  hideNav?: boolean;
}

/**
 * AppShell — the persistent app chrome: a compact top status strip is NOT here
 * (each screen renders its own header for context). This renders the bottom
 * tab navigation + the screen content above it.
 */
export function AppShell({ children, hideNav }: AppShellProps) {
  const mounted = useMounted();
  if (!mounted) return <div className="h-full bg-background" />;

  if (hideNav) {
    return <div className="flex h-full flex-col bg-background">{children}</div>;
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="relative flex-1 overflow-hidden">{children}</div>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const { role, screen, navigate, language } = useApp();
  const items = navForRole(role, language);

  return (
    <nav className="safe-bottom relative shrink-0 border-t border-border/40 bg-card/80 backdrop-blur-xl">
      {/* Top gradient line for active tab */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1 py-1.5">
        {items.map((it) => {
          const active = screen === it.screen;
          const Icon = it.icon;
          return (
            <button
              key={it.screen}
              onClick={() => navigate(it.screen)}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition active:scale-90",
                active ? "text-primary" : "text-muted-foreground/70"
              )}
              aria-label={it.label}
            >
              {active && (
                <motion.div
                  layoutId="nav-active-bg"
                  className="absolute inset-0 -z-10 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-xl transition",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.6 : 1.8} />
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none transition",
                  active ? "font-bold" : "font-medium"
                )}
              >
                {it.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function navForRole(role: Role, language: Language) {
  if (role === "DRIVER") {
    return [
      { screen: "driver_home" as Screen, label: t(language, "home" as DictKey), icon: Home },
      { screen: "orders" as Screen, label: t(language, "orders" as DictKey), icon: Package },
      { screen: "earnings" as Screen, label: t(language, "earnings" as DictKey), icon: Wallet },
      { screen: "profile" as Screen, label: t(language, "profile" as DictKey), icon: User },
    ];
  }
  if (role === "FLEET") {
    return [
      { screen: "fleet_home" as Screen, label: t(language, "home" as DictKey), icon: Home },
      { screen: "fleet_orders" as Screen, label: t(language, "orders" as DictKey), icon: ClipboardList },
      { screen: "fleet_drivers" as Screen, label: t(language, "fleetDrivers" as DictKey), icon: Users },
      { screen: "fleet_earnings" as Screen, label: t(language, "earnings" as DictKey), icon: BarChart3 },
      { screen: "profile" as Screen, label: t(language, "profile" as DictKey), icon: User },
    ];
  }
  // CUSTOMER
  return [
    { screen: homeScreen(role), label: t(language, "home" as DictKey), icon: Home },
    { screen: "orders" as Screen, label: t(language, "orders" as DictKey), icon: Package },
    { screen: "chat" as Screen, label: t(language, "chat" as DictKey), icon: MessageSquare },
    { screen: "profile" as Screen, label: t(language, "profile" as DictKey), icon: User },
  ];
}
