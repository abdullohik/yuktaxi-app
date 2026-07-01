import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/fleet/recent-orders — last 10 orders
export async function GET() {
  try {
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const data = orders.map((o) => ({
      id: o.id,
      customerPhone: o.customerPhone,
      pickupAddress: o.pickupAddress,
      dropoffAddress: o.dropoffAddress,
      status: o.status,
      priceSom: o.priceSom,
      driverPhone: o.driverPhone,
      createdAt: o.createdAt.toISOString(),
    }));

    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
