"use client";

import { useEffect, useRef, useState, useCallback, type ClipboardEvent, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  ArrowRight,
  Loader2,
  ShieldCheck,
  UserRound,
  Check,
  Lock,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BrandLogo } from "./BrandLogo";
import { cn } from "@/lib/utils";
import type { User, Role } from "@/lib/types";

type Stage = "sms_phone" | "sms_otp" | "sms_name";

export function AuthScreen() {
  const {
    language, role,
    loginAsGuest, loginAsUser,
    setUser, setAccessToken,
    navigate, back,
  } = useApp();

  const [stage, setStage] = useState<Stage>("sms_phone");
  const [transitionDir, setTransitionDir] = useState<1 | -1>(1);

  // SMS state
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [name, setName] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");

  // Persist phone + accessToken via refs for cross-stage access
  const phoneRef = useRef(phone);
  const tokenRef = useRef<string | null>(null);

  // Keep phoneRef in sync
  useEffect(() => { phoneRef.current = phone; }, [phone]);

  // Phone digit count (stripped of formatting)
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneReady = phoneDigits.length === 9;

  // Stage transition
  const goto = useCallback((next: Stage, dir: 1 | -1 = 1) => {
    setTransitionDir(dir);
    setStage(next);
    setError("");
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  // ====== SEND OTP ======
  async function sendOtp() {
    if (!phoneReady) {
      setError(t(language, "phoneRequired"));
      return;
    }
    setError("");
    setSending(true);
    try {
      const full = "998" + phoneDigits;
      const r = await api<{ ok: boolean; data: { sent: boolean; devCode: string } }>(
        "/api/auth/otp/send",
        { method: "POST", body: JSON.stringify({ phone: full }) }
      );
      setDevCode(r.data.devCode);
      toast.success(t(language, "smsSent"), { duration: 3000 });
      goto("sms_otp");
      setResendIn(60);
      setOtp("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : t(language, "error");
      setError(msg);
      toast.error(msg, { duration: 5000 });
    } finally {
      setSending(false);
    }
  }

  // ====== VERIFY OTP ======
  async function verifyOtp() {
    if (otp.length !== 6) return;
    setVerifying(true);
    setError("");
    try {
      const full = "998" + phoneRef.current.replace(/\D/g, "");
      const r = await api<{ ok: boolean; data: { user: User; accessToken: string } }>(
        "/api/auth/otp/verify",
        { method: "POST", body: JSON.stringify({ phone: full, code: otp, role }) }
      );
      // Store the access token for name step
      tokenRef.current = r.data.accessToken;
      setAccessToken(r.data.accessToken);

      // Use the server-returned user (role is authoritative from the server)
      const verifiedUser: User = r.data.user;

      if (!verifiedUser.name) {
        // Need name — save user + token so saveName can work
        setUser(verifiedUser);
        goto("sms_name");
      } else {
        // Full login — atomic
        loginAsUser(verifiedUser, r.data.accessToken);
        toast.success(t(language, "congrats"), { duration: 3000 });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t(language, "wrongCode");
      setError(msg);
      toast.error(msg, { duration: 5000 });
      // Shake the OTP inputs
      const box = document.querySelector("#sms-otp-0");
      if (box) {
        box.classList.add("animate-shake");
        setTimeout(() => box.classList.remove("animate-shake"), 600);
      }
    } finally {
      setVerifying(false);
    }
  }

  // ====== SAVE NAME (final step) ======
  async function saveName() {
    const token = tokenRef.current;
    if (!token) {
      navigate("customer_home");
      return;
    }
    try {
      const full = "998" + phoneRef.current.replace(/\D/g, "");
      const r = await api<{ ok: boolean; data: { user: User } }>(
        `/api/auth/me?phone=${full}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: name.trim() || null, role }),
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // Use the server-returned user role
      loginAsUser(r.data.user, token);
      toast.success(t(language, "congrats"), { duration: 3000 });
    } catch {
      // Even if name save fails, log them in with the role from server
      const state = useApp.getState();
      if (state.user) {
        loginAsUser(state.user, token);
      } else {
        navigate("customer_home");
      }
    }
  }

  // ====== GUEST ======
  function continueAsGuest() {
    loginAsGuest();
    toast.info(t(language, "guestNotice"), { duration: 3000 });
  }

  // ====== BACK ======
  function backHandler() {
    if (stage === "sms_phone") {
      back();
    } else if (stage === "sms_otp") {
      goto("sms_phone", -1);
    } else {
      goto("sms_otp", -1);
    }
  }

  // ====== Auto-fill dev code ======
  function fillDevCode() {
    setOtp(devCode);
  }

  // Animation variants
  const animVariants = {
    enter: (dir: 1 | -1) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: 1 | -1) => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
  };

  const roleLabel = role === "DRIVER" ? t(language, "roleDriver") : role === "FLEET" ? t(language, "roleFleet") : t(language, "roleCustomer");

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="safe-top flex items-center gap-2 px-4 pt-5">
        <button
          onClick={backHandler}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card text-foreground ring-1 ring-border/60 transition active:scale-90"
          aria-label={t(language, "back")}
        >
          <ArrowRight className="h-5 w-5 rotate-180" />
        </button>
        <div className="flex-1" />
        <span className="rounded-full bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary">
          {roleLabel}
        </span>
      </div>

      {/* Content */}
      <div className="relative flex flex-1 flex-col overflow-hidden px-6 pt-4">
        <AnimatePresence mode="wait" custom={transitionDir}>
          {/* ============ SMS PHONE ============ */}
          {stage === "sms_phone" && (
            <motion.div
              key="sms_phone"
              custom={transitionDir}
              variants={animVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex flex-1 flex-col"
            >
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
                <div className="relative mb-4 grid h-20 w-20 place-items-center rounded-[1.75rem] bg-gradient-to-br from-primary via-amber-600 to-amber-800 shadow-xl shadow-primary/30">
                  <div className="absolute inset-0 rounded-[1.75rem] bg-amber-400/20 blur-lg" />
                  <BrandLogo size={40} showText={false} />
                </div>
                <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground">
                  {t(language, "authWelcome")}
                </h1>
                <p className="mt-2 text-[15px] text-muted-foreground">
                  {t(language, "enterPhoneDesc")}
                </p>
              </motion.div>

              {/* Error banner */}
              {error && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-[13px] font-medium text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="mt-4">
                <label className="mb-2 block text-[13px] font-medium text-muted-foreground">
                  {t(language, "phonePlaceholder")}
                </label>
                <PhoneInput value={phone} onChange={setPhone} onSubmit={sendOtp} autoFocus />
                <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted-foreground/70">
                  <Lock className="h-3 w-3" />
                  {t(language, "phoneSecurityNote")}
                </p>
              </div>

              <div className="mt-auto pt-8">
                <PrimaryButton
                  onClick={sendOtp}
                  loading={sending}
                  disabled={!phoneReady}
                  label={t(language, "sendOtp")}
                  loadingLabel={t(language, "sending")}
                />

                {/* Hint when button is disabled */}
                {!phoneReady && phoneDigits.length > 0 && (
                  <p className="mt-2 text-center text-[12px] text-amber-600 dark:text-amber-400">
                    {9 - phoneDigits.length} {t(language, "digitsRemaining")}
                  </p>
                )}

                <button
                  onClick={continueAsGuest}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 text-[14px] font-medium text-muted-foreground transition hover:text-foreground active:scale-95"
                >
                  <UserRound className="h-4 w-4" />
                  {t(language, "enterAsGuest")}
                </button>

                <div className="mt-6">
                  <div className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground/70">
                    <Lock className="h-3.5 w-3.5" />
                    {t(language, "secureAuth")}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ============ SMS OTP ============ */}
          {stage === "sms_otp" && (
            <motion.div
              key="sms_otp"
              custom={transitionDir}
              variants={animVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex flex-1 flex-col"
            >
              <StageHero icon={ShieldCheck} iconBg="bg-primary/10 text-primary" />
              <h1 className="text-2xl font-extrabold leading-tight text-foreground">
                {t(language, "enterOtp")}
              </h1>
              <p className="mt-1.5 text-[15px] text-muted-foreground">
                +998 {phone} — {t(language, "otpSent")}
              </p>

              {/* Error banner */}
              {error && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-[13px] font-medium text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="mt-6">
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={verifyOtp}
                  idPrefix="sms-otp"
                />

                {/* Dev code banner with auto-fill */}
                {devCode && (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-300/60 dark:bg-amber-950/40 dark:ring-amber-700/50">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15">
                      <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">
                        Demo kod (SMS o&apos;rniga):
                      </p>
                      <p className="mt-0.5 font-mono text-2xl font-black tracking-[0.25em] text-amber-900 dark:text-amber-100">
                        {devCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={fillDevCode}
                      className="grid h-10 shrink-0 place-items-center rounded-xl bg-amber-600 px-3 text-[13px] font-bold text-white transition active:scale-95"
                    >
                      To&apos;ldirish
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  disabled={resendIn > 0}
                  onClick={sendOtp}
                  className={cn(
                    "flex h-10 items-center gap-1.5 px-3 text-[14px] font-medium transition active:scale-95",
                    resendIn > 0 ? "text-muted-foreground cursor-not-allowed" : "text-primary"
                  )}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", resendIn > 0 && "opacity-50")} />
                  {resendIn > 0
                    ? `${t(language, "resendIn")} ${resendIn} ${t(language, "seconds")}`
                    : t(language, "resendCode")}
                </button>
                <button
                  onClick={() => goto("sms_phone", -1)}
                  className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
                >
                  {t(language, "changePhone")}
                </button>
              </div>

              <div className="mt-auto pt-8">
                <PrimaryButton
                  onClick={verifyOtp}
                  loading={verifying}
                  disabled={otp.length !== 6}
                  label={t(language, "verifyOtp")}
                  loadingLabel={t(language, "verifying")}
                />
              </div>
            </motion.div>
          )}

          {/* ============ SMS NAME ============ */}
          {stage === "sms_name" && (
            <motion.div
              key="sms_name"
              custom={transitionDir}
              variants={animVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex flex-1 flex-col"
            >
              <StageHero icon={Check} iconBg="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
              <h1 className="text-2xl font-extrabold leading-tight text-foreground">
                {t(language, "congrats")}
              </h1>
              <p className="mt-1.5 text-[15px] text-muted-foreground">
                {t(language, "congratsDesc")}
              </p>

              <div className="mt-8">
                <label className="mb-2 block text-[13px] font-medium text-muted-foreground">
                  {t(language, "profileName")}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  placeholder={t(language, "profileNamePlaceholder")}
                  autoFocus
                  className="h-14 w-full rounded-xl bg-card px-4 text-[17px] text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="mt-auto pt-8 space-y-2">
                <PrimaryButton
                  onClick={saveName}
                  label={t(language, "finishRegistration")}
                  icon={<ArrowRight className="h-5 w-5" />}
                />
                <button
                  onClick={saveName}
                  className="h-12 w-full text-[15px] font-medium text-muted-foreground"
                >
                  {t(language, "skip")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============ Sub-components ============

function StageHero({ icon: Icon, iconBg }: { icon: typeof Phone; iconBg: string }) {
  return (
    <div className={cn("mb-2 grid h-14 w-14 place-items-center rounded-2xl", iconBg)}>
      <Icon className="h-7 w-7" />
    </div>
  );
}

function PrimaryButton({
  onClick, loading, disabled, label, loadingLabel, icon,
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label: string;
  loadingLabel?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98]",
        (disabled || loading) && "opacity-40 shadow-none cursor-not-allowed"
      )}
    >
      {loading ? (
        <><Loader2 className="h-5 w-5 animate-spin" /> {loadingLabel || label}</>
      ) : (
        <>{label} {icon}</>
      )}
    </button>
  );
}

function PhoneInput({
  value, onChange, onSubmit, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  return (
    <div className="flex items-stretch gap-2">
      <div className="flex items-center gap-1.5 rounded-xl bg-card px-3.5 ring-1 ring-border/70">
        <span className="text-[15px] font-semibold text-foreground">+998</span>
      </div>
      <input
        ref={ref}
        inputMode="numeric"
        autoComplete="tel"
        value={value}
        onChange={(e) => onChange(formatPhone(e.target.value))}
        onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
        placeholder="90 123 45 67"
        className="h-14 min-w-0 flex-1 rounded-xl bg-card px-4 text-[19px] font-semibold tracking-wide text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}

function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)];
  return parts.filter(Boolean).join(" ");
}

/**
 * OtpInput — 6-box OTP with paste support + backspace navigation.
 */
function OtpInput({
  value, onChange, onComplete, idPrefix,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: () => void;
  idPrefix: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(i: number, d: string) {
    const v = d.replace(/\D/g, "").slice(-1);
    const arr = value.padEnd(6, " ").split("");
    arr[i] = v || " ";
    const next = arr.join("").trim();
    onChange(next);
    if (v && i < 5) {
      refs.current[i + 1]?.focus();
      refs.current[i + 1]?.select();
    }
    if (next.length === 6 && !next.includes(" ")) {
      setTimeout(() => onComplete?.(), 100);
    }
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
      refs.current[i - 1]?.select();
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    } else if (e.key === "Enter" && value.length === 6) {
      onComplete?.();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length > 0) {
      onChange(text);
      if (text.length === 6) {
        refs.current[5]?.focus();
        setTimeout(() => onComplete?.(), 100);
      } else {
        refs.current[text.length]?.focus();
      }
    }
  }

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          id={`${idPrefix}-${i}`}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className="h-16 w-12 rounded-xl bg-card text-center text-2xl font-bold text-foreground ring-1 ring-border/70 outline-none focus:ring-2 focus:ring-primary transition"
        />
      ))}
    </div>
  );
}
