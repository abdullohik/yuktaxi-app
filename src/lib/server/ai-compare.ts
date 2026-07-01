// AI comparison between customer-submitted photos and driver-submitted 4-side photos.
//
// Gemini call supports up to N inline images in a single generateContent request.
// We send all customer photos + all driver photos and ask it to:
//   1. Determine if they show the same item (matchPercentage 0-100)
//   2. Assess the cargo condition (conditionPercentage 0-100)
//   3. Describe what was observed
//   4. Note any damage
//   5. Recommend an action (OK_TO_PROCEED | INSPECT_WITH_CUSTOMER | REFUSE_PICKUP)
//
// Returns null on any failure — the route handler falls back to a heuristic.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface ComparePhoto {
  id: string;
  dataUrl: string;
  side?: string | null;
}

export interface CompareInput {
  customerPhotos: ComparePhoto[];
  driverPhotos: ComparePhoto[];
  cargoTitle?: string;
  cargoDescription?: string;
  cargoCategory?: string;
  lang: "uz" | "ru" | "en";
}

export interface CompareResult {
  matchPercentage: number;       // 0-100
  conditionPercentage: number;   // 0-100
  observedItem: string;
  damageNotes: string | null;
  recommendation: "OK_TO_PROCEED" | "INSPECT_WITH_CUSTOMER" | "REFUSE_PICKUP";
  provider: "gemini" | "z-ai" | "heuristic";
}

export async function callGeminiCompare(input: CompareInput): Promise<CompareResult | null> {
  if (!GEMINI_API_KEY) return null;

  const langName = { uz: "Uzbek (O'zbekcha)", ru: "Russian (Русский)", en: "English" }[input.lang];

  const sysPrompt = `You are a cargo logistics AI inspector. The driver has photographed the cargo from 4 sides (FRONT, BACK, LEFT, RIGHT) before picking it up. The customer also submitted photos when placing the order.

Your job:
1. Compare the customer photos with the driver's 4-side photos — are they showing the SAME item? Output matchPercentage 0-100 (100 = definitely the same item).
2. Assess the cargo condition — output conditionPercentage 0-100 (100 = perfect condition, no damage).
3. Briefly describe the observed item in ${langName}.
4. Note any visible damage in ${langName} (or null if none).
5. Recommend an action:
   - "OK_TO_PROCEED" — match ≥ 70% and condition ≥ 60%
   - "INSPECT_WITH_CUSTOMER" — match 40-70% or condition 30-60%
   - "REFUSE_PICKUP" — match < 40% or condition < 30%

Respond in STRICT JSON only — no markdown, no prose. Use exactly these fields:
{
  "matchPercentage": number,
  "conditionPercentage": number,
  "observedItem": "string in ${langName}",
  "damageNotes": "string in ${langName} or null",
  "recommendation": "OK_TO_PROCEED" | "INSPECT_WITH_CUSTOMER" | "REFUSE_PICKUP"
}

The first image set is from the CUSTOMER (taken when ordering).
The second image set is from the DRIVER (taken at pickup, labeled with side: FRONT/BACK/LEFT/RIGHT).
${input.cargoTitle ? `Customer declared cargo title: ${input.cargoTitle}` : ""}
${input.cargoDescription ? `Customer declared description: ${input.cargoDescription}` : ""}
${input.cargoCategory ? `Customer declared category: ${input.cargoCategory}` : ""}`;

  // Build parts: system prompt + customer photos + driver photos
  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
    { text: sysPrompt },
  ];

  // Add a marker before customer photos
  parts.push({ text: "=== CUSTOMER PHOTOS (taken when ordering) ===" });
  for (const cp of input.customerPhotos.slice(0, 4)) {
    const m = cp.dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (m) {
      parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
    }
  }

  // Add a marker before driver photos
  parts.push({ text: "=== DRIVER PHOTOS (taken at pickup, 4 sides) ===" });
  for (const dp of input.driverPhotos.slice(0, 4)) {
    const m = dp.dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (m) {
      parts.push({ text: `Side: ${dp.side ?? "UNKNOWN"}` });
      parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
    }
  }

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[ai-compare] Gemini error", res.status, errText.slice(0, 200));
      return null;
    }

    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const matchPct = Math.max(0, Math.min(100, Math.round(Number(parsed.matchPercentage) || 0)));
    const condPct = Math.max(0, Math.min(100, Math.round(Number(parsed.conditionPercentage) || 0)));
    const validRecs = ["OK_TO_PROCEED", "INSPECT_WITH_CUSTOMER", "REFUSE_PICKUP"];
    const recommendation = validRecs.includes(parsed.recommendation)
      ? parsed.recommendation
      : (matchPct >= 70 && condPct >= 60
        ? "OK_TO_PROCEED"
        : matchPct < 40 || condPct < 30
        ? "REFUSE_PICKUP"
        : "INSPECT_WITH_CUSTOMER");

    return {
      matchPercentage: matchPct,
      conditionPercentage: condPct,
      observedItem: String(parsed.observedItem || "").slice(0, 500),
      damageNotes: parsed.damageNotes ? String(parsed.damageNotes).slice(0, 500) : null,
      recommendation: recommendation as CompareResult["recommendation"],
      provider: "gemini",
    };
  } catch (e) {
    console.warn("[ai-compare] Gemini call failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
