import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/fleet/trucks — list all trucks (based on driver records)
export async function GET() {
  try {
    const drivers = await db.driver.findMany({
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });

    const data = drivers.map((d) => ({
      id: d.id,
      plate: d.vehiclePlate || "—",
      type: d.vehicleType,
      status: d.isOnline ? "active" : "idle",
      make: d.vehicleType,
      year: 2023,
      driverName: d.user.name,
      driverPhone: d.user.phone,
      lastTripDate: d.updatedAt?.toISOString() || null,
      totalTrips: d.totalTrips,
      mileageKm: 0,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/fleet/trucks — add a truck (requires a driver)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const vehicleType = String(body?.vehicleType ?? "truck_small");
    const vehiclePlate = String(body?.vehiclePlate ?? "").trim();
    const make = String(body?.make ?? "").trim();
    const year = Number(body?.year) || 2023;

    if (!phone || !vehiclePlate) {
      return NextResponse.json(
        { ok: false, error: "Telefon va plata raqami kerak" },
        { status: 400 }
      );
    }

    // Create user + driver
    const user = await db.user.upsert({
      where: { phone },
      update: { role: "DRIVER", name: name || undefined },
      create: { phone, role: "DRIVER", name: name || null, language: "uz" },
    });

    const driver = await db.driver.create({
      data: {
        userId: user.id,
        vehicleType,
        vehiclePlate,
        city: "Toshkent",
      },
    });

    return NextResponse.json({ ok: true, data: driver });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
