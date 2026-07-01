import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateOtp, consumeOtp, isLocked } from "@/lib/server/otp-store";
import type { Role } from "@/lib/types";

const VALID_ROLES = new Set<string>(["CUSTOMER", "DRIVER", "FLEET"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone ?? "").trim();
    const code = String(body?.code ?? "").trim();
    const clientRole = String(body?.role ?? "").trim().toUpperCase();

    if (!/^998\d{9}$/.test(phone)) {
      return NextResponse.json(
        { ok: false, error: "Telefon raqam noto'g'ri" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { ok: false, error: "Kod 6 xonali raqam bo'lishi kerak" },
        { status: 400 }
      );
    }

    // Validate the role if provided
    const role: Role = VALID_ROLES.has(clientRole) ? (clientRole as Role) : "CUSTOMER";

    // Demo mode: when no SMS provider is configured, accept any 6-digit code
    // This is needed for Vercel serverless where in-memory OTP store doesn't persist
    const isDemoMode = !process.env.ESKIZ_EMAIL;

    let result: "ok" | "expired" | "wrong" | "locked";
    if (isDemoMode) {
      result = "ok"; // accept any valid 6-digit code in demo mode
    } else {
      result = validateOtp(phone, code);
    }

    if (result === "locked") {
      return NextResponse.json(
        { ok: false, error: "Juda ko'p noto'g'ri urinish. 15 daqiqadan keyin qayta urinib ko'ring." },
        { status: 429 }
      );
    }

    if (result === "expired") {
      return NextResponse.json(
        { ok: false, error: "Kod muddati o'tib ketdi. Qayta yuborish tugmasini bosing." },
        { status: 400 }
      );
    }

    if (result === "wrong") {
      return NextResponse.json(
        { ok: false, error: "Noto'g'ri kod. Qayta urinib ko'ring." },
        { status: 400 }
      );
    }

    // result === "ok" — consume the OTP
    consumeOtp(phone);

    // Upsert user — use client role ONLY for new users.
    // For existing users, KEEP their persisted role (prevents role corruption across sessions).
    const existing = await db.user.findUnique({ where: { phone } });
    const isNew = !existing;

    let user;
    if (isNew) {
      user = await db.user.create({
        data: {
          phone,
          role,
          language: "uz",
        },
      });
    } else {
      // Keep the existing user's role — do NOT overwrite it.
      // The client `role` is only used for the create case above.
      user = existing;
    }

    // If role is DRIVER and no Driver row exists, create one
    if (role === "DRIVER") {
      const driver = await db.driver.findUnique({
        where: { userId: user.id },
      });
      if (!driver) {
        await db.driver.create({
          data: {
            userId: user.id,
            isOnline: false,
            rating: 5.0,
            totalTrips: 0,
            trustScore: 80,
            vehicleType: "truck_small",
            city: "Toshkent",
            balance: 0,
          },
        });
      }
    }

    const accessToken = `yuktaxi.${user.id}.${Date.now()}.${Math.random().toString(36).slice(2)}`;

    return NextResponse.json({
      ok: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role as "CUSTOMER" | "DRIVER" | "FLEET",
          language: user.language as "uz" | "ru" | "en",
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
        accessToken,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
