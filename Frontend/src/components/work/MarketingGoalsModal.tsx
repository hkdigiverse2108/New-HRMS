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
} from "lucide-react";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

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

  // Form draft
  const [title, setTitle] = useState("November Performance Milestone");
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

  useEffect(() => {
    if (isOpen) {
      loadGoals();
    }
  }, [isOpen, projectId]);

  const openAddForm = () => {
    setEditingGoal(null);
    setTitle(`${month} Performance Milestone`);
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
        title: title.trim() || `${month} Milestone`,
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
      setIsFormOpen(false);
      await loadGoals();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save milestone");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm("Are you sure you want to delete this marketing goal?")) return;
    try {
      await api.delete(`/projects/${projectId}/marketing-goals/${goalId}`);
      toast.success("Goal deleted");
      await loadGoals();
    } catch (err: any) {
      toast.error("Failed to delete goal");
    }
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
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Milestone_Report_${projectName.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Milestones exported to CSV!");
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={onClose}
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
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Add / Edit Form Drawer/Card */}
          {isFormOpen && (
            <div className="p-5 rounded-2xl bg-muted/30 border border-primary/30 shadow-sm space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span>{editingGoal ? "Edit Milestone Goal" : "Set New Performance Goal & Budget"}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveGoal} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                      Target Month (YYYY-MM) *
                    </label>
                    <input
                      type="month"
                      required
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                      Channel / Category *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="ALL">All Channels (Blended Full Retainer)</option>
                      <option value="META">Meta Ads (Facebook & Instagram)</option>
                      <option value="GOOGLE">Google Ads (Search & PMax)</option>
                      <option value="SEO">Organic SEO (Rankings & Traffic)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                      Target Ad Spend Budget (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={targetSpend}
                      onChange={(e) => setTargetSpend(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 50000"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-foreground font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                      Target Tracked Revenue (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={targetRevenue}
                      onChange={(e) => setTargetRevenue(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 250000"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-foreground font-mono font-bold text-emerald-600 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                      Target Leads / Conversions
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={targetLeads}
                      onChange={(e) => setTargetLeads(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 200"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-foreground font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-muted-foreground mb-1 uppercase text-[10px]">
                      Target ROAS Ratio
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={targetRoas}
                      onChange={(e) => setTargetRoas(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="e.g. 4.5"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-foreground font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                    />
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
                    placeholder="Specific strategy, offer tested, audience angle..."
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl border border-border/60 hover:bg-muted text-foreground text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
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
          ) : goals.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
                <Target className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-foreground text-base">No Milestones Set Yet</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Click "Set New Goal" above to define monthly budget spending targets and revenue goals. The system will automatically compare your daily campaign entries against your targets!
              </p>
              <button
                type="button"
                onClick={openAddForm}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition shadow-md"
              >
                + Set First Goal
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((g) => {
                const isAchieved = (g.revenue_pct || 0) >= 100 || (g.leads_pct || 0) >= 100;
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
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
                            {g.category}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">
                            Month: {g.month || "Any"}
                          </span>
                          {isAchieved ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Goal Achieved</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>In Progress</span>
                            </span>
                          )}
                        </div>
                        {g.notes && <p className="text-xs text-muted-foreground mt-1">{g.notes}</p>}
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => openEditForm(g)}
                          className="p-1.5 text-muted-foreground hover:text-primary rounded-lg transition"
                          title="Edit Goal"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGoal(g.id)}
                          className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-lg transition"
                          title="Delete Goal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Metrics Grid (4 Metric Comparison Boxes) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      {/* Metric 1: Budget Spending */}
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1.5">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
                          <span>Ad Spend Budget</span>
                          <CreditCard className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="font-mono font-black text-sm text-foreground">
                            {formatMoney(g.actual_spend)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
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
                        <p className="text-[10px] text-muted-foreground font-semibold">
                          {g.spend_pct || 0}% of budget spent
                        </p>
                      </div>

                      {/* Metric 2: Tracked Revenue */}
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1.5">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
                          <span>Revenue Target</span>
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="font-mono font-black text-sm text-emerald-600">
                            {formatMoney(g.actual_revenue)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
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
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1.5">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
                          <span>Leads / Results</span>
                          <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="font-mono font-black text-sm text-foreground">
                            {g.actual_leads?.toLocaleString() || 0}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            / {g.target_leads?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, g.leads_pct || 0)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-semibold">
                          {g.leads_pct || 0}% leads achieved
                        </p>
                      </div>

                      {/* Metric 4: ROAS Ratio */}
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1.5">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
                          <span>ROAS Ratio</span>
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="font-mono font-black text-sm text-amber-600">
                            {g.actual_roas || "0.00"}x
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Target: {g.target_roas || "0.0"}x
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{
                              width: `${Math.min(
                                100,
                                g.target_roas ? Math.round(((g.actual_roas || 0) / g.target_roas) * 100) : 0
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-semibold">
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
  );
};
