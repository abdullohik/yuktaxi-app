import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/support/chat?phone=...
 * Returns support chat messages for a user.
 *
 * POST /api/support/chat
 * Body: { phone, text, role: "CUSTOMER" | "SUPPORT" }
 * Creates a support message. If role=CUSTOMER and no active conversation,
 * auto-creates a support agent response (mock AI auto-reply).
 */

interface SupportMessage {
  id: string;
  userPhone: string;
  role: "CUSTOMER" | "SUPPORT";
  text: string;
  createdAt: string;
}

// In-memory store for support messages (resets on hot reload — fine for demo).
// In production, this would be a Prisma model.
const supportMessages = new Map<string, SupportMessage[]>();

// Profanity filter — detects vulgar language in Uzbek, Russian, English.
const PROFANITY_WORDS = [
  "бля", "блядь", "хуй", "хуя", "хуё", "хуйня", "пизда", "пиздец", "пизд", "ебать", "ебан", "ёбан", "еба",
  "сука", "суки", "гандон", "гондон", "долбоёб", "долбоеб", "мудак", "мудила", "залупа", "залуп",
  "гавно", "говно", "дерьмо", "ссанина", "очко", "жопа", "задница", "пидор", "пидар", "пидр",
  "shit", "damn", "asshole", "bitch", "bastard", "dick", "cunt",
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return PROFANITY_WORDS.some((word) => lower.includes(word));
}

function profanityWarning(lang: "uz" | "ru" | "en"): string {
  const warnings = {
    uz: "Hurmatli foydalanuvchi, iltimos, so'kinish va haqoratli so'zlardan foydalanmang. Iltimos, savolingizni muloyim tarzda bering va biz sizga yordam berishdan mamnun bo'lamiz. 😊",
    ru: "Уважаемый пользователь, пожалуйста, воздержитесь от нецензурной лексики. Пожалуйста, задайте ваш вопрос вежливо, и мы с радостью вам поможем. 😊",
    en: "Dear user, please refrain from using profanity. Please ask your question politely and we will be happy to help. 😊",
  };
  return warnings[lang];
}

// Smart auto-reply with context awareness and emoji.
function getAutoReply(text: string, lang: "uz" | "ru" | "en" = "ru"): string {
  const lower = text.toLowerCase();

  // Greeting
  if (["привет","здравств","hello","hi","salom","добрый"].some(k => lower.includes(k))) {
    return lang === "uz" ? "Assalomu alaykum! YukTaxi yordam markaziga xush kelibsiz! 😊 Sizga qanday yordam bera olamiz?"
      : lang === "en" ? "Hello! Welcome to YukTaxi support! 😊 How can we help you?"
      : "Здравствуйте! Добро пожаловать в поддержку YukTaxi! 😊 Чем можем помочь?";
  }

  // Thanks
  if (["спасибо","рахмат","thank"].some(k => lower.includes(k))) {
    return lang === "uz" ? "Sizga yordam berganimizdan xursandmiz! Yana savollar bo'lsa, yozing. 😊"
      : lang === "en" ? "Glad we could help! Feel free to ask more. 😊"
      : "Рады были помочь! Если есть ещё вопросы, пишите. 😊";
  }

  // Price
  if (["цена","narx","price","сколько","cost","стоим"].some(k => lower.includes(k))) {
    return lang === "uz" ? "Narx masofa, yuk turi, og'irlik VA tafsilotlarga bog'liq. Baza 15 000 so'm + 2 500 so'm/km. AI avtomatik hisoblaydi. 📦"
      : lang === "en" ? "Price depends on distance, cargo type, weight AND details. Base 15 000 som + 2 500 som/km. AI calculates automatically. 📦"
      : "Цена зависит от расстояния, типа груза, веса И деталей. База 15 000 сум + 2 500 сум/км. ИИ рассчитает автоматически. 📦";
  }

  // Driver
  if (["водител","haydovchi","driver","когда","when","приедет"].some(k => lower.includes(k))) {
    return lang === "uz" ? "Haydovchi 5-15 daqiqada yetib boradi. Real vaqtda kuzatishingiz mumkin. 🚚"
      : lang === "en" ? "Driver arrives in 5-15 minutes. You can track in real-time. 🚚"
      : "Водитель прибывает за 5-15 минут. Можно отслеживать в реальном времени. 🚚";
  }

  // Payment
  if (["оплат","to'lov","payment","карт","karta","cash","налич","pay"].some(k => lower.includes(k))) {
    return lang === "uz" ? "To'lov: karta (Visa, MC, Uzcard, Humo) yoki naqd. 3D Secure himoyalangan. 💳"
      : lang === "en" ? "Payment: card (Visa, MC, Uzcard, Humo) or cash. 3D Secure protected. 💳"
      : "Оплата: картой (Visa, MC, Uzcard, Humo) или наличными. Защищено 3D Secure. 💳";
  }

  // Cancel
  if (["отмен","bekor","cancel"].some(k => lower.includes(k))) {
    return lang === "uz" ? "Bekor qilish: 'Buyurtmalar' → buyurtma → 'Bekor qilish'. ❌"
      : lang === "en" ? "Cancel: 'Orders' → order → 'Cancel'. ❌"
      : "Отмена: 'Заказы' → заказ → 'Отменить'. ❌";
  }

  // Photos
  if (["фото","rasm","photo","снимок","picture"].some(k => lower.includes(k))) {
    return lang === "uz" ? "Yuk rasmlari — holatni hujjatlashtirish uchun. Haydovchi 4 tomondan suratga oladi, AI solishtiradi. 📸"
      : lang === "en" ? "Cargo photos — to document condition. Driver takes 4-side photos, AI compares. 📸"
      : "Фото груза — для фиксации состояния. Водитель фотографирует с 4 сторон, ИИ сравнивает. 📸";
  }

  // AI
  if (["ии","ai","анализ","tahlil","analyze","искусствен"].some(k => lower.includes(k))) {
    return lang === "uz" ? "AI barcha parametrlarni hisobga olib narxni hisoblaydi: masofa, og'irlik, o'lchamlar, qadr, mo'rtlik. 🤖"
      : lang === "en" ? "AI calculates price considering all parameters: distance, weight, dimensions, value, fragility. 🤖"
      : "ИИ считает цену с учётом всех параметров: расстояние, вес, размеры, ценность, хрупкость. 🤖";
  }

  // Track
  if (["где","qayer","where","отслед","track","заказ","buyurtma"].some(k => lower.includes(k))) {
    return lang === "uz" ? "Buyurtmani kuzatish: 'Buyurtmalar' → faol buyurtma. Xaritada real vaqtda. 📍"
      : lang === "en" ? "Track order: 'Orders' → active order. Real-time on map. 📍"
      : "Отследить заказ: 'Заказы' → активный заказ. На карте в реальном времени. 📍";
  }

  // Registration
  if (["регистра","login","войти","kirim","kirish","account","аккаунт"].some(k => lower.includes(k))) {
    return lang === "uz" ? "Kirish: SMS OTP yoki mehmon. Telefon raqamingizga 6 xonali kod keladi. 🔐"
      : lang === "en" ? "Sign in: SMS OTP or guest. A 6-digit code is sent to your phone number. 🔐"
      : "Вход: SMS OTP или гость. 6-значный код отправляется на ваш номер телефона. 🔐";
  }

  // Default
  return lang === "uz" ? "Rahmat! 🙏 Operator tez orada javob beradi. Buyurtma berishingiz mumkin — AI narxni hisoblaydi."
    : lang === "en" ? "Thank you! 🙏 Operator will reply soon. You can place an order — AI calculates price."
    : "Спасибо! 🙏 Оператор скоро ответит. Можете оформить заказ — ИИ рассчитает цену.";
}

