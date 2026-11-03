import React, { useState, useEffect, useMemo } from "react";
import {
  Target,
  Plus,
  Save,
  Trash2,
  Edit2,
  Calendar,
  CreditCard,
  TrendingUp,
  UserCheck,
  Award,
  X,
  Printer,
  Download,
  Sparkles,
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Search,
  ChevronDown,
  Check,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface MarketingGoalItem {
  id: string;
  title: string;
  category: "ALL" | "META" | "GOOGLE" | "SEO";
  sub_type?: string;
  month?: string; // YYYY-MM
  start_date?: string;
  end_date?: string;
  target_spend: number;
  target_revenue: number;
  target_leads: number;
  target_roas: number;
  notes?: string;
  created_at?: string;
  created_by?: string;

  // Computed from actuals
  actual_spend?: number;
  actual_revenue?: number;
  actual_leads?: number;
  actual_roas?: number;
  spend_pct?: number;
  revenue_pct?: number;
  leads_pct?: number;
  status?: "achieved" | "on_track" | "in_progress";
}

interface MarketingGoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  clientName?: string | undefined;
  currency?: "INR" | "USD" | undefined;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatMonthLabel(monthStr?: string) {
  if (!monthStr || !monthStr.includes("-")) return monthStr || "Any Month";
  const parts = monthStr.split("-");
  const y = parts[0] || "";
  const m = parts[1] || "";
  const monthIdx = parseInt(m, 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${MONTHS_FULL[monthIdx]} ${y}`;
  }
  return monthStr;
}

interface MonthPickerProps {
  value: string; // YYYY-MM
  onChange: (val: string) => void;
  className?: string;
}

const MonthPicker: React.FC<MonthPickerProps> = ({ value, onChange, className }) => {
  const [open, setOpen] = useState(false);
  const initialYear = useMemo(() => {
    if (value && value.includes("-")) {
      const parts = value.split("-");
      const parsed = parseInt(parts[0] || "", 10);
      if (!isNaN(parsed)) return parsed;
    }
    return new Date().getFullYear();
  }, [value]);

  const [viewYear, setViewYear] = useState(initialYear);

  useEffect(() => {
    if (value && value.includes("-")) {
      const parts = value.split("-");
      const parsed = parseInt(parts[0] || "", 10);
      if (!isNaN(parsed)) setViewYear(parsed);
    }
  }, [value]);

  const selectedMonthIdx = useMemo(() => {
    if (!value || !value.includes("-")) return -1;
    const parts = value.split("-");
    const yStr = parts[0] || "";
    const mStr = parts[1] || "";
    if (parseInt(yStr, 10) === viewYear) {
      return parseInt(mStr, 10) - 1;
    }
    return -1;
  }, [value, viewYear]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-9 px-3 rounded-xl border flex items-center justify-between gap-2 transition text-xs font-semibold cursor-pointer w-full bg-background border-border/60 hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary shadow-xs",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className={value ? "text-foreground font-bold" : "text-muted-foreground"}>
              {value ? formatMonthLabel(value) : "Select target month..."}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 p-3 rounded-2xl border border-border/70 shadow-2xl bg-card z-[320] overflow-hidden"
      >
        {/* Year Navigator */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
          <button
            type="button"
            onClick={() => setViewYear((y) => y - 1)}
            className="p-1 px-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground font-bold transition cursor-pointer"
          >
            ←
          </button>
          <span className="font-black text-sm text-foreground">{viewYear}</span>
          <button
            type="button"
            onClick={() => setViewYear((y) => y + 1)}
            className="p-1 px-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground font-bold transition cursor-pointer"
          >
            →
          </button>
        </div>

        {/* 12 Months Grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS_SHORT.map((mShort, idx) => {
            const isSelected = selectedMonthIdx === idx;
            const monthVal = `${viewYear}-${String(idx + 1).padStart(2, "0")}`;
            return (
              <button
                key={mShort}
                type="button"
                onClick={() => {
                  onChange(monthVal);
                  setOpen(false);
                }}
                className={cn(
                  "py-2 rounded-xl text-xs font-bold transition cursor-pointer text-center",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {mShort}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const CATEGORY_OPTIONS = [
  { value: "ALL", label: "All Channels", desc: "Blended Retainer", theme: "indigo" },
  { value: "META", label: "Meta Ads", desc: "Facebook & IG", theme: "blue" },
  { value: "GOOGLE", label: "Google Ads", desc: "Search & PMax", theme: "emerald" },
  { value: "SEO", label: "Organic SEO", desc: "Rank & Traffic", theme: "purple" },
] as const;

export const MarketingGoalsModal: React.FC<MarketingGoalsModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  clientName,
  currency = "INR",
}) => {
  const [goals, setGoals] = useState<MarketingGoalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingGoal, setEditingGoal] = useState<MarketingGoalItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Filter state
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Confirm delete goal state
  const [deleteGoalConfirm, setDeleteGoalConfirm] = useState<{
    isOpen: boolean;
    goalId: string;
    goalTitle: string;
  }>({
    isOpen: false,
    goalId: "",
    goalTitle: "",
  });

  // Form draft
  const [title, setTitle] = useState("Performance Milestone");
  const [category, setCategory] = useState<"ALL" | "META" | "GOOGLE" | "SEO">("ALL");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [targetSpend, setTargetSpend] = useState<number | "">("");
  const [targetRevenue, setTargetRevenue] = useState<number | "">("");
  const [targetLeads, setTargetLeads] = useState<number | "">("");
  const [targetRoas, setTargetRoas] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const currencySymbol = currency === "USD" ? "$" : "₹";

  const formatMoney = (val?: number) => {
    const num = val || 0;
    if (currency === "USD") {
      return `$${Math.round(num * 0.012).toLocaleString()}`;
    }
    return `₹${Math.round(num).toLocaleString("en-IN")}`;
  };

  const loadGoals = async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      const res = await api.get<{ status: string; data: MarketingGoalItem[] }>(
        `/projects/${projectId}/marketing-goals`
      );
      if (res?.data && Array.isArray(res.data)) {
        setGoals(res.data);
      }
    } catch (err: any) {
      toast.error("Failed to load marketing goals");
    } finally {
      setIsLoading(false);
    }
  };

  const resetDraftForm = () => {
    setIsFormOpen(false);
    setEditingGoal(null);
    const d = new Date();
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setTitle("Performance Milestone");
    setCategory("ALL");
    setTargetSpend("");
    setTargetRevenue("");
    setTargetLeads("");
    setTargetRoas("");
    setNotes("");
    setSearchQuery("");
    setSelectedChannelFilter("ALL");
  };

  const handleModalClose = () => {
    resetDraftForm();
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      resetDraftForm();
      loadGoals();
    } else {
      resetDraftForm();
    }
  }, [isOpen, projectId]);

  const openAddForm = () => {
    setEditingGoal(null);
    setTitle(`${formatMonthLabel(month)} Milestone`);
    setCategory("ALL");
    setTargetSpend("");
    setTargetRevenue("");
    setTargetLeads("");
    setTargetRoas("");
    setNotes("");
    setIsFormOpen(true);
  };

  const openEditForm = (goal: MarketingGoalItem) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setCategory(goal.category);
    setMonth(goal.month || "");
    setTargetSpend(goal.target_spend || "");
    setTargetRevenue(goal.target_revenue || "");
    setTargetLeads(goal.target_leads || "");
    setTargetRoas(goal.target_roas || "");
    setNotes(goal.notes || "");
    setIsFormOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    try {
      setIsSubmitting(true);
      const payload = {
        title: title.trim() || `${formatMonthLabel(month)} Milestone`,
        category,
        month,
        target_spend: Number(targetSpend) || 0,
        target_revenue: Number(targetRevenue) || 0,
        target_leads: Number(targetLeads) || 0,
        target_roas: Number(targetRoas) || 0,
        notes: notes.trim(),
      };

      if (editingGoal) {
        await api.put(`/projects/${projectId}/marketing-goals/${editingGoal.id}`, payload);
        toast.success("Goal milestone updated!");
      } else {
        await api.post(`/projects/${projectId}/marketing-goals`, payload);
        toast.success("New goal milestone created!");
      }
      resetDraftForm();
      await loadGoals();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save milestone");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDeleteGoal = (goalId: string, goalTitle: string) => {
    setDeleteGoalConfirm({
      isOpen: true,
      goalId,
      goalTitle,
    });
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (goals.length === 0) {
      toast.error("No goals available to export");
      return;
    }
    const headers = [
      "Milestone Title",
      "Month",
      "Category",
      "Target Spend",
      "Actual Spend",
      "Target Revenue",
      "Actual Revenue",
      "Revenue Achieved %",
      "Target Leads",
      "Actual Leads",
      "Status",
    ];
    const rows = goals.map((g) => [
      `"${g.title}"`,
      g.month || "",
      g.category,
      g.target_spend,
      g.actual_spend || 0,
      g.target_revenue,
      g.actual_revenue || 0,
      `${g.revenue_pct || 0}%`,
      g.target_leads,
      g.actual_leads || 0,
      g.status || "in_progress",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Milestone_Report_${projectName.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Milestones exported to CSV!");
  };

  // KPI calculations
  const totalTargetSpend = useMemo(
    () => goals.reduce((acc, g) => acc + (g.target_spend || 0), 0),
    [goals]
  );
  const totalActualSpend = useMemo(
    () => goals.reduce((acc, g) => acc + (g.actual_spend || 0), 0),
    [goals]
  );
  const totalTargetRevenue = useMemo(
    () => goals.reduce((acc, g) => acc + (g.target_revenue || 0), 0),
    [goals]
  );
  const totalActualRevenue = useMemo(
    () => goals.reduce((acc, g) => acc + (g.actual_revenue || 0), 0),
    [goals]
  );
  const totalAchievedCount = useMemo(
    () =>
      goals.filter((g) => (g.revenue_pct || 0) >= 100 || (g.leads_pct || 0) >= 100).length,
    [goals]
  );

  // Filtered goals
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      if (selectedChannelFilter !== "ALL" && g.category !== selectedChannelFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = g.title.toLowerCase().includes(q);
        const matchesMonth = (g.month || "").toLowerCase().includes(q);
        const matchesNotes = (g.notes || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesMonth && !matchesNotes) return false;
      }
      return true;
    });
  }, [goals, selectedChannelFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[280] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
        onClick={handleModalClose}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xs" />
        <div
          className="relative z-10 w-full max-w-5xl bg-card border border-border/80 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold shrink-0 shadow-sm">
                <Target className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground truncate">
                    Marketing Milestones & Target Goals
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
                    Target vs Actual
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {projectName} {clientName ? `• ${clientName}` : ""} • Set budget & revenue targets month-wise & channel-wise
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrintReport}
                className="px-3 py-1.5 rounded-xl border border-border/60 hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                title="Print Milestone Report"
              >
                <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Print</span>
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl border border-border/60 hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                type="button"
                onClick={openAddForm}
                className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Set New Goal</span>
              </button>
              <button
                type="button"
                onClick={handleModalClose}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Executive KPI Summary Strip */}
          <div className="px-5 sm:px-6 py-3.5 bg-muted/10 border-b border-border/40 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 shrink-0">
            <div className="p-2.5 sm:p-3 rounded-xl bg-card border border-border/50 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase mb-1">
                <span>Total Goals</span>
                <Target className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-foreground">{goals.length}</span>
                <span className="text-[10px] font-semibold text-emerald-600">
                  {totalAchievedCount} achieved
                </span>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-card border border-border/50 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase mb-1">
                <span>Budget Spent</span>
                <CreditCard className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex items-baseline gap-1.5 truncate">
                <span className="text-lg font-black text-foreground font-mono">
                  {formatMoney(totalActualSpend)}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  / {formatMoney(totalTargetSpend)}
                </span>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-card border border-border/50 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase mb-1">
                <span>Revenue Delivered</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-1.5 truncate">
                <span className="text-lg font-black text-emerald-600 font-mono">
                  {formatMoney(totalActualRevenue)}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  / {formatMoney(totalTargetRevenue)}
                </span>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-card border border-border/50 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase mb-1">
                <span>Blended ROAS</span>
                <Award className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-amber-600 font-mono">
                  {totalActualSpend > 0 ? (totalActualRevenue / totalActualSpend).toFixed(2) : "0.00"}x
                </span>
                <span className="text-[10px] text-muted-foreground">across all ads</span>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="px-5 sm:px-6 py-2.5 border-b border-border/40 bg-card flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            {/* Channel Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedChannelFilter("ALL")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0",
                  selectedChannelFilter === "ALL"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                All Channels ({goals.length})
              </button>
              {CATEGORY_OPTIONS.filter((c) => c.value !== "ALL").map((c) => {
                const count = goals.filter((g) => g.category === c.value).length;
                const isSelected = selectedChannelFilter === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSelectedChannelFilter(c.value)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {c.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[180px] max-w-[240px]">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search milestones..."
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-xl bg-muted/40 border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Add / Edit Form Card */}
            {isFormOpen && (
              <div className="p-5 rounded-2xl bg-muted/30 border border-primary/30 shadow-md space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span>{editingGoal ? "Edit Milestone Goal" : "Set New Performance Goal & Budget"}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={resetDraftForm}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveGoal} className="space-y-4 text-xs">
                  {/* Channel / Category Segmented Buttons */}
                  <div>
                    <label className="block font-bold text-muted-foreground mb-1.5 uppercase text-[10px]">
                      Select Target Channel / Category *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CATEGORY_OPTIONS.map((opt) => {
                        const isSelected = category === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setCategory(opt.value)}
                            className={cn(
                              "p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between",
                              isSelected
                                ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40 font-bold"
                                : "border-border/60 bg-background hover:bg-muted/50 font-medium"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-foreground">{opt.label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </div>
                            <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Title & Target Month Pickers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                        Milestone Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. November Meta Scaling"
                        className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary h-9 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                        Target Month *
                      </label>
                      <MonthPicker value={month} onChange={(val) => setMonth(val)} />
                    </div>
                  </div>

                  {/* 4 Performance Metric Target Inputs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                        Target Ad Spend Budget *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-xs">
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={targetSpend}
                          onChange={(e) =>
                            setTargetSpend(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          placeholder="e.g. 50000"
                          className="w-full pl-7 pr-3 py-2 rounded-xl bg-background border border-border/60 text-foreground font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary h-9 shadow-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                        Target Revenue *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-xs">
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={targetRevenue}
                          onChange={(e) =>
                            setTargetRevenue(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          placeholder="e.g. 250000"
                          className="w-full pl-7 pr-3 py-2 rounded-xl bg-background border border-border/60 text-emerald-600 font-mono font-black focus:outline-none focus:ring-1 focus:ring-primary h-9 shadow-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                        Target Leads / Results
                      </label>
                      <div className="relative">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="number"
                          min="0"
                          value={targetLeads}
                          onChange={(e) =>
                            setTargetLeads(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          placeholder="e.g. 200"
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-background border border-border/60 text-foreground font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary h-9 shadow-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                        Target ROAS Multiplier
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 font-black text-xs">
                          x
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={targetRoas}
                          onChange={(e) =>
                            setTargetRoas(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          placeholder="e.g. 4.5"
                          className="w-full pl-7 pr-3 py-2 rounded-xl bg-background border border-border/60 text-amber-600 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary h-9 shadow-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                      Milestone Strategy Notes
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Specific offer tested, audience angle, ROAS strategy..."
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none shadow-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={resetDraftForm}
                      className="px-4 py-2 rounded-xl border border-border/60 hover:bg-muted text-foreground text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>{editingGoal ? "Update Goal" : "Save Goal"}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Goals Cards List (Target vs Actual) */}
            {isLoading ? (
              <div className="py-16 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Calculating live actuals vs goals...</span>
              </div>
            ) : filteredGoals.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
                  <Target className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-foreground text-base">
                  {searchQuery || selectedChannelFilter !== "ALL"
                    ? "No Milestones Match Your Filter"
                    : "No Milestones Set Yet"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {searchQuery || selectedChannelFilter !== "ALL"
                    ? "Try clearing your search query or selecting 'All Channels'."
                    : "Click 'Set New Goal' above to define monthly budget spending targets and revenue goals. The system will automatically compare your daily campaign entries against your targets!"}
                </p>
                <button
                  type="button"
                  onClick={openAddForm}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition shadow-md cursor-pointer"
                >
                  + Set Milestone Goal
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGoals.map((g) => {
                  const isAchieved =
                    (g.revenue_pct || 0) >= 100 || (g.leads_pct || 0) >= 100;
                  const isOverBudget =
                    g.target_spend > 0 && (g.actual_spend || 0) > g.target_spend;

                  return (
                    <div
                      key={g.id}
                      className="bg-card border border-border/60 hover:border-indigo-500/30 rounded-2xl p-5 shadow-sm space-y-4 transition-all"
                    >
                      {/* Top Row: Title, Month, Channel & Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-sm text-foreground">{g.title}</h4>
                            <span
                              className={cn(
                                "px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border",
                                g.category === "META"
                                  ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                                  : g.category === "GOOGLE"
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                  : g.category === "SEO"
                                  ? "bg-purple-500/10 text-purple-700 border-purple-500/20"
                                  : "bg-indigo-500/10 text-indigo-700 border-indigo-500/20"
                              )}
                            >
                              {g.category}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatMonthLabel(g.month)}</span>
                            </span>
                            {isAchieved ? (
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Goal Achieved</span>
                              </span>
                            ) : isOverBudget ? (
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Over Budget</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>In Progress</span>
                              </span>
                            )}
                          </div>
                          {g.notes && (
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                              {g.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => openEditForm(g)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition cursor-pointer"
                            title="Edit Goal"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteGoal(g.id, g.title)}
                            className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                            title="Delete Goal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Progress Metrics Grid (4 Metric Comparison Boxes) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        {/* Metric 1: Budget Spending */}
                        <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 space-y-1.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
                            <span>Ad Spend Budget</span>
                            <CreditCard className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className="font-mono font-black text-sm text-foreground">
                              {formatMoney(g.actual_spend)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              / {formatMoney(g.target_spend)}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                (g.spend_pct || 0) > 100 ? "bg-rose-500" : "bg-primary"
                              )}
                              style={{ width: `${Math.min(100, g.spend_pct || 0)}%` }}
                            />
                          </div>
                          <p
                            className={cn(
                              "text-[10px] font-bold",
                              (g.spend_pct || 0) > 100 ? "text-rose-600" : "text-muted-foreground"
                            )}
                          >
                            {g.spend_pct || 0}% of budget spent
                          </p>
                        </div>

                        {/* Metric 2: Tracked Revenue */}
                        <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 space-y-1.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
                            <span>Revenue Target</span>
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className="font-mono font-black text-sm text-emerald-600">
                              {formatMoney(g.actual_revenue)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              / {formatMoney(g.target_revenue)}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, g.revenue_pct || 0)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-emerald-700 font-bold">
                            {g.revenue_pct || 0}% goal delivered!
                          </p>
                        </div>

                        {/* Metric 3: Paid Leads */}
                        <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 space-y-1.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
                            <span>Leads / Results</span>
                            <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className="font-mono font-black text-sm text-foreground">
                              {g.actual_leads?.toLocaleString() || 0}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              / {g.target_leads?.toLocaleString() || 0}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, g.leads_pct || 0)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground font-bold">
                            {g.leads_pct || 0}% leads achieved
                          </p>
                        </div>

                        {/* Metric 4: ROAS Ratio */}
                        <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 space-y-1.5">
                          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
                            <span>ROAS Multiplier</span>
                            <Award className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className="font-mono font-black text-sm text-amber-600">
                              {g.actual_roas || "0.00"}x
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              Target: {g.target_roas || "0.0"}x
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  g.target_roas
                                    ? Math.round(((g.actual_roas || 0) / g.target_roas) * 100)
                                    : 0
                                )}%`,
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground font-bold">
                            Return on Ad Spend
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Target vs Actual metrics automatically sync from your daily campaign logs</span>
            </div>
            <button
              type="button"
              onClick={openAddForm}
              className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow-sm cursor-pointer"
            >
              + Add Milestone
            </button>
          </div>
        </div>
      </div>

      {/* Delete Goal Confirm Modal */}
      <ConfirmModal
        isOpen={deleteGoalConfirm.isOpen}
        onClose={() => setDeleteGoalConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={async () => {
          const goalId = deleteGoalConfirm.goalId;
          setDeleteGoalConfirm((prev) => ({ ...prev, isOpen: false }));
          try {
            await api.delete(`/projects/${projectId}/marketing-goals/${goalId}`);
            toast.success("Marketing milestone deleted");
            await loadGoals();
          } catch (err: any) {
            toast.error("Failed to delete goal");
          }
        }}
        title="Delete Marketing Milestone"
        description="Are you sure you want to delete this marketing milestone? Target budget, ROAS, and all performance progress will be removed."
        itemName={deleteGoalConfirm.goalTitle}
        confirmText="Delete Milestone"
        variant="destructive"
      />
    </>
  );
};
