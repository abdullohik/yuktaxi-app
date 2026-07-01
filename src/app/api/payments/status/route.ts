import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/payments/status?orderId=...
 * Returns the payment record for an order.
 */
export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId") ?? "";
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "orderId talab qilinadi" },
        { status: 400 }
      );
    }
    const payment = await db.payment.findUnique({ where: { orderId } });
    if (!payment) {
      return NextResponse.json({ ok: true, data: null });
    }
    return NextResponse.json({
      ok: true,
      data: {
        id: payment.id,
        orderId: payment.orderId,
        method: payment.method,
        status: payment.status,
        amount: payment.amount,
        cardLast4: payment.cardLast4,
        cardBrand: payment.cardBrand,
        cardHolderName: payment.cardHolderName,
        transactionId: payment.transactionId,
        failureReason: payment.failureReason,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
