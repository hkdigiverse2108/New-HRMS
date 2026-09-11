import * as React from "react";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type CommonStatus =
  | "Active"
  | "Inactive"
  | "Present"
  | "Absent"
  | "Late"
  | "On Leave"
  | "Approved"
  | "Pending"
  | "Rejected"
  | "Paid"
  | "Unpaid"
  | "Completed"
  | "In Progress"
  | string;

export interface StatusBadgeProps {
  status: CommonStatus;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const norm = (status || "").trim().toLowerCase();

  let style = "bg-slate-100 text-slate-700 border-slate-200/60";
  let Icon: React.ComponentType<{ className?: string }> | null = null;

  switch (norm) {
    case "active":
    case "present":
    case "approved":
    case "paid":
    case "completed":
      style = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
      Icon = CheckCircle2;
      break;

    case "inactive":
    case "absent":
    case "rejected":
    case "unpaid":
      style = "bg-rose-50 text-rose-700 border-rose-200/60";
      Icon = XCircle;
      break;

    case "late":
    case "pending":
    case "in progress":
      style = "bg-amber-50 text-amber-700 border-amber-200/60";
      Icon = Clock;
      break;

    case "on leave":
    case "remote":
      style = "bg-blue-50 text-blue-700 border-blue-200/60";
      Icon = AlertCircle;
      break;

    default:
      style = "bg-muted text-foreground/80 border-border/60";
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-colors shrink-0 whitespace-nowrap",
        style,
        className
      )}
    >
      {showIcon && Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{status}</span>
    </span>
  );
}
