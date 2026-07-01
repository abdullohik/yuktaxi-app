import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/fleet/earnings
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "week";

    const now = new Date();
    const periodStart = new Date();
    if (period === "week") {
      periodStart.setDate(now.getDate() - 7);
    } else {
      periodStart.setMonth(now.getMonth() - 1);
    }
    periodStart.setHours(0, 0, 0, 0);

    const prevPeriodStart = new Date(periodStart);
    if (period === "week") {
      prevPeriodStart.setDate(periodStart.getDate() - 7);
    } else {
      prevPeriodStart.setMonth(periodStart.getMonth() - 1);
    }

    const currentOrders = await db.order.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: periodStart },
      },
      select: { priceSom: true, createdAt: true, driverPhone: true },
    });

    const prevOrders = await db.order.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: prevPeriodStart, lt: periodStart },
      },
      select: { priceSom: true },
    });

    const currentRevenue = currentOrders.reduce((sum, o) => sum + o.priceSom, 0);
    const prevRevenue = prevOrders.reduce((sum, o) => sum + o.priceSom, 0);
    const change = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Today
    const todayOrders = await db.order.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      select: { priceSom: true },
    });
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.priceSom, 0);

    // Commission (20% of revenue)
    const commissionEarned = Math.round(currentRevenue * 0.2);

    return NextResponse.json({
      ok: true,
      data: {
        today: todayRevenue,
        week: period === "week" ? currentRevenue : 0,
        month: period === "month" ? currentRevenue : 0,
        lastWeek: prevRevenue,
        lastMonth: prevRevenue,
        weekChange: change,
        monthChange: change,
        totalPayouts: Math.round(currentRevenue * 0.8),
        pendingPayouts: 0,
        commissionEarned,
        dailyBreakdown: [],
        topDrivers: [],
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
