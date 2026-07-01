import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/server/geo-cache";

export async function GET(req: NextRequest) {
  try {
    const lat = req.nextUrl.searchParams.get("lat") ?? "";
    const lng = req.nextUrl.searchParams.get("lng") ?? "";
    if (!lat || !lng) {
      return NextResponse.json(
        { ok: false, error: "lat va lng parametri kerak" },
        { status: 400 }
      );
    }

    const cacheKey = `reverse:${lat},${lng}`;
    const cached = getCached<{ display_name: string }>(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true, data: cached });
    }

    const apiKey = process.env.YANDEX_MAPS_API_KEY || process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || "";

    // Try Yandex Geocoder first (if API key is available)
    if (apiKey) {
      try {
        const url = `https://geocode-maps.yandex.ru/1.x/?${new URLSearchParams({
          geocode: `${lng},${lat}`,
          format: "json",
          kind: "house",
          lang: "uz_RU",
          apikey: apiKey,
          results: "1",
        }).toString()}`;

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
                    name?: string;
                    description?: string;
                  };
                }>;
              };
            };
          };
          const member = raw.response?.GeoObjectCollection?.featureMember?.[0];
          const geoObj = member?.GeoObject;
          const text = geoObj?.metaDataProperty?.GeocoderMetaData?.text;
          const name = geoObj?.name;
          const desc = geoObj?.description;

          if (text) {
            // Format: "Toshkent, Chilanzar tumani, Katartal ko'cha, 15"
            const display_name = name && desc ? `${name}, ${desc}` : text;
            const data = { display_name };
            setCached(cacheKey, data);
            return NextResponse.json({ ok: true, data });
          }
        }
      } catch {
        // Yandex Geocoder failed — fall through to Nominatim
      }
    }

    // Fallback: Nominatim (OpenStreetMap) — always works, no key needed
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams(
      {
        lat,
        lon: lng,
        format: "json",
        "accept-language": "uz",
      }
    ).toString()}`;

    const resp = await fetch(nomUrl, {
      headers: {
        "User-Agent": "YukTaxi/1.0 (yuktaxi.app)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      return NextResponse.json(
        { ok: false, error: `Geocoding xatosi: ${resp.status}` },
        { status: 502 }
      );
    }
    const nomRaw = (await resp.json()) as {
      display_name?: string;
      error?: string;
    };
    if (!nomRaw.display_name) {
      return NextResponse.json(
        { ok: false, error: nomRaw.error ?? "Manzil topilmadi" },
        { status: 404 }
      );
    }
    const data = { display_name: nomRaw.display_name };
    setCached(cacheKey, data);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}