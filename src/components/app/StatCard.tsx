"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "neutral";
  className?: string;
}

/**
 * StatCard — VERTICAL layout (per design audit §4.1).
 * Icon-in-circle on top, label + value below, full width — no text truncation
 * on small screens. Min font 13px enforced.
 */
const ACCENT: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  neutral: "bg-muted text-muted-foreground",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "primary",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden border-border/60", className)}>
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
              ACCENT[accent]
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] leading-tight text-muted-foreground">
            {label}
          </div>
          <div className="mt-0.5 break-words text-lg font-bold leading-tight text-foreground">
            {value}
          </div>
          {hint && (
            <div className="mt-0.5 text-[13px] leading-tight text-muted-foreground">
              {hint}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
