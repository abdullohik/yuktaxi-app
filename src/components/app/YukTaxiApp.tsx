"use client";

import { useEffect } from "react";
import { useApp, type Screen, type Role } from "@/lib/store";
import { PhoneFrame } from "./PhoneFrame";
import { AppShell } from "./AppShell";
import { SplashScreen } from "./SplashScreen";
import { OnboardingScreen } from "./OnboardingScreen";
import { AuthScreen } from "./AuthScreen";
import { CustomerHome } from "./customer/CustomerHome";
import { BookingFlow } from "./customer/BookingFlow";
import { TrackingScreen } from "./customer/TrackingScreen";
import { OrdersScreen } from "./customer/OrdersScreen";
import { ChatScreen } from "./customer/ChatScreen";
import { SupportChatScreen } from "./customer/SupportChatScreen";
import { DriverHome } from "./driver/DriverHome";
import { EarningsScreen } from "./driver/EarningsScreen";
import { ProfileScreen } from "./profile/ProfileScreen";
import { FleetHome } from "./fleet/FleetHome";
import { FleetDrivers } from "./fleet/FleetDrivers";
import { FleetTrucks } from "./fleet/FleetTrucks";
import { FleetEarnings } from "./fleet/FleetEarnings";
import { FleetOrders } from "./fleet/FleetOrders";

/**
 * YukTaxiApp — the root app. Wraps everything in a phone frame (desktop) /
 * full screen (mobile), applies the persisted theme, and routes between
 * screens client-side (single `/` route).
 */
export function YukTaxiApp() {
  const { theme, screen, user, role, onboarded, isGuest, validateAndFixState, setBooted } = useApp();

  // SECURITY: validate persisted state on mount to prevent localStorage manipulation
  useEffect(() => {
    validateAndFixState();
    // Mark as booted after validation
    const t = setTimeout(() => setBooted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // apply theme class to <html> (manual mirror of the persisted store value)
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  // guard: force onboarding / auth when not ready
  let activeScreen = screen;
  if (screen === "splash") {
    activeScreen = "splash";
  } else if (!onboarded && !user && (screen === "auth" || isAppScreen(screen))) {
    activeScreen = "onboarding";
  } else if (onboarded && !user && isAppScreen(screen) && !isGuest) {
    activeScreen = "auth";
  }

  // security: enforce role-based screen access
  activeScreen = canAccessScreen(activeScreen, isGuest, role);

  // screens that hide the bottom nav (immersive)
  const hideNav: Screen[] = ["splash", "onboarding", "auth", "booking", "tracking", "driver_trip"];

  return (
    <PhoneFrame>
      <AppShell hideNav={hideNav.includes(activeScreen)}>
        <ScreenRouter screen={activeScreen} />
      </AppShell>
    </PhoneFrame>
  );
}

function isAppScreen(s: Screen): boolean {
  return !["splash", "onboarding", "auth"].includes(s);
}

/**
 * Enforce role-based screen access control.
 * - Guests can ONLY access customer-facing screens.
 * - Authenticated users MUST have the matching role for role-specific screens.
 * - Returns the corrected screen if access is denied.
 */
function canAccessScreen(screen: Screen, isGuest: boolean, role: Role): Screen {
  const PUBLIC_SCREENS: Screen[] = ["splash", "onboarding", "auth"];
  const GUEST_ALLOWED: Screen[] = ["customer_home", "booking", "tracking", "orders", "chat", "profile", "support_chat"];
  const DRIVER_ONLY: Screen[] = ["driver_home", "driver_trip", "earnings"];
  const FLEET_ONLY: Screen[] = ["fleet_home", "fleet_drivers", "fleet_trucks", "fleet_earnings", "fleet_orders"];

  // Public screens are always accessible
  if (PUBLIC_SCREENS.includes(screen)) return screen;

  // Guest users can only see customer screens
  if (isGuest) {
    return GUEST_ALLOWED.includes(screen) ? screen : "customer_home";
  }

  // Role-specific screen enforcement
  if (DRIVER_ONLY.includes(screen) && role !== "DRIVER") {
    return role === "FLEET" ? "fleet_home" : "customer_home";
  }
  if (FLEET_ONLY.includes(screen) && role !== "FLEET") {
    return role === "DRIVER" ? "driver_home" : "customer_home";
  }

  return screen;
}

function ScreenRouter({ screen }: { screen: Screen }) {
  switch (screen) {
    case "splash": return <SplashScreen />;
    case "onboarding": return <OnboardingScreen />;
    case "auth": return <AuthScreen />;
    case "customer_home": return <CustomerHome />;
    case "booking": return <BookingFlow />;
    case "tracking": return <TrackingScreen />;
    case "orders": return <OrdersScreen />;
    case "chat": return <ChatScreen />;
    case "support_chat": return <SupportChatScreen />;
    case "driver_home": return <DriverHome />;
    case "driver_trip": return <DriverHome />; // trip is shown inline in driver home
    case "earnings": return <EarningsScreen />;
    case "profile": return <ProfileScreen />;
    case "fleet_home": return <FleetHome />;
    case "fleet_drivers": return <FleetDrivers />;
    case "fleet_trucks": return <FleetTrucks />;
    case "fleet_earnings": return <FleetEarnings />;
    case "fleet_orders": return <FleetOrders />;
    default: return <SplashScreen />;
  }
}
