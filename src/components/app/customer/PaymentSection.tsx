"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Plus, ChevronRight, Trash2, Star } from "lucide-react";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import type { Language } from "@/lib/types";

interface SavedCard {
  id: string;
  userPhone: string;
  label: string | null;
  cardLast4: string;
  cardBrand: string;
  cardHolderName: string | null;
  isDefault: boolean;
  createdAt: string;
}

// ---- Brand config ----
const BRAND_META: Record<string, { name: string; gradient: string; chipColor: string; textColor: string }> = {
  uzcard: {
    name: "UZCARD",
    gradient: "from-emerald-500 to-teal-600",
    chipColor: "bg-amber-400",
    textColor: "text-emerald-700 dark:text-emerald-300",
  },
  humo: {
    name: "HUMO",
    gradient: "from-violet-500 to-purple-600",
    chipColor: "bg-yellow-300",
    textColor: "text-violet-700 dark:text-violet-300",
  },
  visa: {
    name: "VISA",
    gradient: "from-slate-700 to-slate-900",
    chipColor: "bg-amber-400",
    textColor: "text-slate-700 dark:text-slate-200",
  },
  mastercard: {
    name: "MC",
    gradient: "from-rose-600 to-orange-500",
    chipColor: "bg-amber-300",
    textColor: "text-rose-700 dark:text-rose-300",
  },
  unknown: {
    name: "CARD",
    gradient: "from-gray-500 to-gray-700",
    chipColor: "bg-gray-400",
    textColor: "text-gray-600 dark:text-gray-300",
  },
};

function brandMeta(brand: string) {
  return BRAND_META[brand] ?? BRAND_META.unknown;
}

// ---- Mini card chip (EMV style) ----
function MiniCardChip({ brand }: { brand: string }) {
  const meta = brandMeta(brand);
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br shadow-md shadow-black/10">
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-100`} />
      {/* EMV chip */}
      <div className="relative flex flex-col items-center">
        <div className={`h-[7px] w-[11px] rounded-[2px] ${meta.chipColor} ring-[0.5px] ring-black/20`} />
        <div className={`mt-[1px] h-[5px] w-[11px] rounded-[1px] ${meta.chipColor}/70`} />
      </div>
      {/* Brand label */}
      <span className="absolute bottom-[1px] right-[3px] text-[5px] font-black tracking-wider text-white/90 uppercase leading-none">
        {meta.name}
      </span>
    </div>
  );
}

// ---- Premium bank card in sheet ----
function PremiumCard({ card, language }: { card: SavedCard; language: Language }) {
  const meta = brandMeta(card.cardBrand);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${meta.gradient} p-5 text-white shadow-lg`}
    >
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />

      {/* EMV Chip */}
      <div className="relative mb-6 flex items-center gap-1">
        <div className="h-[14px] w-[20px] rounded-[3px] bg-amber-400/90 ring-[1px] ring-black/15" />
        <div className="h-[10px] w-[20px] rounded-[2px] bg-amber-400/60" />
      </div>

      {/* Card number dots + last 4 */}
      <div className="relative mb-5 flex items-center gap-2 text-[18px] font-mono tracking-[3px]">
        <span className="opacity-60">•••• •••• ••••</span>
        <span className="font-bold">{card.cardLast4}</span>
      </div>

      {/* Bottom row */}
      <div className="relative flex items-end justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-white/50">{t(language, "cardHolderName")}</div>
          <div className="mt-0.5 text-[14px] font-semibold tracking-wide">
            {card.cardHolderName || "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-black tracking-wider">{meta.name}</div>
        </div>
      </div>

      {/* Default badge */}
      {card.isDefault && (
        <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold backdrop-blur">
          <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
          {t(language, "defaultCard")}
        </div>
      )}
    </motion.div>
  );
}

