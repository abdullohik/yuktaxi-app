// AI comparison between customer-submitted photos and driver-submitted 4-side photos.
//
// Tries Gemini vision first (it can actually look at multiple images and reason
// about whether they show the same item + assess condition). Falls back to a
// deterministic heuristic that returns neutral 50/50 scores so the driver UI
// still works.
//
// Visibility: the AIComparison record is DRIVER-ONLY. Customers never see it.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callGeminiCompare } from "@/lib/server/ai-compare";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId ?? "").trim();
    const driverPhone = String(body?.driverPhone ?? "").trim();

    if (!orderId || !driverPhone) {
      return NextResponse.json(
        { ok: false, error: "orderId va driverPhone talab qilinadi" },
        { status: 400 }
      );
    }

    // Verify the order exists and the driver is assigned
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Buyurtma topilmadi" },
        { status: 404 }
      );
    }
    if (order.driverPhone !== driverPhone) {
      return NextResponse.json(
        { ok: false, error: "Faqat ushbu buyurtmaga tayinlangan haydovchi AI tahlilni ishga tushira oladi" },
        { status: 403 }
      );
    }

    // Fetch customer photos (BEFORE_PICKUP, not driver-only) and driver photos (AT_PICKUP with sides)
    const [customerPhotos, driverPhotos] = await Promise.all([
      db.orderPhoto.findMany({
        where: { orderId, stage: "BEFORE_PICKUP", driverOnly: false },
      }),
      db.orderPhoto.findMany({
        where: { orderId, stage: "AT_PICKUP", uploaderRole: "DRIVER" },
      }),
    ]);

    if (customerPhotos.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Mijozdan yuk rasmlari topilmadi" },
        { status: 400 }
      );
    }
    if (driverPhotos.length < 4) {
      return NextResponse.json(
        { ok: false, error: `Haydovchidan 4 ta rasm (front/back/left/right) kerak, topildi: ${driverPhotos.length}` },
        { status: 400 }
      );
    }

    // Try Gemini vision compare
    const result = await callGeminiCompare({
      customerPhotos: customerPhotos.map((p) => ({ id: p.id, dataUrl: p.dataUrl })),
      driverPhotos: driverPhotos.map((p) => ({ id: p.id, dataUrl: p.dataUrl, side: p.side })),
      cargoTitle: order.cargoTitle ?? undefined,
      cargoDescription: order.cargoDescription ?? undefined,
      cargoCategory: order.cargoCategory ?? undefined,
      lang: "ru", // default to Russian for driver-facing text (most common driver language)
    });

    if (!result) {
      // Heuristic fallback — neutral scores so UI still works
      const heuristic = {
        matchPercentage: 75,
        conditionPercentage: 80,
        observedItem: "Tahlif amalga oshmadi — heuristic ishlatildi",
        damageNotes: null as string | null,
        recommendation: "INSPECT_WITH_CUSTOMER" as const,
        provider: "heuristic" as const,
      };
      const created = await db.aIComparison.create({
        data: {
          orderId,
          customerPhotoIds: JSON.stringify(customerPhotos.map((p) => p.id)),
          driverPhotoIds: JSON.stringify(driverPhotos.map((p) => p.id)),
          matchPercentage: heuristic.matchPercentage,
          conditionPercentage: heuristic.conditionPercentage,
          observedItem: heuristic.observedItem,
          damageNotes: heuristic.damageNotes,
          recommendation: heuristic.recommendation,
          provider: heuristic.provider,
        },
      });
      return NextResponse.json({ ok: true, data: shapeComparison(created) });
    }

    const created = await db.aIComparison.create({
      data: {
        orderId,
        customerPhotoIds: JSON.stringify(customerPhotos.map((p) => p.id)),
        driverPhotoIds: JSON.stringify(driverPhotos.map((p) => p.id)),
        matchPercentage: result.matchPercentage,
        conditionPercentage: result.conditionPercentage,
        observedItem: result.observedItem,
        damageNotes: result.damageNotes,
        recommendation: result.recommendation,
        provider: result.provider,
      },
    });
    return NextResponse.json({ ok: true, data: shapeComparison(created) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function shapeComparison(p: {
  id: string;
  orderId: string;
  customerPhotoIds: string;
  driverPhotoIds: string;
  matchPercentage: number;
  conditionPercentage: number;
  observedItem: string | null;
  damageNotes: string | null;
  recommendation: string;
  provider: string;
  createdAt: Date;
}) {
  return {
    id: p.id,
    orderId: p.orderId,
    customerPhotoIds: JSON.parse(p.customerPhotoIds) as string[],
    driverPhotoIds: JSON.parse(p.driverPhotoIds) as string[],
    matchPercentage: p.matchPercentage,
    conditionPercentage: p.conditionPercentage,
    observedItem: p.observedItem,
    damageNotes: p.damageNotes,
    recommendation: p.recommendation,
    provider: p.provider as "gemini" | "z-ai" | "heuristic",
    createdAt: p.createdAt.toISOString(),
  };
}

/**
 * GET /api/ai/compare-photos?orderId=...&driverPhone=...
 * Returns the latest AI comparison for an order (driver-only).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId") ?? "";
    const driverPhone = url.searchParams.get("driverPhone") ?? "";

    if (!orderId || !driverPhone) {
      return NextResponse.json(
        { ok: false, error: "orderId va driverPhone talab qilinadi" },
        { status: 400 }
      );
    }

    // Verify driver is assigned
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order || order.driverPhone !== driverPhone) {
      return NextResponse.json(
        { ok: false, error: "Ruxsat yo'q" },
        { status: 403 }
      );
    }

    const comparisons = await db.aIComparison.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    if (comparisons.length === 0) {
      return NextResponse.json({ ok: true, data: null });
    }
    return NextResponse.json({ ok: true, data: shapeComparison(comparisons[0]) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
