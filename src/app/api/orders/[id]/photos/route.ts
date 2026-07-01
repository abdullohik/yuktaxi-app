import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/orders/[id]/photos
 * Returns all photos for an order, grouped by stage.
 * Optional query: ?stage=BEFORE_PICKUP to filter.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(_req.url);
    const stage = url.searchParams.get("stage");
    const requesterPhone = url.searchParams.get("phone") ?? "";
    const requesterRole = (url.searchParams.get("role") ?? "").toUpperCase();

    // Visibility rules:
    //  - Drivers can see ALL photos of their assigned orders
    //  - Customers cannot see driver-only photos (driverOnly=true)
    const where: Record<string, unknown> = { orderId: id };
    if (stage) where.stage = stage;
    if (requesterRole !== "DRIVER") {
      where.driverOnly = false;
    }

    const photos = await db.orderPhoto.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      ok: true,
      data: photos.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        uploaderPhone: p.uploaderPhone,
        uploaderRole: p.uploaderRole as "CUSTOMER" | "DRIVER",
        stage: p.stage as "BEFORE_PICKUP" | "AT_PICKUP" | "IN_TRANSIT" | "AT_DELIVERY",
        side: p.side as "FRONT" | "BACK" | "LEFT" | "RIGHT" | null,
        driverOnly: p.driverOnly,
        dataUrl: p.dataUrl,
        note: p.note,
        createdAt: p.createdAt,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/orders/[id]/photos
 * Body: { uploaderPhone, uploaderRole, stage, dataUrl, note? }
 *
 * dataUrl must be a base64 data URL (data:image/jpeg;base64,...).
 * Max size enforced at ~5MB (after base64 encoding).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const uploaderPhone = String(body?.uploaderPhone ?? "").trim();
    const uploaderRole = String(body?.uploaderRole ?? "").trim();
    const stage = String(body?.stage ?? "").trim();
    const side = typeof body?.side === "string" ? body.side.trim() : null;
    const driverOnly = Boolean(body?.driverOnly);
    const dataUrl = String(body?.dataUrl ?? "").trim();
    const note = typeof body?.note === "string" ? body.note.trim() : null;

    if (!uploaderPhone || !uploaderRole || !stage || !dataUrl) {
      return NextResponse.json(
        { ok: false, error: "uploaderPhone, uploaderRole, stage, dataUrl — barchasi kerak" },
        { status: 400 }
      );
    }
    if (!["CUSTOMER", "DRIVER"].includes(uploaderRole)) {
      return NextResponse.json(
        { ok: false, error: "uploaderRole CUSTOMER yoki DRIVER bo'lishi kerak" },
        { status: 400 }
      );
    }
    const VALID_STAGES = ["BEFORE_PICKUP", "AT_PICKUP", "IN_TRANSIT", "AT_DELIVERY"];
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { ok: false, error: `stage quyidagilardan biri bo'lishi kerak: ${VALID_STAGES.join(", ")}` },
        { status: 400 }
      );
    }
    const VALID_SIDES = ["FRONT", "BACK", "LEFT", "RIGHT"];
    if (side && !VALID_SIDES.includes(side)) {
      return NextResponse.json(
        { ok: false, error: `side quyidagilardan biri bo'lishi kerak: ${VALID_SIDES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!dataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { ok: false, error: "dataUrl rasm formatida bo'lishi kerak (data:image/...)" },
        { status: 400 }
      );
    }
    // 5 MB limit (base64 ~6.7MB after encoding for 5MB binary)
    if (dataUrl.length > 7_000_000) {
      return NextResponse.json(
        { ok: false, error: "Rasm hajmi 5MB dan oshmasligi kerak" },
        { status: 413 }
      );
    }

    // Verify the order exists
    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Buyurtma topilmadi" },
        { status: 404 }
      );
    }

    const photo = await db.orderPhoto.create({
      data: {
        orderId: id,
        uploaderPhone,
        uploaderRole,
        stage,
        side: side || null,
        driverOnly,
        dataUrl,
        note: note || null,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: photo.id,
        orderId: photo.orderId,
        uploaderPhone: photo.uploaderPhone,
        uploaderRole: photo.uploaderRole as "CUSTOMER" | "DRIVER",
        stage: photo.stage as "BEFORE_PICKUP" | "AT_PICKUP" | "IN_TRANSIT" | "AT_DELIVERY",
        side: photo.side as "FRONT" | "BACK" | "LEFT" | "RIGHT" | null,
        driverOnly: photo.driverOnly,
        dataUrl: photo.dataUrl,
        note: photo.note,
        createdAt: photo.createdAt,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/orders/[id]/photos?photoId=...
 * Removes a single photo (only by the uploader themselves).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const photoId = url.searchParams.get("photoId");
    const requesterPhone = url.searchParams.get("phone");

    if (!photoId || !requesterPhone) {
      return NextResponse.json(
        { ok: false, error: "photoId va phone parametrlari kerak" },
        { status: 400 }
      );
    }

    const photo = await db.orderPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.orderId !== id) {
      return NextResponse.json(
        { ok: false, error: "Rasm topilmadi" },
        { status: 404 }
      );
    }
    if (photo.uploaderPhone !== requesterPhone) {
      return NextResponse.json(
        { ok: false, error: "Faqat rasm egasi o'chira oladi" },
        { status: 403 }
      );
    }

    await db.orderPhoto.delete({ where: { id: photoId } });
    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
