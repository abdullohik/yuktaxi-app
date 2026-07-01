import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { EarningsSummary } from "@/lib/types";

// Uzbek day-of-week abbreviations indexed by JS getDay() (0=Sun..6=Sat)
const DAY_LABELS = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const driverPhone = req.nextUrl.searchParams.get("driverPhone") ?? "";
    if (!driverPhone) {
      return NextResponse.json(
        { ok: false, error: "driverPhone parametri kerak" },
        { status: 400 }
      );
    }
    const user = await db.user.findUnique({
      where: { phone: driverPhone },
      include: { driver: true },
    });
    if (!user || !user.driver) {
      return NextResponse.json(
        { ok: false, error: "Haydovchi topilmadi" },
        { status: 404 }
      );
    }
    const driver = user.driver;

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const weekStartIso = new Date(
      now.getTime() - 7 * 86400000
    ).toISOString();
    const monthStartIso = new Date(
      now.getTime() - 30 * 86400000
    ).toISOString();
    const todayStartIso = todayStart.toISOString();

    const events = await db.earningsEvent.findMany({
      where: {
        driverId: driver.id,
        createdAt: { gte: new Date(weekStartIso) },
      },
      orderBy: { createdAt: "asc" },
    });

    const today = events
      .filter((e) => e.createdAt.toISOString() >= todayStartIso)
      .reduce((s, e) => s + e.amount, 0);
    const week = events.reduce((s, e) => s + e.amount, 0);

    const monthEvents = await db.earningsEvent.findMany({
      where: {
        driverId: driver.id,
        createdAt: { gte: new Date(monthStartIso) },
      },
    });
    const month = monthEvents.reduce((s, e) => s + e.amount, 0);

    // 7-day history (oldest → newest), day-of-week Uzbek labels
    const buckets: Map<string, { total: number; count: number }> = new Map();
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 86400000);
      days.push(d);
      buckets.set(dateKey(d), { total: 0, count: 0 });
    }
    for (const e of events) {
      const key = dateKey(e.createdAt);
      const b = buckets.get(key);
      if (b) {
        b.total += e.amount;
        b.count += 1;
      }
    }
    const history = days.map((d) => ({
      date: dateKey(d),
      label: DAY_LABELS[d.getUTCDay()],
      total: buckets.get(dateKey(d))!.total,
      count: buckets.get(dateKey(d))!.count,
    }));

    // Mock pending payouts (stub for Payme)
    const payouts = [
      {
        id: `payout-${driver.id}-1`,
        amount: Math.round(driver.balance * 0.5),
        status: "PENDING" as const,
        createdAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
      },
    ];

    const data: EarningsSummary = {
      today,
      week,
      month,
      balance: driver.balance,
      totalTrips: driver.totalTrips,
      avgRating: +driver.rating.toFixed(2),
      history,
      payouts,
    };

    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
