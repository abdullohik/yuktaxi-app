"use client";

import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/api";
import { t, type DictKey } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import type { OrderStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
  size?: "sm" | "md";
}

/**
 * StatusBadge — color + text + icon dot together (per audit: never color alone).
 * Uses i18n via STATUS_META[status].key (e.g. "searchingDriver", "driverFound").
 */
export function StatusBadge({ status, className, size = "md" }: StatusBadgeProps) {
  const { language } = useApp();
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        meta.bg,
        meta.color,
        size === "sm" ? "px-2 py-0.5 text-[13px]" : "px-2.5 py-1 text-sm",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {t(language, meta.key as DictKey)}
    </span>
  );
}
