// Email verification store + helpers.
// In production, this would integrate with an SMTP service (SendGrid, Mailgun,
// AWS SES) to send real verification emails. For the demo, we store codes
// in-memory and surface them via the API response (devCode) so the user
// can see the code without a real email.

interface EmailVerificationRecord {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}

export const emailVerifications = new Map<string, EmailVerificationRecord>();

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

export function generateEmailCode(): string {
  // 6-digit code
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function checkEmailRateLimit(email: string): { allowed: boolean; remaining: number } {
  const rec = emailVerifications.get(email);
  const now = Date.now();
  if (!rec || now > rec.expiresAt) {
    return { allowed: true, remaining: EMAIL_CODE_MAX_ATTEMPTS };
  }
  if (rec.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: EMAIL_CODE_MAX_ATTEMPTS - rec.attempts };
}

export function isEmailVerified(email: string): boolean {
  const rec = emailVerifications.get(email);
  return !!rec && rec.verified;
}

export function verifyEmailCode(email: string, code: string): { valid: boolean; reason?: string } {
  const rec = emailVerifications.get(email);
  if (!rec) {
    return { valid: false, reason: "Kod yuborilmagan. Avval kod so'rang." };
  }
  if (rec.verified) {
    return { valid: true };
  }
  if (Date.now() > rec.expiresAt) {
    return { valid: false, reason: "Kod muddati o'tgan. Yangi kod so'rang." };
  }
  if (rec.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    return { valid: false, reason: "Juda ko'p urinish. Keyinroq urinib ko'ring." };
  }
  if (rec.code !== code) {
    rec.attempts += 1;
    const remaining = EMAIL_CODE_MAX_ATTEMPTS - rec.attempts;
    return {
      valid: false,
      reason: remaining > 0
        ? `Noto'g'ri kod. ${remaining} urinish qoldi.`
        : "Juda ko'p urinish. Keyinroq urinib ko'ring.",
    };
  }
  rec.verified = true;
  return { valid: true };
}
