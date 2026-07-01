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
    const addresses = await db.savedAddress.findMany({
      where: { userPhone: phone },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      ok: true,
      data: addresses.map((a) => ({
        id: a.id,
        userPhone: a.userPhone,
        label: a.label,
        lat: a.lat,
        lng: a.lng,
        address: a.address,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone ?? "").trim();
    const label = String(body?.label ?? "").trim();
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const address = String(body?.address ?? "").trim();

    if (!/^998\d{9}$/.test(phone)) {
      return NextResponse.json(
        { ok: false, error: "phone noto'g'ri" },
        { status: 400 }
      );
    }
    if (!label || !Number.isFinite(lat) || !Number.isFinite(lng) || !address) {
      return NextResponse.json(
        { ok: false, error: "label, lat, lng, address kerak" },
        { status: 400 }
      );
    }

    // ensure user exists
    await db.user.upsert({
      where: { phone },
      update: {},
      create: { phone, role: "CUSTOMER", language: "uz" },
    });

    const created = await db.savedAddress.create({
      data: {
        userPhone: phone,
        label,
        lat: +lat,
        lng: +lng,
        address,
      },
    });
    return NextResponse.json({
      ok: true,
      data: {
        id: created.id,
        userPhone: created.userPhone,
        label: created.label,
        lat: created.lat,
        lng: created.lng,
        address: created.address,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
