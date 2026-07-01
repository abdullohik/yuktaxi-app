// In-memory OTP store + rate limiter.
// Uses globalThis to survive Next.js hot-reload in dev mode.

const OTP_KEY = "__yuktaxi_otp__";
const RATE_KEY = "__yuktaxi_rate__";

export interface OtpRecord {
  code: string;
  expiresAt: number; // ms epoch
  attempts: number; // failed verify attempts
  lockedUntil: number; // ms epoch; 0 if not locked
}

// phone -> OtpRecord
const _otpCodes = (): Map<string, OtpRecord> => {
  if (!(globalThis as Record<string, unknown>)[OTP_KEY]) {
    (globalThis as Record<string, unknown>)[OTP_KEY] = new Map<string, OtpRecord>();
  }
  return (globalThis as Record<string, unknown>)[OTP_KEY] as Map<string, OtpRecord>;
};
export const otpCodes = new Proxy({} as Map<string, OtpRecord>, {
  get(_target, prop, receiver) {
    const map = _otpCodes();
    const val = Reflect.get(map, prop, receiver);
    if (typeof val === "function") return val.bind(map);
    return val;
  },
});

// phone -> { windowStart, count }
interface RateBucket {
  windowStart: number;
  count: number;
}
const _rateBuckets = (): Map<string, RateBucket> => {
  if (!(globalThis as Record<string, unknown>)[RATE_KEY]) {
    (globalThis as Record<string, unknown>)[RATE_KEY] = new Map<string, RateBucket>();
  }
  return (globalThis as Record<string, unknown>)[RATE_KEY] as Map<string, RateBucket>;
};
export const otpSendBuckets = new Proxy({} as Map<string, RateBucket>, {
  get(_target, prop, receiver) {
    const map = _rateBuckets();
    const val = Reflect.get(map, prop, receiver);
    if (typeof val === "function") return val.bind(map);
    return val;
  },
});

export const OTP_RATE_LIMIT = 10; // per window (generous for dev)
export const OTP_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 min
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 min (longer for demo)
export const OTP_LOCK_MS = 15 * 60 * 1000; // 15 min lock after too many fails
export const OTP_MAX_ATTEMPTS = 10; // generous for demo

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Returns remaining count in the current window. Resets the window if expired. */
export function checkSendRate(phone: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = otpSendBuckets.get(phone);
  if (!bucket || now - bucket.windowStart > OTP_RATE_WINDOW_MS) {
    otpSendBuckets.set(phone, { windowStart: now, count: 1 });
    return { allowed: true, remaining: OTP_RATE_LIMIT - 1 };
  }
  if (bucket.count >= OTP_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  bucket.count += 1;
  return { allowed: true, remaining: OTP_RATE_LIMIT - bucket.count };
}

export function isLocked(phone: string): boolean {
  const rec = otpCodes.get(phone);
  if (!rec) return false;
  // Auto-unlock if lock has expired
  if (rec.lockedUntil > 0 && rec.lockedUntil < Date.now()) {
    rec.lockedUntil = 0;
    rec.attempts = 0;
    return false;
  }
  return rec.lockedUntil > Date.now();
}

export function bumpAttempt(phone: string): void {
  const rec = otpCodes.get(phone);
  if (!rec) return;
  rec.attempts += 1;
  if (rec.attempts >= OTP_MAX_ATTEMPTS) {
    rec.lockedUntil = Date.now() + OTP_LOCK_MS;
  }
}

/** Validate an OTP code. Returns 'ok' | 'expired' | 'wrong' | 'locked' */
export function validateOtp(phone: string, code: string): "ok" | "expired" | "wrong" | "locked" {
  if (isLocked(phone)) return "locked";

  const rec = otpCodes.get(phone);
  if (!rec) return "expired";

  if (Date.now() > rec.expiresAt) return "expired";

  if (rec.code !== code) {
    bumpAttempt(phone);
    return "wrong";
  }

  return "ok";
}

/** Consume the OTP — delete on successful verify */
export function consumeOtp(phone: string): void {
  otpCodes.delete(phone);
}
