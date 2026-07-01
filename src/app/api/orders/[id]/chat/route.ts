import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await db.chatMessage.findMany({
      where: { orderId: id },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { name: true } } },
    });
    return NextResponse.json({
      ok: true,
      data: messages.map((m) => ({
        id: m.id,
        orderId: m.orderId,
        senderPhone: m.senderPhone,
        senderRole: m.senderRole,
        senderName: m.sender?.name ?? null,
        text: m.text,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const senderPhone = String(body?.senderPhone ?? "").trim();
    const senderRole = String(body?.senderRole ?? "CUSTOMER").toUpperCase();
    const text = String(body?.text ?? "").trim();

    if (!senderPhone || !text) {
      return NextResponse.json(
        { ok: false, error: "senderPhone va text kerak" },
        { status: 400 }
      );
    }

    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "Buyurtma topilmadi" },
        { status: 404 }
      );
    }

    const msg = await db.chatMessage.create({
      data: {
        orderId: id,
        senderPhone,
        senderRole: senderRole === "DRIVER" ? "DRIVER" : "CUSTOMER",
        text,
      },
      include: { sender: { select: { name: true } } },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: msg.id,
        orderId: msg.orderId,
        senderPhone: msg.senderPhone,
        senderRole: msg.senderRole,
        senderName: msg.sender?.name ?? null,
        text: msg.text,
        createdAt: msg.createdAt.toISOString(),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
