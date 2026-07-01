"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Role, Language, User } from "./types";

// ---- App screen routing (client-side, single `/` route) ----
export type Screen =
  | "splash"
  | "onboarding"
  | "auth"
  | "customer_home"
  | "booking"
  | "tracking"
  | "orders"
  | "chat"
  | "support_chat"
  | "driver_home"
  | "driver_trip"
  | "earnings"
  | "profile"
  | "settings"
  | "fleet_home"
  | "fleet_drivers"
  | "fleet_trucks"
  | "fleet_earnings"
  | "fleet_orders";

interface AppState {
  // --- bootstrap ---
  booted: boolean;
  setBooted: (b: boolean) => void;

  // --- language + theme ---
  language: Language;
  setLanguage: (l: Language) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  setTheme: (t: "light" | "dark") => void;

  // --- onboarding / auth ---
  onboarded: boolean;
  setOnboarded: (b: boolean) => void;
  role: Role;
  setRole: (r: Role) => void;

  user: User | null;
  setUser: (u: User | null) => void;
  accessToken: string | null;
  setAccessToken: (t: string | null) => void;
  isGuest: boolean;
  setGuest: (b: boolean) => void;

  // --- navigation ---
  screen: Screen;
  navigate: (s: Screen) => void;
  back: () => void;
  history: Screen[];

  // --- active context ---
  activeOrderId: string | null;
  setActiveOrderId: (id: string | null) => void;

  // --- customer booking draft ---
  bookingDraft: unknown;
  setBookingDraft: (d: unknown) => void;

  // --- driver online state ---
  driverOnline: boolean;
  setDriverOnline: (b: boolean) => void;

  // --- atomic multi-field updates ---
  loginAsGuest: () => void;
  loginAsUser: (u: User, token: string) => void;
  logout: () => void;

  // --- security ---
  validateAndFixState: () => void;
}

const VALID_ROLES = new Set<string>(["CUSTOMER", "DRIVER", "FLEET"]);

function defaultHome(role: Role): Screen {
  if (role === "DRIVER") return "driver_home";
  if (role === "FLEET") return "fleet_home";
  return "customer_home";
}

function isValidToken(token: string | null, userId: string | undefined): boolean {
  if (!token || !userId) return false;
  // Token format: yuktaxi.{userId}.{timestamp}.{random}
  return token.startsWith(`yuktaxi.${userId}.`);
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      booted: false,
      setBooted: (b) => set({ booted: b }),

      language: "uz",
      setLanguage: (l) => set({ language: l }),

      theme: "light",
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setTheme: (t) => set({ theme: t }),

      onboarded: false,
      setOnboarded: (b) => set({ onboarded: b }),
      role: "CUSTOMER",
      setRole: (r) => set({ role: r }),

      user: null,
      setUser: (u) => set({ user: u }),
      accessToken: null,
      setAccessToken: (t) => set({ accessToken: t }),
      isGuest: false,
      setGuest: (b) => set({ isGuest: b }),

      screen: "splash",
      navigate: (s) =>
        set((st) => ({
          screen: s,
          history: [...st.history, st.screen].slice(-20),
        })),
      back: () =>
        set((st) => {
          const h = [...st.history];
          const prev = h.pop() ?? defaultHome(st.role);
          return { screen: prev, history: h };
        }),
      history: [],

      activeOrderId: null,
      setActiveOrderId: (id) => set({ activeOrderId: id }),

      bookingDraft: null,
      setBookingDraft: (d) => set({ bookingDraft: d }),

      driverOnline: false,
      setDriverOnline: (b) => set({ driverOnline: b }),

      // Atomic: login as guest
      loginAsGuest: () =>
        set((st) => ({
          isGuest: true,
          onboarded: true,
          role: "CUSTOMER" as Role,
          user: null,
          accessToken: null,
          screen: "customer_home" as Screen,
          history: [...st.history, st.screen].slice(-20),
        })),

      // Atomic: login as authenticated user
      loginAsUser: (u, token) =>
        set((st) => ({
          user: u,
          accessToken: token,
          isGuest: false,
          onboarded: true,
          role: u.role,
          screen: defaultHome(u.role),
          history: [...st.history, st.screen].slice(-20),
        })),

      // Atomic: logout — clears everything
      logout: () =>
        set((st) => ({
          user: null,
          accessToken: null,
          isGuest: false,
          driverOnline: false,
          activeOrderId: null,
          bookingDraft: null,
          screen: "auth" as Screen,
          history: [],
        })),

      // Security: validate persisted state and fix inconsistencies
      // This prevents bypassing auth by manipulating localStorage
      validateAndFixState: () => {
        const st = get();

        // 1. If user exists, isGuest must be false
        if (st.user && st.isGuest) {
          set({ isGuest: false });
          return;
        }

        // 2. If user exists, accessToken must exist and be valid
        if (st.user && !isValidToken(st.accessToken, st.user.id)) {
          // Invalid or missing token — force logout
          set({
            user: null,
            accessToken: null,
            isGuest: false,
            screen: "auth" as Screen,
            history: [],
          });
          return;
        }

        // 3. If role is invalid, reset to CUSTOMER
        if (!VALID_ROLES.has(st.role)) {
          set({ role: "CUSTOMER" as Role });
          return;
        }

        // 4. If screen is set to an authenticated screen but no user/guest, redirect to auth
        const authScreens = new Set<string>([
          "customer_home", "booking", "tracking", "orders", "chat", "support_chat",
          "driver_home", "driver_trip", "earnings",
          "fleet_home", "fleet_drivers", "fleet_trucks", "fleet_earnings", "fleet_orders",
          "profile", "settings",
        ]);
        if (authScreens.has(st.screen) && !st.user && !st.isGuest) {
          set({ screen: "auth" as Screen });
          return;
        }

        // 5. If user.role doesn't match the store role, sync them
        if (st.user && st.user.role !== st.role) {
          set({ role: st.user.role });
        }
      },
    }),
    {
      name: "yuktaxi-app",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        language: s.language,
        theme: s.theme,
        onboarded: s.onboarded,
        role: s.role,
        user: s.user,
        accessToken: s.accessToken,
        isGuest: s.isGuest,
      }),
    }
  )
);

// helper to get the home screen for current role
export function homeScreen(role: Role): Screen {
  return defaultHome(role);
}
