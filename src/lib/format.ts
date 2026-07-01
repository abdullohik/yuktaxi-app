// Currency + date + misc formatting helpers
type Lang = "uz" | "ru" | "en";

const UNIT_DICT: Record<Lang, { som: string; min: string; hr: string }> = {
  uz: { som: "so\u02bcm", min: "daq", hr: "soat" },
  ru: { som: "сум", min: "мин", hr: "ч" },
  en: { som: "sum", min: "min", hr: "h" },
};

export function formatSom(amount: number, lang: Lang = "uz"): string {
  // "1 250 000 so'm" — Uzbek thousand separator (space)
  return new Intl.NumberFormat("ru-RU").format(Math.round(amount)) + " " + UNIT_DICT[lang].som;
}

export function formatSomShort(amount: number): string {
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1) + " mln";
  }
  if (amount >= 1000) {
    return Math.round(amount / 1000) + " ming";
  }
  return String(amount);
}

export function formatKm(km: number): string {
  if (km < 1) return Math.round(km * 1000) + " m";
  return km.toFixed(1) + " km";
}

export function formatMin(min: number, lang: Lang = "uz"): string {
  if (min < 60) return Math.round(min) + " " + UNIT_DICT[lang].min;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h} ${UNIT_DICT[lang].hr}` : `${h} ${UNIT_DICT[lang].hr} ${m} ${UNIT_DICT[lang].min}`;
}

export function formatPhone(phone: string): string {
  // +998 90 123 45 67
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 12) return phone;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
}

export function timeAgo(iso: string, lang: "uz" | "ru" | "en" = "uz"): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const dict = {
    uz: { now: "hozir", min: "daq", hr: "soat", day: "kun", ago: "oldin" },
    ru: { now: "сейчас", min: "мин", hr: "ч", day: "дн", ago: "назад" },
    en: { now: "now", min: "min", hr: "h", day: "d", ago: "ago" },
  }[lang];
  if (min < 1) return dict.now;
  if (min < 60) return `${min} ${dict.min} ${dict.ago}`;
  if (hr < 24) return `${hr} ${dict.hr} ${dict.ago}`;
  return `${day} ${dict.day} ${dict.ago}`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string, lang: "uz" | "ru" | "en" = "uz"): string {
  const locale = { uz: "ru-RU", ru: "ru-RU", en: "en-US" }[lang];
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
