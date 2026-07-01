"use client";

import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

/**
 * YukTaxi brand logo — a truck mark in an amber rounded square + wordmark.
 * No external images; pure SVG so it works offline and themes correctly.
 */
export function BrandLogo({
  size = 40,
  className,
  showText = true,
  textClassName,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative grid place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="text-primary-foreground"
          style={{ width: size * 0.6, height: size * 0.6 }}
          aria-hidden
        >
          <path
            d="M2 6.5C2 5.67 2.67 5 3.5 5h9c.83 0 1.5.67 1.5 1.5v8H2v-8Z"
            fill="currentColor"
          />
          <path
            d="M14 8.5h3.2c.6 0 1.16.27 1.54.74l1.8 2.26c.14.17.21.38.21.6v2.4h-6.75V8.5Z"
            fill="currentColor"
            opacity="0.85"
          />
          <circle cx="6.5" cy="16.5" r="2" fill="#1C1410" />
          <circle cx="17" cy="16.5" r="2" fill="#1C1410" />
          <circle cx="6.5" cy="16.5" r="0.8" fill="currentColor" />
          <circle cx="17" cy="16.5" r="0.8" fill="currentColor" />
        </svg>
      </div>
      {showText && (
        <span
          className={cn(
            "text-xl font-extrabold tracking-tight text-foreground",
            textClassName
          )}
        >
          Yuk<span className="text-primary">Taxi</span>
        </span>
      )}
    </div>
  );
}
