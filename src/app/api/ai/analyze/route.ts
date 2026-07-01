import { NextRequest, NextResponse } from "next/server";
import { analyzeCargo, type AIAnalyzeInput } from "@/lib/server/ai-analyzer";
import type { CargoType } from "@/lib/types";

/**
 * POST /api/ai/analyze
 * Body: { distanceKm, cargoType, weightKg, pickupAddress, dropoffAddress, note?, photoDataUrl? }
 *
 * Returns an AI-generated cargo analysis: recommended vehicle, weight estimate,
 * price range, route notes, loading tips, risk level.
 *
 * Tries Gemini first (with vision if photo provided), falls back to z-ai-web-dev-sdk,
 * finally to a deterministic heuristic. The "provider" field tells the caller which
 * engine produced the answer.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const distanceKm = Number(body?.distanceKm);
    const cargoType = String(body?.cargoType ?? "") as CargoType;
    const weightKg = Number(body?.weightKg);
    const pickupAddress = String(body?.pickupAddress ?? "");
    const dropoffAddress = String(body?.dropoffAddress ?? "");
    const note = typeof body?.note === "string" ? body.note : null;
    const photoDataUrl =
      typeof body?.photoDataUrl === "string" && body.photoDataUrl.startsWith("data:image/")
        ? body.photoDataUrl
        : null;
    const lang = (body?.lang === "ru" || body?.lang === "en" || body?.lang === "uz") ? body.lang : "uz";

    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      return NextResponse.json(
        { ok: false, error: "distanceKm noto'g'ri" },
        { status: 400 }
      );
    }
    const VALID: CargoType[] = ["pickup", "van", "truck_small", "truck_medium", "truck_large"];
    if (!VALID.includes(cargoType)) {
      return NextResponse.json(
        { ok: false, error: "cargoType noto'g'ri" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(weightKg) || weightKg < 0) {
      return NextResponse.json(
        { ok: false, error: "weightKg noto'g'ri" },
        { status: 400 }
      );
    }

    const input: AIAnalyzeInput = {
      distanceKm,
      cargoType,
      weightKg,
      pickupAddress,
      dropoffAddress,
      note,
      photoDataUrl,
      lang,
      // Full cargo manifest for accurate pricing
      cargoTitle: typeof body?.cargoTitle === "string" ? body.cargoTitle : null,
      cargoDescription: typeof body?.cargoDescription === "string" ? body.cargoDescription : null,
      cargoCategory: typeof body?.cargoCategory === "string" ? body.cargoCategory : null,
      cargoLengthCm: Number.isFinite(Number(body?.cargoLengthCm)) ? Number(body.cargoLengthCm) : null,
      cargoWidthCm: Number.isFinite(Number(body?.cargoWidthCm)) ? Number(body.cargoWidthCm) : null,
      cargoHeightCm: Number.isFinite(Number(body?.cargoHeightCm)) ? Number(body.cargoHeightCm) : null,
      cargoValueSom: Number.isFinite(Number(body?.cargoValueSom)) ? Number(body.cargoValueSom) : null,
      isFragile: Boolean(body?.isFragile),
      needsLoadingHelp: Boolean(body?.needsLoadingHelp),
    };

    const analysis = await analyzeCargo(input);

    return NextResponse.json({ ok: true, data: analysis });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
