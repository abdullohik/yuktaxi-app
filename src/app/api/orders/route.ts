import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignMockDriver, shapeOrder, ORDER_INCLUDE } from "@/lib/server/orders-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const customerPhone = String(body?.customerPhone ?? "").trim();
    if (!/^998\d{9}$/.test(customerPhone)) {
      return NextResponse.json(
        { ok: false, error: "customerPhone noto'g'ri" },
        { status: 400 }
      );
    }
    const pickup = body?.pickup ?? {};
    const dropoff = body?.dropoff ?? {};
    const cargoType = String(body?.cargoType ?? "truck_small");
    const weightKg = Math.round(Number(body?.weightKg ?? 0));
    const note = body?.note ? String(body.note) : null;
    const priceSom = Math.round(Number(body?.priceSom ?? 0));
    const distanceKm = Number(body?.distanceKm ?? 0);
    const durationMin = Math.round(Number(body?.durationMin ?? 0));

    // New: cargo manifest + address details
    const pickupApt = body?.pickupApt ? String(body.pickupApt).slice(0, 20) : null;
    const pickupEntrance = body?.pickupEntrance ? String(body.pickupEntrance).slice(0, 10) : null;
    const pickupFloor = body?.pickupFloor ? String(body.pickupFloor).slice(0, 10) : null;
    const dropoffApt = body?.dropoffApt ? String(body.dropoffApt).slice(0, 20) : null;
    const dropoffEntrance = body?.dropoffEntrance ? String(body.dropoffEntrance).slice(0, 10) : null;
    const dropoffFloor = body?.dropoffFloor ? String(body.dropoffFloor).slice(0, 10) : null;

    const cargoTitle = body?.cargoTitle ? String(body.cargoTitle).slice(0, 100) : null;
    const cargoDescription = body?.cargoDescription ? String(body.cargoDescription).slice(0, 500) : null;
    const cargoCategory = body?.cargoCategory ? String(body.cargoCategory) : null;
    const cargoLengthCm = Number.isFinite(Number(body?.cargoLengthCm)) ? Math.round(Number(body.cargoLengthCm)) : null;
    const cargoWidthCm = Number.isFinite(Number(body?.cargoWidthCm)) ? Math.round(Number(body.cargoWidthCm)) : null;
    const cargoHeightCm = Number.isFinite(Number(body?.cargoHeightCm)) ? Math.round(Number(body.cargoHeightCm)) : null;
    const cargoValueSom = Number.isFinite(Number(body?.cargoValueSom)) ? Math.round(Number(body.cargoValueSom)) : null;
    const isFragile = Boolean(body?.isFragile);
    const needsLoadingHelp = Boolean(body?.needsLoadingHelp);

    if (
      !Number.isFinite(pickup.lat) ||
      !Number.isFinite(pickup.lng) ||
      !Number.isFinite(dropoff.lat) ||
      !Number.isFinite(dropoff.lng)
    ) {
      return NextResponse.json(
        { ok: false, error: "pickup/dropoff koordinatalari noto'g'ri" },
        { status: 400 }
      );
    }

    // Ensure customer exists
    const customer = await db.user.upsert({
      where: { phone: customerPhone },
      update: {},
      create: { phone: customerPhone, role: "CUSTOMER", language: "uz" },
    });
    void customer;

    // Create order with SEARCHING
    const order = await db.order.create({
      data: {
        customerPhone,
        pickupLat: +pickup.lat,
        pickupLng: +pickup.lng,
        pickupAddress: String(pickup.address ?? ""),
        pickupApt,
        pickupEntrance,
        pickupFloor,
        dropoffLat: +dropoff.lat,
        dropoffLng: +dropoff.lng,
        dropoffAddress: String(dropoff.address ?? ""),
        dropoffApt,
        dropoffEntrance,
        dropoffFloor,
        cargoType,
        weightKg,
        note,
        priceSom,
        distanceKm,
        durationMin,
        cargoTitle,
        cargoDescription,
        cargoCategory,
        cargoLengthCm,
        cargoWidthCm,
        cargoHeightCm,
        cargoValueSom,
        isFragile,
        needsLoadingHelp,
        status: "SEARCHING",
      },
      include: ORDER_INCLUDE,
    });

    // Append SEARCHING history
    await db.orderStatusHistory.create({
      data: { orderId: order.id, status: "SEARCHING", note: "Buyurtma yaratildi" },
    });

    // Assign a mock driver
    const driverPhone = await assignMockDriver(+pickup.lat, +pickup.lng, Date.now() % 100000);

    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        driverPhone,
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
      include: ORDER_INCLUDE,
    });

    await db.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: "ACCEPTED",
        note: "Haydovchi tayinlandi",
      },
    });

    return NextResponse.json({ ok: true, data: shapeOrder(updated) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get("phone") ?? "";
    const role = (req.nextUrl.searchParams.get("role") ?? "CUSTOMER").toUpperCase();
    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "phone parametri kerak" },
        { status: 400 }
      );
    }
    const where = role === "DRIVER" ? { driverPhone: phone } : { customerPhone: phone };
    const orders = await db.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      ok: true,
      data: orders.map(shapeOrder),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
