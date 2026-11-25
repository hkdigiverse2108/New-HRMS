import React, { useState, useEffect, useCallback } from "react";
import {
  Zap,
  X,
  Check,
  CheckCheck,
  CalendarDays,
  Clock,
  FileCheck2,
  Receipt,
  Loader2,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

interface ApprovalItem {
  id: string;
  type: "leave" | "overtime" | "daily_progress" | "invoice";
  employee_id: string;
  employee_name: string;
  department: string;
  title: string;
  subtitle: string;
  reason: string;
  created_at: string;
}

interface ApprovalsHubData {
  leaves: ApprovalItem[];
  overtime: ApprovalItem[];
  daily_progress: ApprovalItem[];
  invoices: ApprovalItem[];
  total_pending: number;
}

export const ApprovalsHubDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}> = ({ isOpen, onClose, onCountChange }) => {
  const [data, setData] = useState<ApprovalsHubData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "leave" | "overtime" | "daily_progress" | "invoice">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchHub = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApprovalsHubData>("/dashboard/approvals-hub", { showLoader: false });
      setData(res);
      onCountChange?.(res?.total_pending ?? 0);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load Approvals Hub");
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    if (isOpen) {
      fetchHub();
    }
  }, [isOpen, fetchHub]);

  const handleAction = async (item: ApprovalItem, decision: "approve" | "reject") => {
    setBusyId(item.id);
    try {
      await api.post("/dashboard/approvals-hub/action", {
        type: item.type,
        id: item.id,
        decision,
        reason: decision === "reject" ? "Rejected via Unified Approvals Hub" : ""
      });
      toast.success(`${item.employee_name}: ${decision === "approve" ? "Approved" : "Rejected"}!`);
      await fetchHub();
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${decision}`);
    } finally {
      setBusyId(null);
    }
  };

  if (!isOpen) return null;

  const allItems: ApprovalItem[] = [
    ...(data?.leaves || []),
    ...(data?.overtime || []),
    ...(data?.daily_progress || []),
    ...(data?.invoices || []),
  ];

  const visibleItems =
    activeTab === "all"
      ? allItems
      : allItems.filter(i => i.type === activeTab);

  const handleBulkApprove = async () => {
    if (visibleItems.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    for (const itm of visibleItems) {
      try {
        await api.post("/dashboard/approvals-hub/action", {
          type: itm.type,
          id: itm.id,
          decision: "approve",
          reason: ""
        }, { showLoader: false });
        ok++;
      } catch {
        // continue remaining
      }
    }
    setBulkBusy(false);
    toast.success(`Approved ${ok} of ${visibleItems.length} pending requests!`);
    await fetchHub();
  };

  const typeBadge = (t: ApprovalItem["type"]) => {
    if (t === "leave") return { label: "Leave", cls: "bg-sky-500/10 text-sky-600 border-sky-500/20", icon: CalendarDays };
    if (t === "overtime") return { label: "Overtime", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock };
    if (t === "daily_progress") return { label: "Daily Progress", cls: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20", icon: FileCheck2 };
    return { label: "Invoice", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: Receipt };
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card border-l border-border/70 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                <span>Unified Approvals Hub</span>
                {data && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-xs font-black">
                    {data.total_pending} Pending
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">1-Click Command Center for Leaves, Overtime, Daily Progress & Invoices</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchHub}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-6 py-3 border-b border-border/50 flex flex-wrap items-center justify-between gap-2 bg-muted/10">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: `All (${allItems.length})` },
              { id: "leave", label: `Leaves (${data?.leaves.length ?? 0})` },
              { id: "overtime", label: `Overtime (${data?.overtime.length ?? 0})` },
              { id: "daily_progress", label: `Progress (${data?.daily_progress.length ?? 0})` },
              { id: "invoice", label: `Invoices (${data?.invoices.length ?? 0})` },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-background text-muted-foreground hover:text-foreground border-border/60"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {visibleItems.length > 1 && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={handleBulkApprove}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>{bulkBusy ? "Approving..." : `Approve All (${visibleItems.length})`}</span>
            </button>
          )}
        </div>

        {/* Pending Queue List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && !data ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs font-bold">Loading pending approvals...</span>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCheck className="w-6 h-6" />
              </div>
              <p className="text-sm font-black text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground">No pending approvals in this category.</p>
            </div>
          ) : (
            visibleItems.map(item => {
              const badge = typeBadge(item.type);
              const Icon = badge.icon;
              const isBusy = busyId === item.id;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="p-4 rounded-2xl bg-background border border-border/60 hover:border-border shadow-2xs space-y-2.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border flex items-center gap-1", badge.cls)}>
                          <Icon className="w-3 h-3" />
                          {badge.label}
                        </span>
                        <span className="font-black text-sm text-foreground truncate">{item.employee_name}</span>
                        {item.department && (
                          <span className="text-[10px] font-semibold text-muted-foreground">• {item.department}</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-foreground/90 pt-1">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </div>

                  {item.reason && (
                    <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/40 line-clamp-2">
                      "{item.reason}"
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isBusy || bulkBusy}
                      onClick={() => handleAction(item, "reject")}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || bulkBusy}
                      onClick={() => handleAction(item, "approve")}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
