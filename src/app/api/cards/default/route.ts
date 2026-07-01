import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/cards/default?id=...&phone=...
export async function PATCH(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const phone = req.nextUrl.searchParams.get("phone");
    if (!id || !phone) return NextResponse.json({ ok: false, error: "id and phone required" }, { status: 400 });

    // Unset all defaults for this user
    await db.savedCard.updateMany({
      where: { userPhone: phone, isDefault: true },
      data: { isDefault: false },
    });

    // Set the new default
    const result = await db.savedCard.updateMany({
      where: { id, userPhone: phone },
      data: { isDefault: true },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}