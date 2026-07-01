import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, haversineKm } from "@/lib/server/geo-cache";

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const fromLat = p.get("fromLat") ?? "";
    const fromLng = p.get("fromLng") ?? "";
    const toLat = p.get("toLat") ?? "";
    const toLng = p.get("toLng") ?? "";
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return NextResponse.json(
        {
          ok: false,
          error: "fromLat,fromLng,toLat,toLng parametri kerak",
        },
        { status: 400 }
      );
    }
    const fLat = +fromLat;
    const fLng = +fromLng;
    const tLat = +toLat;
    const tLng = +toLng;

    const cacheKey = `route:${fLat.toFixed(5)},${fLng.toFixed(
      5
    )};${tLat.toFixed(5)},${tLng.toFixed(5)}`;
    const cached = getCached<{
      distanceKm: number;
      durationMin: number;
      geometry: [number, number][];
    }>(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true, data: cached });
    }

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fLng},${fLat};${tLng},${tLat}?overview=full&geometries=geojson`;

    let data: {
      distanceKm: number;
      durationMin: number;
      geometry: [number, number][];
    };

    try {
      const resp = await fetch(osrmUrl, {
        headers: { "User-Agent": "YukTaxi/1.0 (yuktaxi.app)" },
        cache: "no-store",
      });
      if (!resp.ok) throw new Error(`OSRM ${resp.status}`);
      const raw = (await resp.json()) as {
        routes?: Array<{
          distance?: number; // meters
          duration?: number; // seconds
          geometry?: { coordinates?: [number, number][] };
        }>;
      };
      const route = raw.routes?.[0];
      if (!route) throw new Error("OSRM yo'nalish topilmadi");
      const distanceKm = +((route.distance ?? 0) / 1000).toFixed(2);
      const durationMin = Math.max(
        1,
        Math.round((route.duration ?? 0) / 60)
      );
      const coords = route.geometry?.coordinates ?? [];
      // OSRM returns [lng,lat] pairs; flip to [lat,lng]
      const geometry: [number, number][] = coords.map(([lng, lat]) => [
        +lat,
        +lng,
      ]);
      data = { distanceKm, durationMin, geometry };
    } catch {
      // Fallback: haversine + estimate
      const distanceKm = +haversineKm(fLat, fLng, tLat, tLng).toFixed(2);
      const durationMin = Math.max(
        5,
        Math.round(distanceKm / 40 * 60)
      );
      data = {
        distanceKm,
        durationMin,
        geometry: [
          [fLat, fLng],
          [tLat, tLng],
        ],
      };
    }

    setCached(cacheKey, data);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
