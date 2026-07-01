// API fetch helpers + cargo config + status meta
import type { CargoType, OrderStatus, PriceEstimate } from "./types";

export async function api<T = unknown>(
  path: string,
  opts?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const msg =
      (json && typeof json === "object" && "error" in json
        ? String((json as Record<string, unknown>).error)
        : null) ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

// ---- Cargo config ----
export const CARGO_TYPES: {
  id: CargoType;
  // weight capacity kg, base multiplier for pricing, icon emoji
  cap: number;
  mult: number;
  emoji: string;
}[] = [
  { id: "pickup", cap: 800, mult: 0.8, emoji: "🛻" },
  { id: "van", cap: 1500, mult: 1.0, emoji: "🚐" },
  { id: "truck_small", cap: 3000, mult: 1.3, emoji: "🚚" },
  { id: "truck_medium", cap: 6000, mult: 1.7, emoji: "🚛" },
  { id: "truck_large", cap: 12000, mult: 2.4, emoji: "🚛" },
];

export function cargoInfo(id: CargoType) {
  return CARGO_TYPES.find((c) => c.id === id) ?? CARGO_TYPES[0];
}

// ---- Pricing (mirrors backend; used for live estimate) ----
export function estimatePriceLocal(
  distanceKm: number,
  cargoType: CargoType,
  weightKg: number
): PriceEstimate {
  const info = cargoInfo(cargoType);
  const base = 15000;
  const distance = Math.round(distanceKm * 2500);
  const cargo = Math.round(base * (info.mult - 1));
  const weight = weightKg > 0 ? Math.round(weightKg * 15) : 0;
  const priceSom = base + distance + cargo + weight;
  const etaMin = Math.max(8, Math.round(distanceKm * 2.2 + 12));
  return {
    priceSom,
    etaMin,
    breakdown: { base, distance, cargo, weight },
  };
}

// ---- Order status meta (color + text key + icon) ----
// Per audit: status must always be color + text + icon together
export const STATUS_META: Record<
  OrderStatus,
  { color: string; bg: string; dot: string; key: string }
> = {
  SEARCHING: {
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-950/50",
    dot: "bg-amber-500",
    key: "searchingDriver",
  },
  ACCEPTED: {
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-100 dark:bg-blue-950/50",
    dot: "bg-blue-500",
    key: "driverFound",
  },
  ARRIVING: {
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-950/50",
    dot: "bg-amber-500",
    key: "driverArriving",
  },
  ARRIVED: {
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-100 dark:bg-purple-950/50",
    dot: "bg-purple-500",
    key: "driverArrived",
  },
  LOADED: {
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-100 dark:bg-orange-950/50",
    dot: "bg-orange-500",
    key: "cargoLoaded",
  },
  IN_TRANSIT: {
    color: "text-primary",
    bg: "bg-primary/10",
    dot: "bg-primary",
    key: "inTransit",
  },
  DELIVERED: {
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-950/50",
    dot: "bg-emerald-500",
    key: "delivered",
  },
  COMPLETED: {
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-950/50",
    dot: "bg-emerald-500",
    key: "orderCompleted",
  },
  CANCELLED: {
    color: "text-destructive",
    bg: "bg-destructive/10",
    dot: "bg-destructive",
    key: "cancelOrder",
  },
};

// Driver progression buttons (which action advances which status)
export const DRIVER_NEXT_ACTION: Partial<Record<OrderStatus, OrderStatus>> = {
  ACCEPTED: "ARRIVING",
  ARRIVING: "ARRIVED",
  ARRIVED: "LOADED",
  LOADED: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};

// Tashkent center
export const TASHKENT_CENTER: [number, number] = [41.31218, 69.25138];
