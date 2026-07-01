"use client";

import { useState, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Lock, Loader2, Check, X, ShieldCheck, AlertCircle, Wallet,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { formatSom } from "@/lib/format";
import type { Payment } from "@/lib/types";

interface CardPaymentProps {
  orderId: string;
  amount: number;
  onPaid: (payment: Payment) => void;
  onClose: () => void;
}

type PayMethod = "CARD" | "CASH";

// Brand detection (same as backend, for live preview)
function detectBrand(num: string): "visa" | "mastercard" | "uzcard" | "humo" | "unknown" {
  const n = num.replace(/\D/g, "");
  if (/^8600/.test(n)) return "uzcard";
  if (/^9060/.test(n)) return "humo";
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "mastercard";
  return "unknown";
}

function formatCardNumber(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExp(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + "/" + digits.slice(2);
}

export function CardPayment({ orderId, amount, onPaid, onClose }: CardPaymentProps) {
  const { language } = useApp();
  const [method, setMethod] = useState<PayMethod>("CARD");

  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCvv] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [processing, setProcessing] = useState(false);

  const brand = detectBrand(cardNumber);
  const cardValid = cardNumber.replace(/\D/g, "").length >= 16;
  const expValid = /^\d{2}\/\d{2}$/.test(cardExp);
  const cvvValid = /^\d{3,4}$/.test(cardCvv);
  const holderValid = cardHolder.trim().length >= 3;
  const formValid = cardValid && expValid && cvvValid && holderValid;

  async function pay() {
    if (method === "CASH") {
      // CASH: just record the choice, no card processing
      setProcessing(true);
      try {
        const r = await api<{ ok: boolean; data: Payment; error?: string }>("/api/payments/charge", {
          method: "POST",
          body: JSON.stringify({ orderId, method: "CASH", amount }),
        });
        if (!r.ok) throw new Error(r.error || t(language, "paymentFailed"));
        toast.success(t(language, "cashOnDelivery"));
        onPaid(r.data);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t(language, "paymentFailed"));
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (!formValid) {
      toast.error(t(language, "cardDetailsInvalid"));
      return;
    }

    setProcessing(true);
    try {
      const r = await api<{ ok: boolean; data: Payment; error?: string }>("/api/payments/charge", {
        method: "POST",
        body: JSON.stringify({
          orderId,
          method: "CARD",
          amount,
          cardNumber: cardNumber.replace(/\D/g, ""),
          cardExp,
          cardCvv,
          cardHolderName: cardHolder.trim().toUpperCase(),
        }),
      });
      if (!r.ok) throw new Error(r.error || t(language, "paymentFailed"));
      toast.success(t(language, "paymentSuccess"));
      onPaid(r.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t(language, "paymentFailed"));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="absolute inset-0 z-[80] flex flex-col bg-background"
    >
      {/* Header */}
      <div className="safe-top shrink-0 border-b border-border/60 bg-card px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background ring-1 ring-border/70 active:scale-95"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="flex-1 text-[16px] font-bold text-foreground">{t(language, "paymentTitle")}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto yt-scroll px-4 py-5">
        {/* Amount */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-amber-500/10 p-4 ring-1 ring-primary/15">
          <div className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {t(language, "amountToPay")}
          </div>
          <div className="mt-1 text-3xl font-extrabold text-primary">{formatSom(amount, language)}</div>
        </div>

        {/* Method selector */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setMethod("CARD")}
            className={cn(
              "flex flex-col items-start gap-1 rounded-2xl border-2 p-3.5 text-left transition active:scale-[0.98]",
              method === "CARD" ? "border-primary bg-primary/5" : "border-border bg-card"
            )}
          >
            <CreditCard className={cn("h-6 w-6", method === "CARD" ? "text-primary" : "text-muted-foreground")} />
            <span className="mt-1 text-[14px] font-bold text-foreground">{t(language, "payByCard")}</span>
            <span className="text-[12px] text-muted-foreground">{t(language, "payByCardDesc")}</span>
          </button>
          <button
            onClick={() => setMethod("CASH")}
            className={cn(
              "flex flex-col items-start gap-1 rounded-2xl border-2 p-3.5 text-left transition active:scale-[0.98]",
              method === "CASH" ? "border-primary bg-primary/5" : "border-border bg-card"
            )}
          >
            <Wallet className={cn("h-6 w-6", method === "CASH" ? "text-primary" : "text-muted-foreground")} />
            <span className="mt-1 text-[14px] font-bold text-foreground">{t(language, "payByCash")}</span>
            <span className="text-[12px] text-muted-foreground">{t(language, "payByCashDesc")}</span>
          </button>
        </div>

        {/* Card form (only for CARD method) */}
        <AnimatePresence mode="wait">
          {method === "CARD" && (
            <motion.div
              key="card-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-5 space-y-4">
                {/* Card preview */}
                <div className="relative h-44 overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 p-4 text-white shadow-lg">
                  <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
                  <div className="absolute right-4 top-4 h-8 w-10 rounded bg-gradient-to-br from-amber-300 to-amber-500" />
                  <div className="relative mt-8">
                    <div className="text-[17px] font-semibold tracking-wider">
                      {cardNumber || "•••• •••• •••• ••••"}
                    </div>
                  </div>
                  <div className="relative mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-[9px] uppercase text-white/60">{t(language, "cardHolder")}</div>
                      <div className="text-[13px] font-medium uppercase tracking-wide">
                        {cardHolder || t(language, "cardHolderPlaceholder")}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase text-white/60">{t(language, "cardExp")}</div>
                      <div className="text-[13px] font-medium">{cardExp || "MM/YY"}</div>
                    </div>
                    <BrandBadge brand={brand} />
                  </div>
                </div>

                {/* Card number */}
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                    {t(language, "cardNumber")}
                  </label>
                  <div className="relative">
                    <input
                      inputMode="numeric"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="8600 1234 5678 9012"
                      className="h-12 w-full rounded-xl bg-card px-4 pr-12 text-[15px] font-medium tracking-wider text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <BrandBadge brand={brand} small />
                    </div>
                  </div>
                  {cardNumber && !cardValid && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3 w-3" /> {t(language, "cardNumberInvalid")}
                    </p>
                  )}
                </div>

                {/* Exp + CVV */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                      {t(language, "cardExp")}
                    </label>
                    <input
                      inputMode="numeric"
                      value={cardExp}
                      onChange={(e) => setCardExp(formatExp(e.target.value))}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="h-12 w-full rounded-xl bg-card px-4 text-[15px] font-medium text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                      {t(language, "cardCvv")}
                    </label>
                    <input
                      inputMode="numeric"
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="•••"
                      maxLength={4}
                      className="h-12 w-full rounded-xl bg-card px-4 text-[15px] font-medium tracking-widest text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Card holder */}
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                    {t(language, "cardHolderName")}
                  </label>
                  <input
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    placeholder={t(language, "cardHolderPlaceholder")}
                    className="h-12 w-full rounded-xl bg-card px-4 text-[15px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Security note */}
                <p className="flex items-start gap-1.5 text-[12px] leading-snug text-muted-foreground">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {t(language, "paymentSecurityNote")}
                </p>
              </div>
            </motion.div>
          )}
          {method === "CASH" && (
            <motion.div
              key="cash-info"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-5 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/20">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-amber-700 dark:text-amber-300">
                  <Wallet className="h-4.5 w-4.5" />
                  {t(language, "cashOnDeliveryTitle")}
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-amber-700/80 dark:text-amber-300/80">
                  {t(language, "cashOnDeliveryDesc")}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div className="safe-bottom shrink-0 border-t border-border/60 bg-background px-4 py-3">
        <button
          onClick={pay}
          disabled={processing || (method === "CARD" && !formValid)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {processing ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> {t(language, "processing")}</>
          ) : (
            <>
              <ShieldCheck className="h-5 w-5" />
              {t(language, "pay")} {formatSom(amount, language)}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function BrandBadge({ brand, small }: { brand: string; small?: boolean }) {
  if (brand === "unknown") return null;
  const labels: Record<string, string> = {
    visa: "VISA",
    mastercard: "MC",
    uzcard: "UZCARD",
    humo: "HUMO",
  };
  const colors: Record<string, string> = {
    visa: "bg-blue-600 text-white",
    mastercard: "bg-orange-500 text-white",
    uzcard: "bg-emerald-600 text-white",
    humo: "bg-rose-600 text-white",
  };
  return (
    <span className={cn(
      "rounded-md font-bold uppercase tracking-wide",
      small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
      colors[brand] ?? "bg-muted text-muted-foreground"
    )}>
      {labels[brand] ?? brand}
    </span>
  );
}
