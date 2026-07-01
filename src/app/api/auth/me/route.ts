import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get("phone") ?? "";
    const userId = req.nextUrl.searchParams.get("userId") ?? "";

    if (!phone && !userId) {
      return NextResponse.json(
        { ok: false, error: "phone yoki userId parametri kerak" },
        { status: 400 }
      );
    }

    let user;
    if (userId) {
      user = await db.user.findUnique({
        where: { id: userId },
        include: { driver: true },
      });
    } else {
      user = await db.user.findUnique({
        where: { phone },
        include: { driver: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Foydalanuvchi topilmadi" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role as "CUSTOMER" | "DRIVER" | "FLEET",
        language: user.language as "uz" | "ru" | "en",
        avatar: user.avatar,
        createdAt: user.createdAt,
        driver: user.driver
          ? {
              id: user.driver.id,
              userId: user.driver.userId,
              isOnline: user.driver.isOnline,
              rating: user.driver.rating,
              totalTrips: user.driver.totalTrips,
              trustScore: user.driver.trustScore,
              vehicleType: user.driver.vehicleType,
              vehiclePlate: user.driver.vehiclePlate,
              city: user.driver.city,
              balance: user.driver.balance,
            }
          : null,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get("phone") ?? "";
    const userId = req.nextUrl.searchParams.get("userId") ?? "";

    if (!phone && !userId) {
      return NextResponse.json(
        { ok: false, error: "phone yoki userId parametri kerak" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const data: {
      name?: string;
      language?: string;
      role?: string;
      phone?: string;
    } = {};
    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.language === "string") data.language = body.language;
    if (typeof body.role === "string") data.role = body.role;
    if (typeof body.phone === "string" && body.phone) data.phone = body.phone;

    const existing = userId
      ? await db.user.findUnique({ where: { id: userId } })
      : await db.user.findUnique({ where: { phone } });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Foydalanuvchi topilmadi" },
        { status: 404 }
      );
    }

    const updated = await db.user.update({
      where: { id: existing.id },
      data,
    });

    // If role becomes DRIVER and no Driver row exists, create one.
    if (data.role === "DRIVER") {
      const driver = await db.driver.findUnique({
        where: { userId: updated.id },
      });
      if (!driver) {
        await db.driver.create({
          data: {
            userId: updated.id,
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
    }

    const refreshed = await db.user.findUnique({
      where: { id: existing.id },
      include: { driver: true },
    });

    return NextResponse.json({
      ok: true,
      data: {
        user: {
          id: refreshed!.id,
          phone: refreshed!.phone,
          name: refreshed!.name,
          role: refreshed!.role as "CUSTOMER" | "DRIVER" | "FLEET",
          language: refreshed!.language as "uz" | "ru" | "en",
          avatar: refreshed!.avatar,
          createdAt: refreshed!.createdAt,
        },
        driver: refreshed!.driver
          ? {
              id: refreshed!.driver.id,
              userId: refreshed!.driver.userId,
              isOnline: refreshed!.driver.isOnline,
              rating: refreshed!.driver.rating,
              totalTrips: refreshed!.driver.totalTrips,
              trustScore: refreshed!.driver.trustScore,
              vehicleType: refreshed!.driver.vehicleType,
              vehiclePlate: refreshed!.driver.vehiclePlate,
              city: refreshed!.driver.city,
              balance: refreshed!.driver.balance,
            }
          : null,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
