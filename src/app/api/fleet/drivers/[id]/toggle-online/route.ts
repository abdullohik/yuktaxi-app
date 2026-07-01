import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/fleet/drivers/[id]/toggle-online
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const online = Boolean(body?.online);

    const driver = await db.driver.update({
      where: { id },
      data: { isOnline: online },
    });

    return NextResponse.json({ ok: true, data: driver });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
