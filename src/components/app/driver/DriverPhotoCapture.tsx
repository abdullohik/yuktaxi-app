"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, X, Check, Loader2, RefreshCw, AlertTriangle,
  ShieldCheck, Sparkles, ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import type { OrderPhoto, PhotoSide, AIComparison } from "@/lib/types";

interface DriverPhotoCaptureProps {
  orderId: string;
  driverPhone: string;
  cargoTitle?: string | null;
  cargoDescription?: string | null;
  cargoCategory?: string | null;
  onClose: () => void;
  onComplete: (comparison: AIComparison | null) => void;
}

const SIDES: { id: PhotoSide; labelKey: "sideFront" | "sideBack" | "sideLeft" | "sideRight"; hint: string }[] = [
  { id: "FRONT", labelKey: "sideFront", hint: "old" },
  { id: "BACK", labelKey: "sideBack", hint: "orqa" },
  { id: "LEFT", labelKey: "sideLeft", hint: "chap" },
  { id: "RIGHT", labelKey: "sideRight", hint: "o'ng" },
];

export function DriverPhotoCapture({
  orderId,
  driverPhone,
  cargoTitle,
  cargoDescription,
  cargoCategory,
  onClose,
  onComplete,
}: DriverPhotoCaptureProps) {
  const { language } = useApp();
  const [photos, setPhotos] = useState<Partial<Record<PhotoSide, OrderPhoto>>>({});
  const [activeSide, setActiveSide] = useState<PhotoSide | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [comparison, setComparison] = useState<AIComparison | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load any existing driver photos for this order (AT_PICKUP stage)
  useEffect(() => {
    api<{ ok: boolean; data: OrderPhoto[] }>(`/api/orders/${orderId}/photos?stage=AT_PICKUP&phone=${driverPhone}&role=DRIVER`)
      .then((r) => {
        const map: Partial<Record<PhotoSide, OrderPhoto>> = {};
        for (const p of r.data ?? []) {
          if (p.side) map[p.side] = p;
        }
        setPhotos(map);
      })
      .catch(() => {});
    // Also load any existing comparison
    api<{ ok: boolean; data: AIComparison | null }>(`/api/ai/compare-photos?orderId=${orderId}&driverPhone=${driverPhone}`)
      .then((r) => {
        if (r.data) setComparison(r.data);
      })
      .catch(() => {});
  }, [orderId, driverPhone]);

  const allSidesCaptured = SIDES.every((s) => photos[s.id]);

  function startCapture(side: PhotoSide) {
    setActiveSide(side);
    setTimeout(() => fileInputRef.current?.click(), 100);
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    if (!activeSide) return;
    const file = e.target.files?.[0];
    if (!file) {
      setActiveSide(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error(t(language, "photoNotImage"));
      setActiveSide(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t(language, "photoTooBig"));
      setActiveSide(null);
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("read-failed"));
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(dataUrl, 1280, 0.82);
      // If a photo for this side already exists, replace it (delete old, upload new)
      const existing = photos[activeSide];
      if (existing) {
        try {
          await api(`/api/orders/${orderId}/photos?photoId=${existing.id}&phone=${driverPhone}`, { method: "DELETE" });
        } catch {
          // swallow — best-effort
        }
      }
      const r = await api<{ ok: boolean; data: OrderPhoto; error?: string }>(`/api/orders/${orderId}/photos`, {
        method: "POST",
        body: JSON.stringify({
          uploaderPhone: driverPhone,
          uploaderRole: "DRIVER",
          stage: "AT_PICKUP",
          side: activeSide,
          driverOnly: true,
          dataUrl: compressed,
        }),
      });
      if (!r.ok) throw new Error(r.error || t(language, "photoUploadFailed"));
      setPhotos((prev) => ({ ...prev, [activeSide]: r.data }));
      toast.success(t(language, "photoUploaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t(language, "photoUploadFailed"));
    } finally {
      setUploading(false);
      setActiveSide(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function runAnalysis() {
    if (!allSidesCaptured) return;
    setAnalyzing(true);
    try {
      const r = await api<{ ok: boolean; data: AIComparison; error?: string }>("/api/ai/compare-photos", {
        method: "POST",
        body: JSON.stringify({ orderId, driverPhone }),
      });
      if (!r.ok) throw new Error(r.error || t(language, "aiCompareFailed"));
      setComparison(r.data);
      toast.success(t(language, "aiCompareReady"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t(language, "aiCompareFailed"));
    } finally {
      setAnalyzing(false);
    }
  }

  function done() {
    onComplete(comparison);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="absolute inset-0 z-[80] flex flex-col bg-background"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPickPhoto}
        className="hidden"
      />

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
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-foreground">{t(language, "cargoInspection")}</h2>
            <p className="text-[12px] text-muted-foreground">{t(language, "cargoInspectionDesc")}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto yt-scroll px-4 py-5">
        {/* Cargo info from customer */}
        {(cargoTitle || cargoDescription) && (
          <div className="mb-5 rounded-2xl bg-card p-3.5 ring-1 ring-border/60">
            <div className="mb-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              {t(language, "customerDeclared")}
            </div>
            {cargoTitle && (
              <div className="text-[15px] font-bold text-foreground">{cargoTitle}</div>
            )}
            {cargoDescription && (
              <div className="mt-1 text-[13px] leading-snug text-muted-foreground">{cargoDescription}</div>
            )}
          </div>
        )}

        {/* 4-side capture grid */}
        <h3 className="mb-2 text-[14px] font-bold text-foreground">
          {t(language, "captureFourSides")}
        </h3>
        <p className="mb-3 text-[12px] leading-snug text-muted-foreground">
          {t(language, "captureFourSidesDesc")}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {SIDES.map((s) => {
            const photo = photos[s.id];
            const isActive = activeSide === s.id;
            return (
              <button
                key={s.id}
                onClick={() => startCapture(s.id)}
                className="relative aspect-square overflow-hidden rounded-2xl border-2 border-border bg-card transition active:scale-[0.98]"
              >
                {photo ? (
                  <>
                    <img src={photo.dataUrl} alt={s.id} className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <span className="flex items-center gap-1 text-[12px] font-bold text-white">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        {t(language, s.labelKey)}
                      </span>
                    </div>
                    <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    {uploading && isActive ? (
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    ) : (
                      <Camera className="h-7 w-7" />
                    )}
                    <span className="text-[13px] font-semibold">{t(language, s.labelKey)}</span>
                    <span className="text-[11px] text-muted-foreground/70">{t(language, "tapToCapture")}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* AI comparison result (driver-only) */}
        <AnimatePresence>
          {comparison && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="yt-ai-glow mt-5 rounded-2xl p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[14px] font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t(language, "aiInspectionResult")}
                </h3>
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                  {t(language, "driverOnly")}
                </span>
              </div>

              {/* Two big gauges */}
              <div className="grid grid-cols-2 gap-3">
                <Gauge label={t(language, "matchScore")} value={comparison.matchPercentage} good={comparison.matchPercentage >= 70} />
                <Gauge label={t(language, "conditionScore")} value={comparison.conditionPercentage} good={comparison.conditionPercentage >= 60} />
              </div>

              {/* Recommendation */}
              <div className={cn(
                "mt-3 flex items-center gap-2 rounded-lg p-2.5 text-[13px] font-semibold",
                comparison.recommendation === "OK_TO_PROCEED" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                comparison.recommendation === "INSPECT_WITH_CUSTOMER" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                comparison.recommendation === "REFUSE_PICKUP" && "bg-rose-500/10 text-rose-700 dark:text-rose-300",
              )}>
                {comparison.recommendation === "OK_TO_PROCEED" && <ShieldCheck className="h-4 w-4" />}
                {comparison.recommendation === "INSPECT_WITH_CUSTOMER" && <AlertTriangle className="h-4 w-4" />}
                {comparison.recommendation === "REFUSE_PICKUP" && <AlertTriangle className="h-4 w-4" />}
                {t(language, `rec_${comparison.recommendation}` as "rec_OK_TO_PROCEED")}
              </div>

              {/* Observed item */}
              {comparison.observedItem && (
                <div className="mt-3 text-[12px] leading-snug text-foreground">
                  <span className="font-semibold text-muted-foreground">{t(language, "observedItem")}:</span>{" "}
                  {comparison.observedItem}
                </div>
              )}
              {comparison.damageNotes && (
                <div className="mt-1 text-[12px] leading-snug text-foreground">
                  <span className="font-semibold text-muted-foreground">{t(language, "damageNotes")}:</span>{" "}
                  {comparison.damageNotes}
                </div>
              )}

              {/* Provider */}
              <div className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                {t(language, "provider")}: {comparison.provider}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div className="safe-bottom shrink-0 border-t border-border/60 bg-background px-4 py-3">
        {!comparison ? (
          <button
            onClick={runAnalysis}
            disabled={!allSidesCaptured || analyzing}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            {analyzing ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> {t(language, "analyzingCargo")}</>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                {allSidesCaptured ? t(language, "runAiInspection") : t(language, "captureAllSidesFirst")}
              </>
            )}
          </button>
        ) : (
          <button
            onClick={done}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98]"
          >
            {t(language, "proceedToPickup")} <ArrowRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Gauge({ label, value, good }: { label: string; value: number; good: boolean }) {
  const color = good ? "text-emerald-600 dark:text-emerald-400" : value >= 40 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  const barColor = good ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-border/50">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-extrabold", color)}>{value}%</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Compress image client-side — same as BookingFlow's helper.
 */
async function compressImage(dataUrl: string, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
