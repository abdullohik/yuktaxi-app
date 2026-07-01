import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get("phone") ?? "";
    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "phone parametri kerak" },
        { status: 400 }
      );
    }
    const user = await db.user.findUnique({ where: { phone } });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Foydalanuvchi topilmadi" },
        { status: 404 }
      );
    }
    let driver = await db.driver.findUnique({ where: { userId: user.id } });
    if (!driver) {
      driver = await db.driver.create({
        data: {
          userId: user.id,
          isOnline: false,
          rating: 5.0,
          totalTrips: 0,
          trustScore: 80,
          vehicleType: "truck_small",
          city: "Toshkent",
          balance: 0,
        },
      });
    }
    return NextResponse.json({ ok: true, data: driver });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get("phone") ?? "";
    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "phone parametri kerak" },
        { status: 400 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const data: { isOnline?: boolean; vehicleType?: string; vehiclePlate?: string } = {};
    if (typeof body.isOnline === "boolean") data.isOnline = body.isOnline;
    if (typeof body.vehicleType === "string") data.vehicleType = body.vehicleType;
    if (typeof body.vehiclePlate === "string") data.vehiclePlate = body.vehiclePlate;

    const user = await db.user.findUnique({ where: { phone } });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Foydalanuvchi topilmadi" },
        { status: 404 }
      );
    }
    let driver = await db.driver.findUnique({ where: { userId: user.id } });
    if (!driver) {
      driver = await db.driver.create({
        data: {
          userId: user.id,
          isOnline: body.isOnline ?? false,
          rating: 5.0,
          totalTrips: 0,
          trustScore: 80,
          vehicleType: body.vehicleType ?? "truck_small",
          vehiclePlate: body.vehiclePlate ?? null,
          city: "Toshkent",
          balance: 0,
        },
      });
    } else {
      driver = await db.driver.update({
        where: { userId: user.id },
        data,
      });
    }
    return NextResponse.json({ ok: true, data: driver });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
