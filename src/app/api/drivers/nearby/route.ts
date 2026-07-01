import { NextRequest, NextResponse } from "next/server";
import { generateNearbyDrivers } from "@/lib/server/mock-drivers";
import type { NearbyDriver } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const lat = Number(req.nextUrl.searchParams.get("lat") ?? "");
    const lng = Number(req.nextUrl.searchParams.get("lng") ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { ok: false, error: "lat va lng kerak" },
        { status: 400 }
      );
    }
    // radius is accepted but currently not used to filter (mock drivers are
    // generated close to the point by default).
    const _radius = Number(req.nextUrl.searchParams.get("radius") ?? 5);
    void _radius;

    const drivers: NearbyDriver[] = generateNearbyDrivers(lat, lng);
    return NextResponse.json({ ok: true, data: drivers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
