"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Package, Truck, Building2, Check, Globe, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Language, Role } from "@/lib/types";

const LANGS: { id: Language; label: string; sub: string; flag: string }[] = [
  { id: "uz", label: "O'zbekcha", sub: "Uzbek", flag: "🇺🇿" },
  { id: "ru", label: "Русский", sub: "Russian", flag: "🇷🇺" },
  { id: "en", label: "English", sub: "English", flag: "🇬🇧" },
];

const ROLES: { id: Role; icon: typeof Package; titleKey: "roleCustomer" | "roleDriver" | "roleFleet"; descKey: "roleCustomerDesc" | "roleDriverDesc" | "roleFleetDesc"; accent: string; glow: string }[] = [
  { id: "CUSTOMER", icon: Package, titleKey: "roleCustomer", descKey: "roleCustomerDesc", accent: "from-amber-500 to-orange-600", glow: "bg-amber-500/20" },
  { id: "DRIVER", icon: Truck, titleKey: "roleDriver", descKey: "roleDriverDesc", accent: "from-emerald-500 to-teal-600", glow: "bg-emerald-500/20" },
  { id: "FLEET", icon: Building2, titleKey: "roleFleet", descKey: "roleFleetDesc", accent: "from-violet-500 to-purple-600", glow: "bg-violet-500/20" },
];

export function OnboardingScreen() {
  const { language, setLanguage, role, setRole, setOnboarded, navigate, loginAsGuest } = useApp();
  const [step, setStep] = useState<1 | 2>(1);

  function finish(r: Role) {
    setRole(r);
    setOnboarded(true);
    navigate("auth");
  }

  function guest() {
    loginAsGuest();
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Premium gradient header bar */}
      <div className="relative h-32 shrink-0 overflow-hidden bg-gradient-to-br from-primary via-amber-700 to-amber-900">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />

        {/* Progress dots */}
        <div className="safe-top relative flex items-center justify-center gap-2 pt-6">
          <motion.span
            className="h-1.5 rounded-full"
            animate={{ width: step === 1 ? 32 : 16, backgroundColor: step === 1 ? "#ffffff" : "rgba(255,255,255,0.4)" }}
          />
          <motion.span
            className="h-1.5 rounded-full"
            animate={{ width: step === 2 ? 32 : 16, backgroundColor: step === 2 ? "#ffffff" : "rgba(255,255,255,0.4)" }}
          />
        </div>

        {/* Step label */}
        <div className="absolute bottom-3 left-6">
          <span className="text-[12px] font-medium uppercase tracking-wider text-white/60">
            {step === 1 ? "Step 1 / 2" : "Step 2 / 2"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto yt-scroll">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="lang"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-1 flex-col px-6 py-6"
            >
              <div className="mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Globe className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-black leading-tight text-foreground">
                {t(language, "chooseLanguage")}
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                Tilni tanlang — keyin davom eting
              </p>

              <div className="mt-7 space-y-3">
                {LANGS.map((l) => {
                  const active = language === l.id;
                  return (
                    <motion.button
                      key={l.id}
                      onClick={() => setLanguage(l.id)}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border-2 p-4 text-left transition",
                        active
                          ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                          : "border-border bg-card hover:border-primary/30 hover:shadow-md"
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="lang-glow"
                          className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/5 to-transparent"
                        />
                      )}
                      <span className="text-3xl">{l.flag}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-bold text-foreground">{l.label}</div>
                        <div className="text-[13px] text-muted-foreground">{l.sub}</div>
                      </div>
                      <motion.div
                        animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Check className="h-4 w-4" />
                      </motion.div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-auto pt-8">
                <button
                  onClick={() => setStep(2)}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98]"
                >
                  {t(language, "continue")}
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  onClick={guest}
                  className="mt-3 h-12 w-full text-[15px] font-medium text-muted-foreground"
                >
                  {t(language, "enterAsGuest")}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="role"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-1 flex-col px-6 py-6"
            >
              <div className="mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Package className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-black leading-tight text-foreground">
                {t(language, "chooseRole")}
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {t(language, "welcome")} — {t(language, "appName")}
              </p>

              <div className="mt-7 space-y-3">
                {ROLES.map((r) => {
                  const active = role === r.id;
                  const Icon = r.icon;
                  return (
                    <motion.button
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border-2 p-4 text-left transition",
                        active
                          ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                          : "border-border bg-card hover:border-primary/30 hover:shadow-md"
                      )}
                    >
                      {active && (
                        <div className={cn("absolute -left-8 -top-8 h-24 w-24 rounded-full blur-2xl", r.glow)} />
                      )}
                      <div className={cn("relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md", r.accent)}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-bold text-foreground">{t(language, r.titleKey)}</div>
                        <div className="text-[13px] leading-snug text-muted-foreground">{t(language, r.descKey)}</div>
                      </div>
                      <motion.div
                        animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Check className="h-4 w-4" />
                      </motion.div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-auto pt-8">
                <button
                  onClick={() => finish(role)}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98]"
                >
                  {t(language, "continue")}
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="mt-3 h-12 w-full text-[15px] font-medium text-muted-foreground"
                >
                  {t(language, "back")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
