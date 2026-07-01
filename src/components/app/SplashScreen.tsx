"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { BrandLogo } from "./BrandLogo";
import { useApp } from "@/lib/store";

/**
 * SplashScreen — premium brand intro with animated gradient + glow.
 * 1.6s, then routes to onboarding or home.
 */
export function SplashScreen() {
  const { onboarded, user, isGuest, setBooted, navigate, setRole, validateAndFixState } = useApp();

  useEffect(() => {
    const t = setTimeout(() => {
      // Security: validate state before routing
      validateAndFixState();

      // Re-read state after validation
      const st = useApp.getState();

      setBooted(true);
      if (st.user) {
        navigate(st.user.role === "DRIVER" ? "driver_home" : st.user.role === "FLEET" ? "fleet_home" : "customer_home");
        setRole(st.user.role);
      } else if (st.isGuest && st.onboarded) {
        navigate("customer_home");
      } else if (st.onboarded) {
        navigate("auth");
      } else {
        navigate("onboarding");
      }
    }, 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-stone-950">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 40%, oklch(0.45 0.18 55) 0%, oklch(0.25 0.08 50) 50%, oklch(0.12 0.02 50) 100%)",
        }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Ambient glow orbs */}
      <motion.div
        className="pointer-events-none absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl"
        animate={{ x: [0, 30, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -right-20 bottom-1/4 h-64 w-64 rounded-full bg-orange-600/20 blur-3xl"
        animate={{ x: [0, -30, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      {/* Route lines decoration */}
      <div className="pointer-events-none absolute inset-0 opacity-10">
        <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 800">
          <path d="M-20 200 Q 200 250 420 180" stroke="white" strokeWidth="2" fill="none" strokeDasharray="6 10" />
          <path d="M-20 520 Q 200 580 420 500" stroke="white" strokeWidth="2" fill="none" strokeDasharray="6 10" />
          <path d="M-20 680 Q 200 640 420 700" stroke="white" strokeWidth="2" fill="none" strokeDasharray="6 10" />
        </svg>
      </div>

      {/* Logo + brand */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        <motion.div
          className="relative rounded-[2rem] bg-gradient-to-br from-white to-amber-50 p-7 shadow-2xl shadow-amber-900/50"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        >
          <div className="absolute inset-0 rounded-[2rem] bg-amber-400/20 blur-xl" />
          <div className="relative">
            <BrandLogo size={88} showText={false} />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-7 text-5xl font-black tracking-tight text-white"
        >
          Yuk<span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">Taxi</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-3 text-[15px] font-medium text-amber-100/80"
        >
          Yukingizni ishonchli qo&apos;llarga topshiring
        </motion.p>
      </motion.div>

      {/* Loading indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.4 }}
        className="absolute bottom-16 flex flex-col items-center gap-3"
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-amber-400"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
        <span className="text-[12px] font-medium text-amber-100/50">Yuklanmoqda...</span>
      </motion.div>
    </div>
  );
}
