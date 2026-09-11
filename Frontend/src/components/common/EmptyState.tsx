import * as React from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "bg-white border border-border/60 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center my-4 shadow-sm w-full max-w-full",
        className
      )}
    >
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground mb-4">
        <Icon className="w-7 h-7 sm:w-8 sm:h-8 opacity-60" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          size="sm"
          className="rounded-xl font-bold text-xs"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
