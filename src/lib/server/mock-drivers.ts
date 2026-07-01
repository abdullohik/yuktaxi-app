// Server-only mock driver generator. Produces 4-6 nearby drivers around a point.
import type { CargoType, NearbyDriver } from "@/lib/types";

export const UZBEK_NAMES = [
  "Akmal",
  "Bekzod",
  "Dilmurod",
  "Farrux",
  "Jasur",
  "Kobil",
  "Odil",
  "Rustam",
  "Sardor",
  "Sherzod",
  "Ulug'bek",
  "Zafar",
];

const CARGO_IDS: CargoType[] = [
  "pickup",
  "van",
  "truck_small",
  "truck_medium",
  "truck_large",
];

// Deterministic-ish pseudo-random generator seeded from lat+lng+salt
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePlate(rand: () => number): string {
  const a = String(Math.floor(rand() * 2) + 1).padStart(2, "0");
  const n = String(100 + Math.floor(rand() * 900));
  const letters = "ABCDE";
  const l1 = letters[Math.floor(rand() * letters.length)];
  const l2 = letters[Math.floor(rand() * letters.length)];
  return `${a}${l1}${n}${l2}`;
}

/**
 * Generate N mock drivers around the given lat/lng.
 * Count defaults to a random 4-6.
 */
export function generateNearbyDrivers(
  lat: number,
  lng: number,
  count?: number,
  seedSalt = 0
): NearbyDriver[] {
  const n = count ?? 4 + Math.floor(Math.random() * 3); // 4..6
  const seed = Math.floor(Math.abs(lat * 1e6 + lng * 1e3 + seedSalt * 7));
  const rand = mulberry32(seed);
  const drivers: NearbyDriver[] = [];
  for (let i = 0; i < n; i++) {
    const angle = rand() * 2 * Math.PI;
    const distDeg = 0.005 + rand() * 0.015; // 0.005..0.02
    const dLat = Math.cos(angle) * distDeg;
    const dLng = Math.sin(angle) * distDeg;
    const name = UZBEK_NAMES[Math.floor(rand() * UZBEK_NAMES.length)];
    drivers.push({
      id: `mock-${i + 1}-${Math.floor(rand() * 1e6)}`,
      name,
      lat: +(lat + dLat).toFixed(6),
      lng: +(lng + dLng).toFixed(6),
      rating: +(4.6 + rand() * 0.4).toFixed(1),
      vehicleType: CARGO_IDS[Math.floor(rand() * CARGO_IDS.length)],
      vehiclePlate: makePlate(rand),
      etaMin: 3 + Math.floor(rand() * 10), // 3..12
      online: true,
      trustScore: 70 + Math.floor(rand() * 26), // 70..95
    });
  }
  return drivers;
}

/**
 * Pick one deterministic mock driver to "assign" to an order.
 * Returns { name, phone, vehicleType, vehiclePlate, rating, trustScore }.
 * Phone range 998900000001..998900000012 based on name.
 */
export function pickAssignDriver(
  lat: number,
  lng: number,
  salt: number
): {
  name: string;
  phone: string;
  vehicleType: CargoType;
  vehiclePlate: string;
  rating: number;
  trustScore: number;
  lat: number;
  lng: number;
} {
  const drivers = generateNearbyDrivers(lat, lng, 1, salt);
  const d = drivers[0];
  const idx = UZBEK_NAMES.indexOf(d.name);
  const phone = `9989000000${String(idx + 1).padStart(2, "0")}`;
  return {
    name: d.name,
    phone,
    vehicleType: d.vehicleType,
    vehiclePlate: d.vehiclePlate,
    rating: d.rating,
    trustScore: d.trustScore,
    lat: d.lat,
    lng: d.lng,
  };
}
