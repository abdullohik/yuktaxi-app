import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/server/geo-cache";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    if (!q.trim()) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const cacheKey = `search:${q.trim().toLowerCase()}`;
    const cached = getCached<unknown[]>(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true, data: cached });
    }

    const apiKey = process.env.YANDEX_MAPS_API_KEY || process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || "";

    // Try Yandex Geocoder first (if API key is available)
    if (apiKey) {
      try {
        const params = new URLSearchParams({
          geocode: q,
          format: "json",
          lang: "uz_RU",
          apikey: apiKey,
          results: "6",
        });
        // Bias results to Tashkent area
        params.set("bbox", "69.05,41.15~69.45,41.45");
        params.set("rspn", "1");

        const url = `https://geocode-maps.yandex.ru/1.x/?${params.toString()}`;

        const resp = await fetch(url, {
          headers: {
            "User-Agent": "YukTaxi/1.0 (yuktaxi.app)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(5000),
        });

        if (resp.ok) {
          const raw = (await resp.json()) as {
            response?: {
              GeoObjectCollection?: {
                featureMember?: Array<{
                  GeoObject?: {
                    metaDataProperty?: {
                      GeocoderMetaData?: { text?: string };
                    };
                    Point?: {
                      pos?: string;
                    };
                    name?: string;
                    description?: string;
                  };
                }>;
              };
            };
          };
          const members = raw.response?.GeoObjectCollection?.featureMember ?? [];

          if (members.length > 0) {
            const data = members.map((m) => {
              const geo = m.GeoObject;
              const posStr = geo?.Point?.pos ?? "";
              const [lng, lat] = posStr.split(" ").map(Number);
              const text = geo?.metaDataProperty?.GeocoderMetaData?.text;
              const name = geo?.name;
              const desc = geo?.description;
              return {
                display_name: name && desc ? `${name}, ${desc}` : (text || "Noma'lum"),
                lat: lat || 41.31218,
                lng: lng || 69.25138,
              };
            }).filter((d) => d.lat && d.lng);

            if (data.length > 0) {
              setCached(cacheKey, data);
              return NextResponse.json({ ok: true, data });
            }
          }
        }
      } catch {
        // Yandex Geocoder failed — fall through to Nominatim
      }
    }

    // Fallback: Nominatim (OpenStreetMap)
    const nomUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams(
      {
        q,
        format: "json",
        countrycodes: "uz",
        limit: "6",
        "accept-language": "uz",
      }
    ).toString()}`;

    const resp = await fetch(nomUrl, {
      headers: {
        "User-Agent": "YukTaxi/1.0 (yuktaxi.app)",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!resp.ok) {
      return NextResponse.json(
        { ok: false, error: `Nominatim xatosi: ${resp.status}` },
        { status: 502 }
      );
    }
    const nomRaw = (await resp.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
    }>;
    const data = nomRaw.map((r) => ({
      display_name: r.display_name,
      lat: +r.lat,
      lon: +r.lon,
    }));
    setCached(cacheKey, data);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}