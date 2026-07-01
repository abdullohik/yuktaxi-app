import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/fleet/drivers — list all drivers with details
export async function GET() {
  try {
    const drivers = await db.driver.findMany({
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });

    const data = drivers.map((d) => {
      // Count active orders for this driver
      return {
        id: d.id,
        userId: d.userId,
        name: d.user.name,
        phone: d.user.phone ?? "",
        isOnline: d.isOnline,
        rating: d.rating,
        totalTrips: d.totalTrips,
        trustScore: d.trustScore,
        vehicleType: d.vehicleType,
        vehiclePlate: d.vehiclePlate,
        city: d.city,
        balance: d.balance,
        activeOrderCount: 0, // simplified
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/fleet/drivers — add a new driver
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const vehicleType = String(body?.vehicleType ?? "truck_small");
    const vehiclePlate = String(body?.vehiclePlate ?? "").trim();

    if (!/^998\d{9}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: "Telefon raqam noto'g'ri" }, { status: 400 });
    }

    // Create or find user
    const user = await db.user.upsert({
      where: { phone },
      update: { role: "DRIVER", name: name || undefined },
      create: { phone, role: "DRIVER", name: name || null, language: "uz" },
    });

    // Create driver profile
    const driver = await db.driver.create({
      data: {
        userId: user.id,
        vehicleType,
        vehiclePlate: vehiclePlate || null,
        city: "Toshkent",
      },
    });

    return NextResponse.json({ ok: true, data: driver });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
