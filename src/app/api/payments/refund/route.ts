import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/payments/refund
 * Body: { orderId, reason? }
 *
 * Refunds a captured payment. Only works if the payment was CAPTURED.
 * Sets status to REFUNDED with the original transactionId preserved.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId ?? "").trim();
    const reason = typeof body?.reason === "string" ? body.reason.trim() : null;

    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "orderId talab qilinadi" },
        { status: 400 }
      );
    }
    const payment = await db.payment.findUnique({ where: { orderId } });
    if (!payment) {
      return NextResponse.json(
        { ok: false, error: "To'lov topilmadi" },
        { status: 404 }
      );
    }
    if (payment.status !== "CAPTURED") {
      return NextResponse.json(
        { ok: false, error: `Faqat CAPTURED to'lovni qaytarish mumkin. Joriy holat: ${payment.status}` },
        { status: 400 }
      );
    }

    const updated = await db.payment.update({
      where: { orderId },
      data: {
        status: "REFUNDED",
        failureReason: reason,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: updated.id,
        orderId: updated.orderId,
        method: updated.method,
        status: updated.status,
        amount: updated.amount,
        cardLast4: updated.cardLast4,
        cardBrand: updated.cardBrand,
        cardHolderName: updated.cardHolderName,
        transactionId: updated.transactionId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
