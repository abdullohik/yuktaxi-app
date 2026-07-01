// AI analyzer for cargo pricing / cargo type / route notes.
//
// Tries Gemini (Google Generative Language API) first. If the key is missing,
// quota-exhausted, or any error occurs, falls back to z-ai-web-dev-sdk
// (ZAI's own LLM), and finally to a deterministic heuristic so the UX never
// breaks.
//
// Gemini key is read from process.env.GEMINI_API_KEY.

import type { CargoType } from "@/lib/types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface AIAnalyzeInput {
  distanceKm: number;
  cargoType: CargoType;
  weightKg: number;
  pickupAddress: string;
  dropoffAddress: string;
  note?: string | null;
  photoDataUrl?: string | null; // optional: cargo photo for vision analysis
  lang?: "uz" | "ru" | "en"; // preferred output language (default uz)
  // NEW: full cargo manifest for accurate pricing
  cargoTitle?: string | null;
  cargoDescription?: string | null;
  cargoCategory?: string | null;
  cargoLengthCm?: number | null;
  cargoWidthCm?: number | null;
  cargoHeightCm?: number | null;
  cargoValueSom?: number | null;
  isFragile?: boolean;
  needsLoadingHelp?: boolean;
}

export interface AIAnalyzeResult {
  recommendedCargoType: CargoType;
  estimatedWeightKg: number;
  recommendedPriceSom: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  cargoDescription: string;
  routeNotes: string;
  loadingTips: string;
  riskLevel: "low" | "medium" | "high";
  provider: "gemini" | "z-ai" | "heuristic";
}

// Local price heuristic — used as the ultimate fallback.
// Now factors in ALL cargo manifest data: dimensions, value, fragility, category, loading help.
export function heuristicAnalyze(input: AIAnalyzeInput): AIAnalyzeResult {
  const base = 15000;
  const distance = Math.round(input.distanceKm * 2500);
  const cargoMult: Record<CargoType, number> = {
    pickup: 0.8,
    van: 1.0,
    truck_small: 1.3,
    truck_medium: 1.7,
    truck_large: 2.4,
  };
  const cargo = Math.round(base * (cargoMult[input.cargoType] - 1));
  const weight = input.weightKg > 0 ? Math.round(input.weightKg * 15) : 0;

  // Volume surcharge: if dimensions provided, compute volume in m³ and add surcharge
  let volumeSurcharge = 0;
  let volumeM3 = 0;
  if (input.cargoLengthCm && input.cargoWidthCm && input.cargoHeightCm) {
    volumeM3 = (input.cargoLengthCm * input.cargoWidthCm * input.cargoHeightCm) / 1_000_000;
    // Bulky cargo (over 2 m³) costs more to transport
    if (volumeM3 > 2) volumeSurcharge = Math.round(volumeM3 * 5000);
    else if (volumeM3 > 1) volumeSurcharge = Math.round(volumeM3 * 3000);
  }

  // Insurance surcharge: 0.5% of declared value (covers potential damage)
  const insuranceSurcharge = input.cargoValueSom
    ? Math.round(input.cargoValueSom * 0.005)
    : 0;

  // Fragile surcharge: +10% (requires extra care, slower driving)
  const fragileSurcharge = input.isFragile
    ? Math.round((base + distance + cargo + weight) * 0.10)
    : 0;

  // Loading help surcharge: flat 5000 so'm (driver assists with loading)
  const loadingHelpSurcharge = input.needsLoadingHelp ? 5000 : 0;

  // Category-based adjustments
  const categoryMult: Record<string, number> = {
    furniture: 1.15,    // bulky, needs care
    appliances: 1.10,   // heavy, fragile electronics
    construction: 0.95, // standard materials
    boxes: 1.00,        // standard
    vehicles: 1.25,     // special handling
    other: 1.00,
  };
  const categoryAdjustment = input.cargoCategory
    ? Math.round((base + cargo) * (categoryMult[input.cargoCategory] - 1))
    : 0;

  const priceSom = base + distance + cargo + weight + volumeSurcharge +
    insuranceSurcharge + fragileSurcharge + loadingHelpSurcharge + categoryAdjustment;
  const etaMin = Math.max(8, Math.round(input.distanceKm * 2.2 + 12));

  // Risk heuristic: long distance + heavy + fragile + high value = higher risk
  let riskScore = (input.distanceKm / 50) + (input.weightKg / 2000);
  if (input.isFragile) riskScore += 1;
  if (input.cargoValueSom && input.cargoValueSom > 5_000_000) riskScore += 1;
  if (volumeM3 > 3) riskScore += 0.5;
  const riskLevel: "low" | "medium" | "high" =
    riskScore > 3 ? "high" : riskScore > 1 ? "medium" : "low";

  // Build description from manifest
  const descParts: string[] = [];
  if (input.cargoTitle) descParts.push(input.cargoTitle);
  if (input.cargoCategory) descParts.push(`(${input.cargoCategory})`);
  if (input.weightKg > 0) descParts.push(`${input.weightKg} kg`);
  if (volumeM3 > 0) descParts.push(`${volumeM3.toFixed(2)} m³`);
  if (input.isFragile) descParts.push("fragile");
  if (input.needsLoadingHelp) descParts.push("loading help");
  const cargoDescription = descParts.length > 0
    ? descParts.join(", ")
    : `Cargo: ${input.cargoType}, ${input.weightKg} kg`;

  // Route notes
  const routeNotes = `${input.distanceKm.toFixed(1)} km, ~${etaMin} min${input.isFragile ? ", careful driving required" : ""}`;

  // Loading tips based on cargo properties
  const tips: string[] = [];
  if (input.isFragile) tips.push("Use protective wrapping and secure with soft straps");
  if (input.cargoValueSom && input.cargoValueSom > 5_000_000) tips.push("High-value cargo — photograph before loading");
  if (volumeM3 > 2) tips.push("Bulky cargo — use entire cargo area, distribute weight evenly");
  if (input.needsLoadingHelp) tips.push("Customer requested loading assistance");
  if (tips.length === 0) tips.push("Secure cargo properly and check fastening before departure");
  const loadingTips = tips.join(". ");

  return {
    recommendedCargoType: input.cargoType,
    estimatedWeightKg: input.weightKg || 100,
    recommendedPriceSom: priceSom,
    priceRangeLow: Math.round(priceSom * 0.9),
    priceRangeHigh: Math.round(priceSom * 1.15),
    cargoDescription,
    routeNotes,
    loadingTips,
    riskLevel,
    provider: "heuristic",
  };
}