export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get("phone") ?? "";
    const lang = (req.nextUrl.searchParams.get("lang") ?? "ru") as "uz" | "ru" | "en";
    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "phone talab qilinadi" },
        { status: 400 }
      );
    }
    const messages = supportMessages.get(phone) ?? [];
    // If no messages yet, seed with a welcome message
    if (messages.length === 0) {
      const welcome: SupportMessage = {
        id: `support_welcome_${phone}`,
        userPhone: phone,
        role: "SUPPORT",
        text: lang === "uz"
          ? "Assalomu alaykum! YukTaxi yordam markaziga xush kelibsiz. Savollaringiz bormi?"
          : lang === "en"
          ? "Hello! Welcome to YukTaxi support center. How can we help you?"
          : "Здравствуйте! Добро пожаловать в центр поддержки YukTaxi. Чем можем помочь?",
        createdAt: new Date().toISOString(),
      };
      supportMessages.set(phone, [welcome]);
      return NextResponse.json({ ok: true, data: [welcome] });
    }
    return NextResponse.json({ ok: true, data: messages });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone ?? "").trim();
    const text = String(body?.text ?? "").trim();
    const role = String(body?.role ?? "CUSTOMER").toUpperCase() as "CUSTOMER" | "SUPPORT";
    const lang = (body?.lang ?? "ru") as "uz" | "ru" | "en";

    if (!phone || !text) {
      return NextResponse.json(
        { ok: false, error: "phone va text talab qilinadi" },
        { status: 400 }
      );
    }

    const userMessage: SupportMessage = {
      id: `support_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userPhone: phone,
      role,
      text,
      createdAt: new Date().toISOString(),
    };

    const list = supportMessages.get(phone) ?? [];
    list.push(userMessage);
    supportMessages.set(phone, list);

    // If customer sent a message, auto-reply with AI
    // Check for profanity first — if found, send a polite warning instead
    if (role === "CUSTOMER") {
      const replyText = containsProfanity(text)
        ? profanityWarning(lang)
        : getAutoReply(text, lang);
      const reply: SupportMessage = {
        id: `support_reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userPhone: phone,
        role: "SUPPORT",
        text: replyText,
        createdAt: new Date().toISOString(),
      };
      // Small delay to simulate agent typing
      await new Promise((resolve) => setTimeout(resolve, 800));
      list.push(reply);
      supportMessages.set(phone, list);
      return NextResponse.json({ ok: true, data: { userMessage, reply } });
    }

    return NextResponse.json({ ok: true, data: { userMessage } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server xatosi";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
