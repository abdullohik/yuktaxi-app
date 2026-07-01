// lib/sms.ts — Real Eskiz.uz SMS integration for production.
// In dev (no ESKIZ_EMAIL env), falls back to console.log so OTP still works.

let _token: string | null = null;
let _tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await fetch("https://notify.eskiz.uz/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.ESKIZ_EMAIL,
      password: process.env.ESKIZ_PASSWORD,
    }),
  });
  const d = await res.json();
  _token = d.data?.token;
  _tokenExpiry = Date.now() + 28 * 60 * 1000; // 28 min
  return _token!;
}

export async function sendSmsOtp(phone: string, code: string): Promise<{ sent: boolean; devCode?: string }> {
  // DEV: if no Eskiz credentials, log only and return the code for the UI
  if (!process.env.ESKIZ_EMAIL) {
    console.info(`[dev] OTP for ${phone}: ${code}`);
    return { sent: true, devCode: code };
  }

  try {
    const token = await getToken();
    const body = new FormData();
    body.append("mobile_phone", phone.replace("+", ""));
    body.append("message", `YukTaxi kirish kodi: ${code}. 5 daqiqa amal qiladi.`);
    body.append("from", "4546");
    const res = await fetch("https://notify.eskiz.uz/api/message/sms/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const d = await res.json();
    return { sent: d.success === true || res.ok };
  } catch (e) {
    console.error("[sms] Eskiz error:", e);
    return { sent: false };
  }
}