// Gemini call — supports optional photo (vision).
async function callGemini(input: AIAnalyzeInput): Promise<AIAnalyzeResult | null> {
  if (!GEMINI_API_KEY) return null;

  const langName = { uz: "Uzbek (O'zbekcha)", ru: "Russian (Русский)", en: "English" }[input.lang ?? "uz"];

  const sysPrompt = `You are a cargo logistics expert for Uzbekistan (YukTaxi service).
Analyze the cargo delivery request and respond in STRICT JSON only (no markdown, no prose).
Use these exact field names and types:

{
  "recommendedCargoType": "pickup" | "van" | "truck_small" | "truck_medium" | "truck_large",
  "estimatedWeightKg": number (positive integer),
  "recommendedPriceSom": number (positive integer, in Uzbek so'm),
  "priceRangeLow": number,
  "priceRangeHigh": number,
  "cargoDescription": string (1-2 sentences in ${langName}, describing what's likely being shipped),
  "routeNotes": string (1-2 sentences in ${langName}, route/traffic/distance observations),
  "loadingTips": string (1-2 sentences in ${langName}, how to safely load/secure),
  "riskLevel": "low" | "medium" | "high"
}

Pricing context: base 15000 so'm + 2500/km + cargo multiplier (pickup 0.8, van 1.0, truck_small 1.3, truck_medium 1.7, truck_large 2.4) + 15/kg.
If a photo is provided, identify the cargo from the image and refine the recommendation.
ALL human-readable text fields (cargoDescription, routeNotes, loadingTips) MUST be in ${langName}.`;

  const userText = `Delivery request:
- Distance: ${input.distanceKm.toFixed(1)} km
- Pickup: ${input.pickupAddress}
- Dropoff: ${input.dropoffAddress}
- Declared cargo type: ${input.cargoType}
- Declared weight: ${input.weightKg} kg
- Cargo title: ${input.cargoTitle || "(not specified)"}
- Cargo description: ${input.cargoDescription || "(none)"}
- Cargo category: ${input.cargoCategory || "(none)"}
- Dimensions (L×W×H cm): ${input.cargoLengthCm || "?"} × ${input.cargoWidthCm || "?"} × ${input.cargoHeightCm || "?"}
- Declared value: ${input.cargoValueSom ? input.cargoValueSom + " so'm" : "(not declared)"}
- Fragile: ${input.isFragile ? "YES" : "no"}
- Loading help needed: ${input.needsLoadingHelp ? "YES" : "no"}
- Note: ${input.note || "(none)"}

Calculate the price considering ALL factors:
1. Base (15000) + distance (2500/km) + cargo type multiplier + weight (15/kg)
2. Volume surcharge for bulky cargo (over 1 m³)
3. Insurance: 0.5% of declared value
4. Fragile surcharge: +10% if fragile
5. Loading help: +5000 if help needed
6. Category adjustments (furniture +15%, appliances +10%, vehicles +25%)

Return JSON only.`;

  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
    { text: sysPrompt },
    { text: userText },
  ];

  if (input.photoDataUrl) {
    // Parse data URL: "data:image/jpeg;base64,...."
    const m = input.photoDataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (m) {
      parts.push({
        inline_data: { mime_type: m[1], data: m[2] },
      });
    }
  }

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
      // Don't hang forever.
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[ai] Gemini error", res.status, errText.slice(0, 200));
      return null;
    }

    const data = await res.json();
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    // Gemini with responseMimeType=application/json returns clean JSON.
    // But just in case, strip markdown fences.
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const validTypes: CargoType[] = ["pickup", "van", "truck_small", "truck_medium", "truck_large"];
    const cargo = validTypes.includes(parsed.recommendedCargoType)
      ? parsed.recommendedCargoType
      : input.cargoType;

    return {
      recommendedCargoType: cargo,
      estimatedWeightKg: Math.max(1, Math.round(Number(parsed.estimatedWeightKg) || input.weightKg || 100)),
      recommendedPriceSom: Math.max(10000, Math.round(Number(parsed.recommendedPriceSom) || 0)),
      priceRangeLow: Math.max(5000, Math.round(Number(parsed.priceRangeLow) || 0)),
      priceRangeHigh: Math.max(10000, Math.round(Number(parsed.priceRangeHigh) || 0)),
      cargoDescription: String(parsed.cargoDescription || "").slice(0, 400),
      routeNotes: String(parsed.routeNotes || "").slice(0, 400),
      loadingTips: String(parsed.loadingTips || "").slice(0, 400),
      riskLevel: ["low", "medium", "high"].includes(parsed.riskLevel) ? parsed.riskLevel : "low",
      provider: "gemini",
    };
  } catch (e) {
    console.warn("[ai] Gemini call failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// z-ai-web-dev-sdk fallback (text-only — no vision support across providers).
async function callZai(input: AIAnalyzeInput): Promise<AIAnalyzeResult | null> {
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const langName = { uz: "Uzbek (O'zbekcha)", ru: "Russian (Русский)", en: "English" }[input.lang ?? "uz"];

    const sysPrompt = `You are a cargo logistics expert for Uzbekistan (YukTaxi). Respond in STRICT JSON only — no markdown, no prose. Use exactly these fields:

{"recommendedCargoType":"pickup|van|truck_small|truck_medium|truck_large","estimatedWeightKg":number,"recommendedPriceSom":number,"priceRangeLow":number,"priceRangeHigh":number,"cargoDescription":"string in ${langName}","routeNotes":"string in ${langName}","loadingTips":"string in ${langName}","riskLevel":"low|medium|high"}

Pricing: base 15000 so'm + 2500/km + cargo multiplier (pickup 0.8, van 1.0, truck_small 1.3, truck_medium 1.7, truck_large 2.4) + 15/kg.
ALL text fields (cargoDescription, routeNotes, loadingTips) MUST be in ${langName}.`;

    const userText = `Distance ${input.distanceKm.toFixed(1)} km, cargo ${input.cargoType}, weight ${input.weightKg} kg, pickup ${input.pickupAddress}, dropoff ${input.dropoffAddress}, note ${input.note || "none"}.`;

    const r = await zai.chat.completions.create({
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userText },
      ],
      temperature: 0.4,
      max_tokens: 1024,
    });

    const text: string | undefined = r.choices?.[0]?.message?.content;
    if (!text) return null;

    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const validTypes: CargoType[] = ["pickup", "van", "truck_small", "truck_medium", "truck_large"];
    const cargo = validTypes.includes(parsed.recommendedCargoType)
      ? parsed.recommendedCargoType
      : input.cargoType;

    return {
      recommendedCargoType: cargo,
      estimatedWeightKg: Math.max(1, Math.round(Number(parsed.estimatedWeightKg) || input.weightKg || 100)),
      recommendedPriceSom: Math.max(10000, Math.round(Number(parsed.recommendedPriceSom) || 0)),
      priceRangeLow: Math.max(5000, Math.round(Number(parsed.priceRangeLow) || 0)),
      priceRangeHigh: Math.max(10000, Math.round(Number(parsed.priceRangeHigh) || 0)),
      cargoDescription: String(parsed.cargoDescription || "").slice(0, 400),
      routeNotes: String(parsed.routeNotes || "").slice(0, 400),
      loadingTips: String(parsed.loadingTips || "").slice(0, 400),
      riskLevel: ["low", "medium", "high"].includes(parsed.riskLevel) ? parsed.riskLevel : "low",
      provider: "z-ai",
    };
  } catch (e) {
    console.warn("[ai] z-ai fallback failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function analyzeCargo(input: AIAnalyzeInput): Promise<AIAnalyzeResult> {
  // 1) Try Gemini (supports vision if photo provided)
  const gem = await callGemini(input);
  if (gem) return gem;

  // 2) Fall back to z-ai-web-dev-sdk
  const zai = await callZai(input);
  if (zai) return zai;

  // 3) Ultimate fallback: deterministic heuristic
  return heuristicAnalyze(input);
}
