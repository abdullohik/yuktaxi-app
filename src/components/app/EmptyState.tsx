"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * EmptyState — illustration (icon-in-circle) + text + optional action.
 * Per audit: empty states must have illustration + explanation + action, not plain text.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-10 text-center",
        className
      )}
    >
      <div className="relative grid h-24 w-24 place-items-center">
        <div className="absolute inset-0 rounded-full bg-primary/5" />
        <div className="absolute inset-3 rounded-full bg-primary/10" />
        <div className="relative grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-7 w-7" />
        </div>
      </div>
      <h3 className="mt-5 text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 inline-flex h-12 min-w-44 items-center justify-center rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
