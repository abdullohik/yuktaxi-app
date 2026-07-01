import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shapeOrder, ORDER_INCLUDE } from "@/lib/server/orders-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: {
        ...ORDER_INCLUDE,
        history: { orderBy: { createdAt: "asc" } },
        reviews: true,
        photos: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Buyurtma topilmadi" },
        { status: 404 }
      );
    }
    const shaped = shapeOrder(order);
    return NextResponse.json({
      ok: true,
      data: {
        ...shaped,
        history: order.history.map((h) => ({
          id: h.id,
          orderId: h.orderId,
          status: h.status,
          note: h.note,
          createdAt: h.createdAt.toISOString(),
        })),
        reviews: order.reviews.map((r) => ({
          id: r.id,
          orderId: r.orderId,
          reviewerPhone: r.reviewerPhone,
          rating: r.rating,
          onTime: r.onTime,
          cargoSafe: r.cargoSafe,
          polite: r.polite,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
        })),
        photos: order.photos.map((p) => ({
          id: p.id,
          orderId: p.orderId,
          uploaderPhone: p.uploaderPhone,
          uploaderRole: p.uploaderRole,
          stage: p.stage,
          dataUrl: p.dataUrl,
          note: p.note,
          createdAt: p.createdAt.toISOString(),
        })),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