// ---- Main component ----
export function PaymentSection() {
  const { language, user } = useApp();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchCards = useCallback(async () => {
    if (!user?.phone) return;
    try {
      const res = await api<{ ok: boolean; data: SavedCard[] }>(`/api/cards?phone=${user.phone}`);
      setCards(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user?.phone]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const defaultCard = cards.find((c) => c.isDefault) ?? cards[0];
  const meta = defaultCard ? brandMeta(defaultCard.cardBrand) : null;

  async function saveCard(pan: string, holderName: string, label: string) {
    if (!user?.phone) return;
    setSaving(true);
    try {
      await api("/api/cards", {
        method: "POST",
        body: JSON.stringify({ phone: user.phone, cardNumber: pan, cardHolderName: holderName, label }),
      });
      toast.success(t(language, "cardSaved"));
      fetchCards();
    } catch {
      toast.error(t(language, "saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteCard(id: string) {
    if (!user?.phone) return;
    try {
      await api(`/api/cards?id=${id}&phone=${user.phone}`, { method: "DELETE" });
      toast.success(t(language, "cardDeleted"));
      fetchCards();
    } catch {
      toast.error(t(language, "saveFailed"));
    }
  }

  async function setDefault(id: string) {
    if (!user?.phone) return;
    try {
      await api(`/api/cards/default?id=${id}&phone=${user.phone}`, { method: "PATCH" });
      fetchCards();
    } catch {
      toast.error(t(language, "saveFailed"));
    }
  }

  return (
    <>
      {/* Profile row — matches "member since" exactly */}
      <motion.button
        onClick={() => setSheetOpen(true)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: "easeOut" }}
        whileTap={{ scale: 0.98 }}
        className="flex w-full items-center gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-border/60 text-left transition hover:shadow-sm active:shadow-none"
      >
        {defaultCard ? (
          <>
            <MiniCardChip brand={defaultCard.cardBrand} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-muted-foreground">
                {t(language, "paymentMethod")}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[15px] font-bold ${meta?.textColor ?? "text-foreground"}`}>
                  {brandMeta(defaultCard.cardBrand).name}
                </span>
                <span className="text-[15px] font-semibold text-foreground">
                  •••• {defaultCard.cardLast4}
                </span>
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-muted-foreground" />
          </>
        ) : (
          <>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-foreground">
                {t(language, "paymentMethod")}
              </div>
              <div className="text-[13px] text-muted-foreground">
                {t(language, "noSavedCards")}
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-muted-foreground" />
          </>
        )}
      </motion.button>

      {/* Bottom sheet: card management */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="px-5 pt-5 pb-3">
            <SheetTitle className="text-lg font-bold">{t(language, "myCards")}</SheetTitle>
            <SheetDescription className="text-[14px] text-muted-foreground">
              {t(language, "savedCards")}
            </SheetDescription>
          </SheetHeader>

          <div className="max-h-[60vh] overflow-y-auto px-5 pb-8">
            {/* Existing cards */}
            <AnimatePresence mode="popLayout">
              {cards.length === 0 && !loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-8 text-center text-[14px] text-muted-foreground"
                >
                  <CreditCard className="mx-auto mb-2 h-10 w-10 opacity-30" />
                  {t(language, "noSavedCards")}
                </motion.div>
              )}

              {cards.map((card, i) => (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -60, transition: { duration: 0.2 } }}
                  transition={{ delay: i * 0.06, duration: 0.3, ease: "easeOut" }}
                  className="mb-4"
                >
                  <PremiumCard card={card} language={language} />

                  {/* Card actions */}
                  <div className="mt-2 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      {card.isDefault ? (
                        <span className="flex items-center gap-1 text-[12px] font-semibold text-primary">
                          <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                          {t(language, "defaultCard")}
                        </span>
                      ) : (
                        <button
                          onClick={() => setDefault(card.id)}
                          className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition hover:text-primary"
                        >
                          <Star className="h-3.5 w-3.5" />
                          {t(language, "setAsDefault")}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => deleteCard(card.id)}
                      className="flex items-center gap-1 text-[12px] font-medium text-destructive/70 transition hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t(language, "delete")}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Add new card form */}
            <div className="mt-4 rounded-2xl bg-muted/50 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-foreground">
                <Plus className="h-4 w-4 text-primary" />
                {t(language, "addNewCard")}
              </h4>
              <AddCardForm onSave={saveCard} language={language} saving={saving} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ---- Add card form ----
function AddCardForm({
  onSave,
  language,
  saving,
}: {
  onSave: (pan: string, holderName: string, label: string) => void;
  language: Language;
  saving: boolean;
}) {
  const [pan, setPan] = useState("");
  const [holder, setHolder] = useState("");
  const [label, setLabel] = useState("");

  // Format card number with spaces every 4 digits
  function formatPan(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 19);
    return d.replace(/(\d{4})(?=\d)/g, "$1 ");
  }

  // Detect brand live from input
  const rawDigits = pan.replace(/\s/g, "");
  let liveBrand = "unknown";
  if (rawDigits.startsWith("8600") || rawDigits.startsWith("8601") || rawDigits.startsWith("8602")) liveBrand = "uzcard";
  else if (rawDigits.startsWith("9060") || rawDigits.startsWith("9061")) liveBrand = "humo";
  else if (rawDigits.startsWith("4")) liveBrand = "visa";
  else {
    const f2 = parseInt(rawDigits.slice(0, 2), 10);
    if ((f2 >= 51 && f2 <= 55) || (f2 >= 22 && f2 <= 27)) liveBrand = "mastercard";
  }
  const liveMeta = brandMeta(liveBrand);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const d = pan.replace(/\s/g, "");
    if (d.length < 16) return;
    onSave(d, holder.trim(), label.trim());
    setPan("");
    setHolder("");
    setLabel("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Card number input */}
      <div>
        <label className="mb-1 block text-[12px] font-medium text-muted-foreground">
          {t(language, "enterCardNumber")}
        </label>
        <div className="relative">
          <input
            value={pan}
            onChange={(e) => setPan(formatPan(e.target.value))}
            placeholder="8600 0000 0000 0000"
            inputMode="numeric"
            className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-20 text-[16px] font-mono font-semibold tracking-wider text-foreground outline-none transition focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {rawDigits.length >= 1 && (
            <motion.span
              key={liveBrand}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-gradient-to-r ${liveMeta.gradient} px-2 py-0.5 text-[10px] font-black tracking-wider text-white`}
            >
              {liveMeta.name}
            </motion.span>
          )}
        </div>
      </div>

      {/* Holder name */}
      <div>
        <label className="mb-1 block text-[12px] font-medium text-muted-foreground">
          {t(language, "cardHolderName")}
        </label>
        <input
          value={holder}
          onChange={(e) => setHolder(e.target.value.toUpperCase())}
          placeholder="ALIYEV ALISHER"
          className="h-12 w-full rounded-xl border border-border bg-background px-4 text-[15px] font-semibold tracking-wide text-foreground uppercase outline-none transition focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* Label (optional) */}
      <div>
        <label className="mb-1 block text-[12px] font-medium text-muted-foreground">
          {t(language, "cardLabel")}
        </label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Mening kartam"
          className="h-12 w-full rounded-xl border border-border bg-background px-4 text-[15px] text-foreground outline-none transition focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      <button
        type="submit"
        disabled={rawDigits.length < 16 || saving}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-40"
      >
        {saving ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
        ) : (
          <>
            <Plus className="h-4.5 w-4.5" />
            {t(language, "addCard")}
          </>
        )}
      </button>
    </form>
  );
}