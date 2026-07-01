// Shared helpers for orders routes.
import { db } from "@/lib/db";
import { pickAssignDriver } from "@/lib/server/mock-drivers";
import type { Order } from "@/lib/types";

export async function assignMockDriver(
  pickupLat: number,
  pickupLng: number,
  salt: number
): Promise<string> {
  // Returns the driverPhone (== user.phone) of the assigned mock driver.
  const picked = pickAssignDriver(pickupLat, pickupLng, salt);
  const user = await db.user.upsert({
    where: { phone: picked.phone },
    update: { name: picked.name, role: "DRIVER" },
    create: {
      phone: picked.phone,
      name: picked.name,
      role: "DRIVER",
      language: "uz",
    },
  });
  // Ensure a Driver row exists
  const existing = await db.driver.findUnique({ where: { userId: user.id } });
  if (!existing) {
    await db.driver.create({
      data: {
        userId: user.id,
        isOnline: true,
        rating: picked.rating,
        totalTrips: 0,
        trustScore: picked.trustScore,
        vehicleType: picked.vehicleType,
        vehiclePlate: picked.vehiclePlate,
        city: "Toshkent",
        balance: 0,
      },
    });
  } else {
    await db.driver.update({
      where: { userId: user.id },
      data: {
        rating: picked.rating,
        trustScore: picked.trustScore,
        vehicleType: picked.vehicleType,
        vehiclePlate: picked.vehiclePlate,
      },
    });
  }
  return user.phone;
}

export function shapeOrder(o: {
  id: string;
  customerPhone: string;
  customer: { name: string | null } | null;
  driverPhone: string | null;
  driver: { name: string | null } | null;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  pickupApt?: string | null;
  pickupEntrance?: string | null;
  pickupFloor?: string | null;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  dropoffApt?: string | null;
  dropoffEntrance?: string | null;
  dropoffFloor?: string | null;
  cargoType: string;
  weightKg: number;
  note: string | null;
  priceSom: number;
  distanceKm: number;
  durationMin: number;
  cargoTitle?: string | null;
  cargoDescription?: string | null;
  cargoCategory?: string | null;
  cargoLengthCm?: number | null;
  cargoWidthCm?: number | null;
  cargoHeightCm?: number | null;
  cargoValueSom?: number | null;
  isFragile?: boolean;
  needsLoadingHelp?: boolean;
  status: string;
  cancelReason: string | null;
  createdAt: Date;
  acceptedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
}): Order {
  return {
    id: o.id,
    customerPhone: o.customerPhone,
    customerName: o.customer?.name ?? null,
    driverPhone: o.driverPhone,
    driverName: o.driver?.name ?? null,
    pickupLat: o.pickupLat,
    pickupLng: o.pickupLng,
    pickupAddress: o.pickupAddress,
    pickupApt: o.pickupApt ?? null,
    pickupEntrance: o.pickupEntrance ?? null,
    pickupFloor: o.pickupFloor ?? null,
    dropoffLat: o.dropoffLat,
    dropoffLng: o.dropoffLng,
    dropoffAddress: o.dropoffAddress,
    dropoffApt: o.dropoffApt ?? null,
    dropoffEntrance: o.dropoffEntrance ?? null,
    dropoffFloor: o.dropoffFloor ?? null,
    cargoType: o.cargoType as Order["cargoType"],
    weightKg: o.weightKg,
    note: o.note,
    priceSom: o.priceSom,
    distanceKm: o.distanceKm,
    durationMin: o.durationMin,
    cargoTitle: o.cargoTitle ?? null,
    cargoDescription: o.cargoDescription ?? null,
    cargoCategory: o.cargoCategory ?? null,
    cargoLengthCm: o.cargoLengthCm ?? null,
    cargoWidthCm: o.cargoWidthCm ?? null,
    cargoHeightCm: o.cargoHeightCm ?? null,
    cargoValueSom: o.cargoValueSom ?? null,
    isFragile: o.isFragile ?? false,
    needsLoadingHelp: o.needsLoadingHelp ?? false,
    status: o.status as Order["status"],
    cancelReason: o.cancelReason,
    createdAt: o.createdAt.toISOString(),
    acceptedAt: o.acceptedAt?.toISOString() ?? null,
    pickedUpAt: o.pickedUpAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
  };
}

export const ORDER_INCLUDE = {
  customer: { select: { name: true } },
  driver: { select: { name: true } },
} as const;
