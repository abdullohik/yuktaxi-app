import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/fleet/orders — list all orders for fleet management
export async function GET() {
  try {
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const data = orders.map((o) => ({
      id: o.id,
      customerPhone: o.customerPhone,
      customerName: null,
      driverPhone: o.driverPhone,
      driverName: null,
      pickupAddress: o.pickupAddress,
      dropoffAddress: o.dropoffAddress,
      cargoType: o.cargoType,
      status: o.status,
      priceSom: o.priceSom,
      distanceKm: o.distanceKm,
      createdAt: o.createdAt.toISOString(),
      acceptedAt: o.acceptedAt?.toISOString() ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
