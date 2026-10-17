import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  Wallet,
  Target,
  BadgePercent,
  TrendingUp,
  LayoutGrid,
  BarChart2,
  PieChart as PieIcon,
  Printer,
  Download,
  X,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MarketingRecord } from "./DigitalMarketingOperations";

interface ExecutivePerformanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  companyName?: string | undefined;
  strategistName?: string | undefined;
  records: MarketingRecord[];
}

export const ExecutivePerformanceReportModal: React.FC<ExecutivePerformanceReportModalProps> = ({
  isOpen,
  onClose,
  clientName,
  companyName,
  strategistName = "OmniTrack Agency Lead",
  records,
}) => {
  // Retainer Category Selection: Meta, Google, SEO (user can pick 1, 2, or 3)
  const [selectedCategories, setSelectedCategories] = useState<{
    META: boolean;
    GOOGLE: boolean;
    SEO: boolean;
  }>({
    META: true,
    GOOGLE: true,
    SEO: true,
  });

  // Currency
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const USD_RATE = 0.012;

  const formatMoney = (amount: number) => {
    if (!amount || amount === 0) return currency === "INR" ? "₹0" : "$0";
    const val = currency === "INR" ? amount : amount * USD_RATE;
    const symbol = currency === "INR" ? "₹" : "$";
    return `${symbol}${Math.round(val).toLocaleString("en-IN")}`;
  };

  // Date Window Selection
  const [dateWindow, setDateWindow] = useState<"OCT_2026" | "LAST_30" | "Q3_2026" | "ALL">("OCT_2026");

  // Filter records based on selected categories
  const activeRecords = useMemo(() => {
    return records.filter(r => {
      if (r.category === "META" && !selectedCategories.META) return false;
      if (r.category === "GOOGLE" && !selectedCategories.GOOGLE) return false;
      if (r.category === "SEO" && !selectedCategories.SEO) return false;
      return true;
    });
  }, [records, selectedCategories]);

  // Aggregate Metrics
  const summary = useMemo(() => {
    const totalSpend = activeRecords.reduce((s, r) => s + (r.spend || 0), 0);
    const totalConversions = activeRecords.reduce((s, r) => s + (r.results || 0), 0);
    const blendedCpl = totalConversions > 0 ? Math.round(totalSpend / totalConversions) : 0;
    const totalRevenue = activeRecords.reduce((s, r) => s + (r.revenue || 0), 0);
    const roas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : "0.0";

    return {
      totalSpend,
      totalConversions,
      blendedCpl,
      totalRevenue,
      roas,
    };
  }, [activeRecords]);

  // Category counts
  const categoryCount = [selectedCategories.META, selectedCategories.GOOGLE, selectedCategories.SEO].filter(Boolean).length;

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  // Chart 1: Budget Allocation vs Tangible Deliverables
  const chartDeliverablesData = useMemo(() => {
    const list: any[] = [];
    if (selectedCategories.META) {
      const spend = activeRecords.filter(r => r.category === "META").reduce((s, r) => s + r.spend, 0);
      const res = activeRecords.filter(r => r.category === "META").reduce((s, r) => s + r.results, 0);
      list.push({
        channel: "Meta Ads",
        Spend: currency === "INR" ? spend : Math.round(spend * USD_RATE),
        Deliverables: res,
      });
    }
    if (selectedCategories.GOOGLE) {
      const spend = activeRecords.filter(r => r.category === "GOOGLE").reduce((s, r) => s + r.spend, 0);
      const res = activeRecords.filter(r => r.category === "GOOGLE").reduce((s, r) => s + r.results, 0);
      list.push({
        channel: "Google Ads",
        Spend: currency === "INR" ? spend : Math.round(spend * USD_RATE),
        Deliverables: res,
      });
    }
    if (selectedCategories.SEO) {
      const res = activeRecords.filter(r => r.category === "SEO").reduce((s, r) => s + r.results, 0);
      list.push({
        channel: "SEO Organic",
        Spend: 0,
        Deliverables: res,
      });
    }
    return list;
  }, [activeRecords, selectedCategories, currency]);

  // Chart 2: Conversion Source Mix
  const chartMixData = useMemo(() => {
    const list: any[] = [];
    if (selectedCategories.META) {
      const res = activeRecords.filter(r => r.category === "META").reduce((s, r) => s + r.results, 0);
      if (res > 0) list.push({ name: "Meta Ads", value: res, color: "#0668E1" });
    }
    if (selectedCategories.GOOGLE) {
      const res = activeRecords.filter(r => r.category === "GOOGLE").reduce((s, r) => s + r.results, 0);
      if (res > 0) list.push({ name: "Google Ads", value: res, color: "#EA4335" });
    }
    if (selectedCategories.SEO) {
      const res = activeRecords.filter(r => r.category === "SEO").reduce((s, r) => s + r.results, 0);
      if (res > 0) list.push({ name: "SEO Organic", value: res, color: "#10B981" });
    }
    return list.length > 0 ? list : [{ name: "No Conversions", value: 1, color: "#cbd5e1" }];
  }, [activeRecords, selectedCategories]);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[94vh] bg-background border-border/60 rounded-3xl p-0 overflow-y-auto shadow-2xl print:border-none print:shadow-none print:max-w-full print:w-full print:m-0 print:p-0">
        
        {/* NON-PRINT CONTROLS BAR */}
        <aside className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white p-4 print:hidden flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-xs">
              OT
            </div>
            <div>
              <h2 className="text-sm font-black text-white">Executive Client Performance Intelligence</h2>
              <p className="text-[11px] text-slate-400">Dynamic Multi-Category Retainer Reconciliation</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Category Retainer Multi-Select Toggles */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 p-1 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 px-1 uppercase">Scope:</span>
              <button
                type="button"
                onClick={() => setSelectedCategories(p => ({ ...p, META: !p.META }))}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold text-xs transition",
                  selectedCategories.META ? "bg-blue-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                )}
              >
                Meta {selectedCategories.META ? "✓" : ""}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategories(p => ({ ...p, GOOGLE: !p.GOOGLE }))}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold text-xs transition",
                  selectedCategories.GOOGLE ? "bg-red-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                )}
              >
                Google {selectedCategories.GOOGLE ? "✓" : ""}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategories(p => ({ ...p, SEO: !p.SEO }))}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold text-xs transition",
                  selectedCategories.SEO ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                )}
              >
                SEO {selectedCategories.SEO ? "✓" : ""}
              </button>
            </div>

            {/* Currency selector */}
            <div className="inline-flex rounded-xl p-0.5 bg-slate-800 border border-slate-700">
              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition",
                  currency === "INR" ? "bg-primary text-primary-foreground" : "text-slate-400 hover:text-white"
                )}
              >
                ₹ INR
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition",
                  currency === "USD" ? "bg-primary text-primary-foreground" : "text-slate-400 hover:text-white"
                )}
              >
                $ USD
              </button>
            </div>

            {/* Print / Save PDF Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition flex items-center gap-1.5 shadow-md shadow-primary/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Save PDF / Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </aside>

        {/* PRINTABLE EXECUTIVE REPORT CANVAS */}
        <div id="executiveReportCanvas" className="p-4 sm:p-8 space-y-8 bg-card text-foreground">
          
          {/* ================= 1. REPORT HERO HEADER ================= */}
          <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-7 sm:p-10 rounded-3xl relative overflow-hidden shadow-xl">
            <div className="relative z-10 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs tracking-wider uppercase mb-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Performance Intelligence Audit • Confidential Deliverable
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {companyName || clientName}
                  </h1>
                  <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                    <span>Client: <strong className="text-white">{clientName}</strong></span>
                    <span className="text-slate-600">•</span>
                    <span>Strategist: <strong className="text-white">{strategistName}</strong></span>
                    <span className="text-slate-600">•</span>
                    <span>Window: Active Contracted Period</span>
                  </p>
                </div>

                {/* Contracted Retainer Scope Badges */}
                <div className="flex flex-col sm:items-end gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    Contracted Retainer Scope
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedCategories.META && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Meta Ads
                      </span>
                    )}
                    {selectedCategories.GOOGLE && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                        Google Ads
                      </span>
                    )}
                    {selectedCategories.SEO && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Organic SEO
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-300 mt-0.5">
                    {categoryCount}-Category Retainer Stack
                  </span>
                </div>
              </div>

              {/* 4-PILLAR EXECUTIVE KPI BANNER */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Pillar 1: Total Ad Spend */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Total Media Spend</span>
                    <Wallet className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="mt-2">
                    <h3 className="text-2xl font-black text-white">{formatMoney(summary.totalSpend)}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Paid Channels Combined</p>
                  </div>
                </div>

                {/* Pillar 2: Total Results */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Total Inbound Conversions</span>
                    <Target className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-2">
                    <h3 className="text-2xl font-black text-white">{summary.totalConversions.toLocaleString()}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Qualified Leads & Sales</p>
                  </div>
                </div>

                {/* Pillar 3: Blended CPL */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Blended Cost / Acquisition</span>
                    <BadgePercent className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2">
                    <h3 className="text-2xl font-black text-emerald-400">{formatMoney(summary.blendedCpl)}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Average per verified result</p>
                  </div>
                </div>

                {/* Pillar 4: Tracked Return / Value */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Tracked Return / Yield</span>
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="mt-2">
                    <h3 className="text-2xl font-black text-blue-400">
                      {summary.totalRevenue > 0 ? formatMoney(summary.totalRevenue) : `${summary.roas}x`}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {summary.totalRevenue > 0 ? `ROAS: ${summary.roas}x` : "Direct Yield Rating"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= 2. CROSS-CHANNEL PERFORMANCE RECONCILIATION TABLE ================= */}
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-primary" />
                  Channel-by-Channel Performance Reconciliation
                </h2>
                <p className="text-xs text-muted-foreground">
                  Audited side-by-side metrics for active selected marketing channels
                </p>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground bg-muted border border-border/60 px-3 py-1 rounded-full w-fit">
                Normalized Performance Audit
              </span>
            </div>

            <div className="border border-border/60 rounded-3xl overflow-hidden shadow-sm bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/40 text-muted-foreground font-black uppercase text-[10px] tracking-wider border-b border-border/50">
                    <tr>
                      <th className="py-3 px-4">Channel Engine</th>
                      <th className="py-3 px-4">Contracted Activity / Sub-Type</th>
                      <th className="py-3 px-4 text-right">Ad Spend</th>
                      <th className="py-3 px-4 text-right">Traffic / Impressions</th>
                      <th className="py-3 px-4 text-right">Volume (Leads/Sales)</th>
                      <th className="py-3 px-4 text-right">Unit Efficiency</th>
                      <th className="py-3 px-4 text-right">Revenue / Rank</th>
                      <th className="py-3 px-4 text-center">ROI Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium text-foreground">
                    {activeRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground font-bold">
                          No records match selected channel scope. Enable Meta, Google or SEO above.
                        </td>
                      </tr>
                    ) : (
                      activeRecords.map(rec => (
                        <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-bold whitespace-nowrap">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                                rec.category === "META" && "bg-blue-500/10 text-blue-600 border border-blue-500/20",
                                rec.category === "GOOGLE" && "bg-red-500/10 text-red-600 border border-red-500/20",
                                rec.category === "SEO" && "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              )}
                            >
                              {rec.category === "META" ? "Meta Ads" : rec.category === "GOOGLE" ? "Google Ads" : "SEO Organic"}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-[220px] truncate" title={rec.subType}>
                            <p className="font-bold text-foreground truncate">{rec.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{rec.subType}</p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black">{formatMoney(rec.spend)}</td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {rec.category === "SEO" ? `${rec.clicks.toLocaleString()} sessions` : `${rec.impressions.toLocaleString()} impr`}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            {rec.results} {rec.resultLabel || "leads"}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {rec.cpl > 0 ? formatMoney(rec.cpl) : "—"}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                            {rec.revenue > 0 ? formatMoney(rec.revenue) : (rec.seoKeywordsTop3 > 0 ? `Top 3: #${rec.seoKeywordsTop3}` : "—")}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              HIGH YIELD
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ================= 3. CHARTS: BUDGET ALLOCATION & CONVERSION YIELD ================= */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Chart 1: Spend vs Volume */}
            <div className="bg-card p-5 rounded-3xl border border-border/60 shadow-sm md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-primary" />
                    Budget Allocation vs Tangible Deliverables
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Invested media spend vs verified inbound inquiries / sales</p>
                </div>
                <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                  Comparative Yield
                </span>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDeliverablesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="channel" tick={{ fontSize: 11, fontWeight: "bold" }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--card)", borderRadius: "1rem", border: "1px solid var(--border)", fontSize: "11px" }}
                    />
                    <Bar dataKey="Spend" fill="#0668E1" radius={[6, 6, 0, 0]} maxBarSize={48} />
                    <Bar dataKey="Deliverables" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Source Mix */}
            <div className="bg-card p-5 rounded-3xl border border-border/60 shadow-sm flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-indigo-500" />
                  Conversion Source Mix
                </h3>
                <p className="text-[11px] text-muted-foreground">Share of inquiries by channel</p>
              </div>
              <div className="h-44 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartMixData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value">
                      {chartMixData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderRadius: "1rem", border: "1px solid var(--border)", fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold text-muted-foreground">
                <span>Mix across active channels</span>
              </div>
            </div>
          </section>

          {/* ================= 4. EXECUTIVE TAKEAWAYS & NEXT MONTH ROADMAP ================= */}
          <section className="bg-muted/20 border border-border/60 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Strategic Optimization Findings & Next Steps
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-1">
                <h4 className="font-bold text-foreground">1. Paid Media Scale & Funnel Efficiency</h4>
                <p className="text-muted-foreground">
                  Inbound lead volume achieved strong stability. Recommend testing incremental scaling of top-performing ad sets by 15-20% into next month.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-1">
                <h4 className="font-bold text-foreground">2. Organic Search & Keyword Positioning</h4>
                <p className="text-muted-foreground">
                  Top 3 podium rankings climbed across core target commercial intent queries. Continue authority cluster backlinks and FAQ schema indexing.
                </p>
              </div>
            </div>
          </section>

          {/* Report Footer */}
          <div className="pt-6 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <p>Generated via OmniTrack Enterprise Reporting System • Confidential Agency Client Deliverable</p>
            <p>Audit Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
