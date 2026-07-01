import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const driverId = String(body?.driverId ?? "");
    const online = Boolean(body?.online);
    if (!driverId) {
      return NextResponse.json(
        { ok: false, error: "driverId kerak" },
        { status: 400 }
      );
    }
    const driver = await db.driver.update({
      where: { id: driverId },
      data: { isOnline: online },
    });
    return NextResponse.json({ ok: true, data: driver });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
