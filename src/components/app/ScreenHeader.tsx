"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { useApp } from "@/lib/store";
import { BrandLogo } from "./BrandLogo";

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  /** show the brand logo instead of a title (home screens) */
  brand?: boolean;
  className?: string;
}

/**
 * ScreenHeader — premium glassmorphism top bar with backdrop blur.
 * Back arrow is always large + visible (per accessibility audit).
 */
export function ScreenHeader({
  title,
  subtitle,
  showBack,
  onBack,
  right,
  brand,
  className,
}: ScreenHeaderProps) {
  const { back } = useApp();
  return (
    <header
      className={cn(
        "glass safe-top sticky top-0 z-30 shrink-0 border-b border-border/30 px-4 pb-3 pt-4",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={onBack ?? back}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border/50 transition active:scale-90"
            aria-label="Orqaga"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {brand ? (
            <BrandLogo size={32} />
          ) : (
            <>
              {title && (
                <h1 className="truncate text-lg font-bold leading-tight text-foreground">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="truncate text-[13px] text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </>
          )}
        </div>
        {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
      </div>
    </header>
  );
}
