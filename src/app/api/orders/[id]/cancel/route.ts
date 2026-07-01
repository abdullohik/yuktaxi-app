import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shapeOrder, ORDER_INCLUDE } from "@/lib/server/orders-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body?.reason ? String(body.reason) : "Mijoz bekor qildi";

    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Buyurtma topilmadi" },
        { status: 404 }
      );
    }
    if (["DELIVERED", "COMPLETED", "CANCELLED"].includes(order.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Buyurtma ${order.status} holatida — bekor qilib bo'lmaydi`,
        },
        { status: 400 }
      );
    }

    const updated = await db.order.update({
      where: { id },
      data: { status: "CANCELLED", cancelReason: reason },
      include: ORDER_INCLUDE,
    });

    await db.orderStatusHistory.create({
      data: { orderId: id, status: "CANCELLED", note: reason },
    });

    return NextResponse.json({ ok: true, data: shapeOrder(updated) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
