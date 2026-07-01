import { NextRequest, NextResponse } from "next/server";
import {
  checkSendRate,
  generateOtp,
  otpCodes,
  OTP_TTL_MS,
  isLocked,
} from "@/lib/server/otp-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone ?? "").trim();

    if (!/^998\d{9}$/.test(phone)) {
      return NextResponse.json(
        { ok: false, error: "Telefon raqam noto'g'ri formatda" },
        { status: 400 }
      );
    }

    if (isLocked(phone)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring.",
        },
        { status: 429 }
      );
    }

    const rate = checkSendRate(phone);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Rate limit: 15 daqiqada 5 marta. Keyinroq urinib ko'ring.",
        },
        { status: 429 }
      );
    }

    const code = generateOtp();
    otpCodes.set(phone, {
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
      lockedUntil: 0,
    });

    // Send SMS via Eskiz.uz (or dev fallback)
    const { sendSmsOtp } = await import("@/lib/sms");
    const smsResult = await sendSmsOtp("+" + phone, code);

    return NextResponse.json({
      ok: true,
      data: { sent: smsResult.sent, devCode: smsResult.devCode },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
