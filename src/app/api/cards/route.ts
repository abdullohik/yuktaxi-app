import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Detect card brand from first digits
function detectBrand(pan: string): string {
  const d = pan.replace(/\s/g, "");
  if (d.startsWith("8600") || d.startsWith("8601") || d.startsWith("8602")) return "uzcard";
  if (d.startsWith("9060") || d.startsWith("9061")) return "humo";
  if (d.startsWith("4")) return "visa";
  const f2 = parseInt(d.slice(0, 2), 10);
  if ((f2 >= 51 && f2 <= 55) || (f2 >= 22 && f2 <= 27)) return "mastercard";
  return "unknown";
}

// GET /api/cards?phone=...
export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get("phone");
    if (!phone) return NextResponse.json({ ok: false, error: "phone required" }, { status: 400 });

    const cards = await db.savedCard.findMany({
      where: { userPhone: phone },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ ok: true, data: cards });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/cards — save a new card
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { phone, cardNumber, label, cardHolderName } = body as {
      phone?: string;
      cardNumber?: string;
      label?: string;
      cardHolderName?: string;
    };

    if (!phone || !cardNumber) {
      return NextResponse.json({ ok: false, error: "phone and cardNumber required" }, { status: 400 });
    }

    const pan = cardNumber.replace(/\s/g, "");
    if (!/^\d{16,19}$/.test(pan)) {
      return NextResponse.json({ ok: false, error: "Card number must be 16-19 digits" }, { status: 400 });
    }

    const cardLast4 = pan.slice(-4);
    const cardBrand = detectBrand(pan);

    // If no other cards exist, make this the default
    const existing = await db.savedCard.count({ where: { userPhone: phone } });
    const isDefault = existing === 0;

    const card = await db.savedCard.create({
      data: {
        userPhone: phone,
        cardLast4,
        cardBrand,
        label: label || null,
        cardHolderName: cardHolderName || null,
        isDefault,
      },
    });

    return NextResponse.json({ ok: true, data: card }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/cards?id=...&phone=...
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const phone = req.nextUrl.searchParams.get("phone");
    if (!id || !phone) return NextResponse.json({ ok: false, error: "id and phone required" }, { status: 400 });

    await db.savedCard.deleteMany({ where: { id, userPhone: phone } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}