import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/payments/charge
 * Body: { orderId, method: "CARD" | "CASH", cardNumber, cardExp, cardCvv, cardHolderName }
 *
 * Mock payment processor. In production, this would integrate with Uzcard/Humo/Uzum
 * or a payment aggregator like Click/Payme.
 *
 * For CARD: validates card number (Luhn check), authorizes + captures funds,
 *   persists only last 4 + brand (never the full PAN or CVV).
 * For CASH: creates a PENDING payment that gets CAPTURED when the driver marks
 *   the order as DELIVERED.
 *
 * Returns the Payment record.
 */

// Luhn algorithm — validates card number checksum
function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectBrand(cardNumber: string): "visa" | "mastercard" | "uzcard" | "humo" | "unknown" {
  const n = cardNumber.replace(/\D/g, "");
  // Uzcard: 16 digits starting with 8600
  if (/^8600\d{12}$/.test(n)) return "uzcard";
  // Humo: 16 digits starting with 9060
  if (/^9060\d{12}$/.test(n)) return "humo";
  // Visa: starts with 4
  if (/^4\d{12,15}$/.test(n)) return "visa";
  // Mastercard: 51-55 or 2221-2720
  if (/^5[1-5]\d{14}$/.test(n) || /^2(2[2-9]\d{2}|[3-6]\d{3}|7[01]\d{2}|720)\d{12}$/.test(n)) return "mastercard";
  return "unknown";
}

// Simulate payment processing delay
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId ?? "").trim();
    const method = String(body?.method ?? "CARD").toUpperCase() as "CARD" | "CASH";

    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "orderId talab qilinadi" },
        { status: 400 }
      );
    }
    if (!["CARD", "CASH"].includes(method)) {
      return NextResponse.json(
        { ok: false, error: "method CARD yoki CASH bo'lishi kerak" },
        { status: 400 }
      );
    }

    // Amount: take from body (for draft payments before order is created)
    // or look it up from the order if it already exists.
    let amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      const order = await db.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return NextResponse.json(
          { ok: false, error: "amount talab qilinadi (yoki mavjud buyurtma)" },
          { status: 400 }
        );
      }
      if (order.status === "CANCELLED" || order.status === "COMPLETED") {
        return NextResponse.json(
          { ok: false, error: "Bu buyurtma uchun to'lov mumkin emas" },
          { status: 400 }
        );
      }
      amount = order.priceSom;
    }

    // Check if payment already exists & captured
    const existing = await db.payment.findUnique({ where: { orderId } });
    if (existing && (existing.status === "CAPTURED" || existing.status === "AUTHORIZED")) {
      return NextResponse.json(
        { ok: false, error: "Bu buyurtma uchun to'lov allaqachon amalga oshirilgan", data: existing },
        { status: 409 }
      );
    }

    if (method === "CASH") {
      // CASH: create PENDING payment, captured on delivery
      const payment = await db.payment.upsert({
        where: { orderId },
        update: {
          method: "CASH",
          status: "PENDING",
          amount,
          failureReason: null,
        },
        create: {
          orderId,
          method: "CASH",
          status: "PENDING",
          amount,
        },
      });
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
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        },
      });
    }

    // CARD payment — validate card details
    const cardNumber = String(body?.cardNumber ?? "").replace(/\s/g, "");
    const cardExp = String(body?.cardExp ?? "").trim();
    const cardCvv = String(body?.cardCvv ?? "").trim();
    const cardHolderName = String(body?.cardHolderName ?? "").trim();

    if (!cardNumber || !cardExp || !cardCvv || !cardHolderName) {
      return NextResponse.json(
        { ok: false, error: "Karta ma'lumotlari to'liq emas" },
        { status: 400 }
      );
    }
    if (!luhnCheck(cardNumber)) {
      return NextResponse.json(
        { ok: false, error: "Karta raqami noto'g'ri" },
        { status: 400 }
      );
    }
    // Exp format MM/YY
    if (!/^\d{2}\/\d{2}$/.test(cardExp)) {
      return NextResponse.json(
        { ok: false, error: "Amal qilish muddati noto'g'ri (MM/YY)" },
        { status: 400 }
      );
    }
    const [mm, yy] = cardExp.split("/").map((x) => parseInt(x, 10));
    const expDate = new Date(2000 + yy, mm, 1); // first day of next month
    if (expDate < new Date()) {
      return NextResponse.json(
        { ok: false, error: "Karta muddati o'tgan" },
        { status: 400 }
      );
    }
    if (!/^\d{3,4}$/.test(cardCvv)) {
      return NextResponse.json(
        { ok: false, error: "CVV noto'g'ri" },
        { status: 400 }
      );
    }

    // Simulate processing
    await delay(1500);

    // 95% success rate (mock)
    const success = Math.random() > 0.05;
    const brand = detectBrand(cardNumber);
    const last4 = cardNumber.slice(-4);
    const txnId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (!success) {
      // Record failure
      const payment = await db.payment.upsert({
        where: { orderId },
        update: {
          method: "CARD",
          status: "FAILED",
          amount,
          cardLast4: last4,
          cardBrand: brand,
          cardHolderName,
          transactionId: txnId,
          failureReason: "Karta rad etdi (mock)",
        },
        create: {
          orderId,
          method: "CARD",
          status: "FAILED",
          amount,
          cardLast4: last4,
          cardBrand: brand,
          cardHolderName,
          transactionId: txnId,
          failureReason: "Karta rad etdi (mock)",
        },
      });
      return NextResponse.json(
        { ok: false, error: "To'lov amalga oshmadi: karta rad etdi", data: payment },
        { status: 402 }
      );
    }

    // Success — capture immediately (authorized + captured)
    const payment = await db.payment.upsert({
      where: { orderId },
      update: {
        method: "CARD",
        status: "CAPTURED",
        amount,
        cardLast4: last4,
        cardBrand: brand,
        cardHolderName,
        transactionId: txnId,
        failureReason: null,
      },
      create: {
        orderId,
        method: "CARD",
        status: "CAPTURED",
        amount,
        cardLast4: last4,
        cardBrand: brand,
        cardHolderName,
        transactionId: txnId,
      },
    });

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
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
