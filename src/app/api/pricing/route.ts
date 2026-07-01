import { NextRequest, NextResponse } from "next/server";
import { cargoInfo } from "@/lib/api";
import type { CargoType, PriceEstimate } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const distanceKm = Number(body?.distanceKg ?? body?.distanceKm ?? 0);
    const cargoType = String(body?.cargoType ?? "truck_small") as CargoType;
    const weightKg = Number(body?.weightKg ?? 0);

    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      return NextResponse.json(
        { ok: false, error: "distanceKm noto'g'ri" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(weightKg) || weightKg < 0) {
      return NextResponse.json(
        { ok: false, error: "weightKg noto'g'ri" },
        { status: 400 }
      );
    }

    // Mirror estimatePriceLocal exactly
    const info = cargoInfo(cargoType);
    const base = 15000;
    const distance = Math.round(distanceKm * 2500);
    const cargo = Math.round(base * (info.mult - 1));
    const weight = weightKg > 0 ? Math.round(weightKg * 15) : 0;

    // Surge pricing — rush hour multiplier
    const hour = new Date().getHours();
    let surgeMult = 1.0;
    let surgeLabel: string | null = null;
    if (hour >= 7 && hour < 9) {
      surgeMult = 1.3;
      surgeLabel = "Ertalab qizg'in vaqt: +30%";
    } else if (hour >= 17 && hour < 20) {
      surgeMult = 1.25;
      surgeLabel = "Kechqurun qizg'in vaqt: +25%";
    } else if (hour >= 22 || hour < 6) {
      surgeMult = 1.15;
      surgeLabel = "Kech kez: +15%";
    }

    const priceSom = Math.round((base + distance + cargo + weight) * surgeMult);
    const etaMin = Math.max(8, Math.round(distanceKm * 2.2 + 12));

    const data: PriceEstimate & { surgeMultiplier?: number; surgeLabel?: string | null } = {
      priceSom,
      etaMin,
      breakdown: { base, distance, cargo, weight },
      surgeMultiplier: surgeMult,
      surgeLabel,
    };

    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
