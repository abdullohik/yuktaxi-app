"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PhoneFrameProps {
  children: React.ReactNode;
}

/**
 * PhoneFrame — on desktop, wraps the app in a realistic phone bezel so it
 * reads as "an app, not a website". On mobile, fills the screen.
 */
export function PhoneFrame({ children }: PhoneFrameProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!isDesktop) {
    // Mobile: full screen, no bezel
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
        {children}
      </div>
    );
  }

  // Desktop: phone bezel on a premium backdrop
  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center bg-gradient-to-br from-stone-100 via-amber-50 to-stone-200 p-6 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950">
      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-orange-500/15 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative">
        {/* Phone bezel — premium with gradient border */}
        <div className="relative h-[860px] w-[400px] max-h-[92vh] rounded-[3rem] bg-stone-900 p-[3px] shadow-2xl shadow-stone-900/50">
          <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-stone-700 via-stone-900 to-stone-800" />
          <div className="relative h-full w-full overflow-hidden rounded-[2.8rem] bg-stone-900">
            {/* Side buttons */}
            <div className="absolute -left-[3px] top-32 h-12 w-[3px] rounded-l bg-stone-700" />
            <div className="absolute -left-[3px] top-48 h-16 w-[3px] rounded-l bg-stone-700" />
            <div className="absolute -right-[3px] top-40 h-20 w-[3px] rounded-r bg-stone-700" />

            {/* Screen */}
            <div className="relative h-full w-full overflow-hidden rounded-[2.8rem] bg-background">
              {/* Notch — dynamic island style */}
              <div className="absolute left-1/2 top-2 z-50 h-7 w-28 -translate-x-1/2 rounded-full bg-stone-900" />
              <div className="absolute left-1/2 top-3.5 z-50 h-1 w-1 -translate-x-5 rounded-full bg-stone-700" />
              <div className="absolute left-1/2 top-3.5 z-50 h-1 w-1 translate-x-4 rounded-full bg-stone-700" />
              {children}
            </div>
          </div>
        </div>

        {/* Caption */}
        <div className="mt-5 text-center">
          <p className="text-[13px] font-medium text-stone-400 dark:text-stone-500">
            YukTaxi — mobil ilova ko'rinishida
          </p>
        </div>
      </div>
    </div>
  );
}

/** Inner scroll container respecting the notch / safe areas inside the frame. */
export function ScreenScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "yt-scroll h-full overflow-y-auto overscroll-contain",
        className
      )}
    >
      {children}
    </div>
  );
}
