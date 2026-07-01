import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached, setFallbackCached } from "@/lib/server/geo-cache";

interface IpGeoResult {
  lat: number;
  lng: number;
  city: string;
  region: string;
  country: string;
}

const TASHKENT: IpGeoResult = {
  lat: 41.31218,
  lng: 69.25138,
  city: "Toshkent",
  region: "Toshkent",
  country: "Uzbekistan",
};

// Uzbekistan approximate bounds
const UZ_LAT_MIN = 37.0;
const UZ_LAT_MAX = 45.6;
const UZ_LNG_MIN = 55.9;
const UZ_LNG_MAX = 74.6;

function isInUzbekistan(lat: number, lng: number): boolean {
  return lat >= UZ_LAT_MIN && lat <= UZ_LAT_MAX && lng >= UZ_LNG_MIN && lng <= UZ_LNG_MAX;
}

/**
 * Try multiple IP geolocation services in order.
 * Uses HTTPS wherever possible for reliability.
 */
async function tryIpApi(ip: string): Promise<IpGeoResult | null> {
  // 1. ipapi.co — HTTPS, free 1000/day, reliable
  try {
    const url = ip
      ? `https://ipapi.co/${ip}/json/`
      : "https://ipapi.co/json/";
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(4000),
    });
    if (resp.ok) {
      const raw = await resp.json();
      if (raw.latitude && raw.longitude && !raw.error) {
        return {
          lat: +raw.latitude,
          lng: +raw.longitude,
          city: raw.city || "",
          region: raw.region || "",
          country: raw.country_name || raw.country || "",
        };
      }
    }
  } catch {
    // Fall through to next service
  }

  // 2. ip-api.com — HTTP only on free tier, but widely available
  try {
    const url = ip
      ? `http://ip-api.com/json/${ip}?fields=status,lat,lon,city,regionName,country&lang=en`
      : `http://ip-api.com/json/?fields=status,lat,lon,city,regionName,country&lang=en`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(4000),
    });
    if (resp.ok) {
      const raw = await resp.json();
      if (raw.status === "success" && raw.lat && raw.lon) {
        return {
          lat: raw.lat,
          lng: raw.lon,
          city: raw.city || "",
          region: raw.regionName || "",
          country: raw.country || "",
        };
      }
    }
  } catch {
    // Fall through to fallback
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    // Get client IP (respect X-Forwarded-For from gateway)
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0]?.trim() || realIp || req.headers.get("x-ip") || "";

    // Check cache first (only for successful, non-fallback results)
    const cacheKey = `ipgeo:${ip || "unknown"}`;
    const cached = getCached<IpGeoResult>(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true, data: cached });
    }

    // Try the IP geolocation service chain
    const result = await tryIpApi(ip);

    if (result) {
      // If the resolved location is outside Uzbekistan, use Tashkent as default
      // This is correct for YukTaxi which only operates in Tashkent
      if (!isInUzbekistan(result.lat, result.lng)) {
        setFallbackCached(cacheKey, TASHKENT);
        return NextResponse.json({ ok: true, data: TASHKENT, fallback: true });
      }

      // Cache successful results for 10 minutes
      setCached(cacheKey, result, 10 * 60 * 1000);
      return NextResponse.json({ ok: true, data: result });
    }

    // All services failed — return Tashkent fallback with short cache (1 min)
    setFallbackCached(cacheKey, TASHKENT);
    return NextResponse.json({ ok: true, data: TASHKENT, fallback: true });
  } catch {
    // Unexpected error — return Tashkent fallback, don't cache
    return NextResponse.json({ ok: true, data: TASHKENT, fallback: true });
  }
}