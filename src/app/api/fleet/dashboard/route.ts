import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/fleet/dashboard — fleet overview stats
export async function GET(req: NextRequest) {
  try {
    const totalDrivers = await db.driver.count();
    const onlineDrivers = await db.driver.count({ where: { isOnline: true } });
    const activeOrders = await db.order.count({
      where: { status: { in: ["SEARCHING", "ACCEPTED", "ARRIVING", "ARRIVED", "LOADED", "IN_TRANSIT"] } },
    });
    const completedToday = await db.order.count({
      where: {
        status: "COMPLETED",
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });

    const todayOrders = await db.order.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      select: { priceSom: true },
    });
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.priceSom, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekOrders = await db.order.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: weekStart },
      },
      select: { priceSom: true },
    });
    const weekRevenue = weekOrders.reduce((sum, o) => sum + o.priceSom, 0);

    const avgDriver = await db.driver.aggregate({
      _avg: { rating: true },
    });

    return NextResponse.json({
      ok: true,
      data: {
        totalDrivers,
        onlineDrivers,
        totalTrucks: totalDrivers,
        activeOrders,
        completedToday,
        todayRevenue,
        weekRevenue,
        avgRating: avgDriver._avg.rating ?? 0,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
