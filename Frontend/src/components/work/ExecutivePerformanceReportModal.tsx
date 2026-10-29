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
  Search,
  Compass,
  ArrowUpRight,
  Loader2,
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
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/lib/toast";
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
  strategistName = "OmniTrack Growth Lead",
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

  // Date Timeframe Selection: default is "ALL" ("All Recorded Dates")
  const [timeframe, setTimeframe] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Loading states for actions to prevent multiple clicks
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Currency
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const USD_RATE = 0.012; // 1 INR ~ 0.012 USD (or ~83 INR/USD)

  const formatMoney = (amount: number) => {
    if (!amount || amount === 0) return currency === "INR" ? "₹0" : "$0";
    const val = currency === "INR" ? amount : amount * USD_RATE;
    const symbol = currency === "INR" ? "₹" : "$";
    return `${symbol}${Math.round(val).toLocaleString("en-IN")}`;
  };

  // Filter records based on selected categories AND date timeframe
  const activeRecords = useMemo(() => {
    return records.filter(r => {
      // Category filter
      if (r.category === "META" && !selectedCategories.META) return false;
      if (r.category === "GOOGLE" && !selectedCategories.GOOGLE) return false;
      if (r.category === "SEO" && !selectedCategories.SEO) return false;

      // Timeframe filter
      if (timeframe !== "ALL" && r.date) {
        const today = new Date();
        const rDate = new Date(r.date);
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        if (timeframe === "TODAY") {
          const tStr = today.toISOString().slice(0, 10);
          if (r.date !== tStr) return false;
        } else if (timeframe === "YESTERDAY") {
          const y = new Date(todayStart);
          y.setDate(y.getDate() - 1);
          const yStr = y.toISOString().slice(0, 10);
          if (r.date !== yStr) return false;
        } else if (timeframe === "LAST_7") {
          const past7 = new Date(todayStart);
          past7.setDate(past7.getDate() - 7);
          const past7Str = past7.toISOString().slice(0, 10);
          if (r.date < past7Str) return false;
        } else if (timeframe === "LAST_30") {
          const past30 = new Date(todayStart);
          past30.setDate(past30.getDate() - 30);
          const past30Str = past30.toISOString().slice(0, 10);
          if (r.date < past30Str) return false;
        } else if (timeframe === "THIS_MONTH") {
          const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const mStr = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, "0")}-01`;
          if (r.date < mStr) return false;
        } else if (timeframe === "LAST_MONTH") {
          const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
          const pStartStr = `${prevMonthStart.getFullYear()}-${String(prevMonthStart.getMonth() + 1).padStart(2, "0")}-01`;
          const pEndStr = `${prevMonthEnd.getFullYear()}-${String(prevMonthEnd.getMonth() + 1).padStart(2, "0")}-${String(prevMonthEnd.getDate()).padStart(2, "0")}`;
          if (r.date < pStartStr || r.date > pEndStr) return false;
        } else if (timeframe === "CUSTOM") {
          if (startDate && r.date < startDate) return false;
          if (endDate && r.date > endDate) return false;
        }
      }

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, selectedCategories, timeframe, startDate, endDate]);

  // Dynamic Reporting Window Label
  const windowLabel = useMemo(() => {
    if (timeframe === "ALL") {
      if (activeRecords.length > 0) {
        const dates = activeRecords.map(r => r.date).filter(Boolean).sort();
        if (dates.length > 0) {
          const first = dates[0];
          const last = dates[dates.length - 1];
          if (first === last) return `Date: ${first}`;
          return `All Recorded History (${first} to ${last})`;
        }
      }
      return "All Recorded History";
    }
    if (timeframe === "TODAY") {
      const todayStr = new Date().toISOString().split("T")[0] || "";
      return `Today (${todayStr})`;
    }
    if (timeframe === "YESTERDAY") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split("T")[0] || "";
      return `Yesterday (${yStr})`;
    }
    if (timeframe === "LAST_7") return "Trailing 7 Days";
    if (timeframe === "LAST_30") return "Trailing 30 Days";
    if (timeframe === "THIS_MONTH") {
      const now = new Date();
      return `Current Month (${now.toLocaleString("en-US", { month: "long", year: "numeric" })})`;
    }
    if (timeframe === "LAST_MONTH") {
      const prev = new Date();
      prev.setMonth(prev.getMonth() - 1);
      return `Previous Month (${prev.toLocaleString("en-US", { month: "long", year: "numeric" })})`;
    }
    if (timeframe === "CUSTOM") {
      if (startDate && endDate) return `Custom: ${startDate} to ${endDate}`;
      if (startDate) return `From: ${startDate}`;
      if (endDate) return `Until: ${endDate}`;
      return "Custom Date Range";
    }
    return "All Recorded History";
  }, [timeframe, startDate, endDate, activeRecords]);

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

  // Meta specific metrics
  const metaMetrics = useMemo(() => {
    const metaList = activeRecords.filter(r => r.category === "META");
    const spend = metaList.reduce((s, r) => s + (r.spend || 0), 0);
    const impr = metaList.reduce((s, r) => s + (r.impressions || 0), 0);
    const clicks = metaList.reduce((s, r) => s + (r.clicks || 0), 0);
    const results = metaList.reduce((s, r) => s + (r.results || 0), 0);
    const rev = metaList.reduce((s, r) => s + (r.revenue || 0), 0);
    const cpl = results > 0 ? Math.round(spend / results) : 0;
    const ctr = impr > 0 ? ((clicks / impr) * 100).toFixed(2) : "0.00";
    const roas = spend > 0 ? (rev / spend).toFixed(2) : "0.0";
    return { list: metaList, spend, impr, clicks, results, rev, cpl, ctr, roas };
  }, [activeRecords]);

  // Google specific metrics
  const googleMetrics = useMemo(() => {
    const gList = activeRecords.filter(r => r.category === "GOOGLE");
    const spend = gList.reduce((s, r) => s + (r.spend || 0), 0);
    const clicks = gList.reduce((s, r) => s + (r.clicks || 0), 0);
    const conv = gList.reduce((s, r) => s + (r.results || 0), 0);
    const rev = gList.reduce((s, r) => s + (r.revenue || 0), 0);
    const cpc = clicks > 0 ? Math.round(spend / clicks) : 0;
    const convRate = clicks > 0 ? ((conv / clicks) * 100).toFixed(2) : "0.00";
    const roas = spend > 0 ? (rev / spend).toFixed(2) : "0.0";
    return { list: gList, spend, clicks, conv, rev, cpc, convRate, roas };
  }, [activeRecords]);

  // SEO specific metrics
  const seoMetrics = useMemo(() => {
    const seoList = activeRecords.filter(r => r.category === "SEO");
    const sessions = seoList.reduce((s, r) => s + (r.clicks || r.impressions || 0), 0);
    const leads = seoList.reduce((s, r) => s + (r.results || 0), 0);
    const top3 = seoList.reduce((s, r) => s + (r.seoKeywordsTop3 || 0), 0);
    const top10 = seoList.reduce((s, r) => s + (r.seoKeywordsTop10 || 0), 0);
    const rev = seoList.reduce((s, r) => s + (r.revenue || 0), 0);
    return { list: seoList, sessions, leads, top3, top10, rev };
  }, [activeRecords]);

  // Category counts
  const categoryCount = [selectedCategories.META, selectedCategories.GOOGLE, selectedCategories.SEO].filter(Boolean).length;

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
    return list.length > 0 ? list : [{ name: "Active Retainer", value: 1, color: "#cbd5e1" }];
  }, [activeRecords, selectedCategories]);

  // Standalone HTML Report Generator (matches executive_client_performance_report.html)
  const generateStandaloneHtmlReport = () => {
    const displayName = companyName || clientName || "Client Performance";
    const dateStamp = formatDate(new Date());
    const sym = currency === "INR" ? "₹" : "$";

    const formatVal = (amt: number) => {
      if (!amt || amt === 0) return `${sym}0`;
      const val = currency === "INR" ? amt : amt * USD_RATE;
      return `${sym}${Math.round(val).toLocaleString("en-IN")}`;
    };

    // Table rows
    const tableRows = activeRecords.length === 0
      ? `<tr><td colspan="8" style="padding: 24px; text-align: center; color: #64748b; font-weight: 600;">No performance data records matching selected scope and date filter.</td></tr>`
      : activeRecords.map(r => {
        const catBadge = r.category === "META"
          ? `<span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 9999px; font-weight: 800; font-size: 10px; text-transform: uppercase;">Meta Ads</span>`
          : r.category === "GOOGLE"
          ? `<span style="background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 2px 8px; border-radius: 9999px; font-weight: 800; font-size: 10px; text-transform: uppercase;">Google Ads</span>`
          : `<span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 9999px; font-weight: 800; font-size: 10px; text-transform: uppercase;">SEO Organic</span>`;

        const trafficText = r.category === "SEO"
          ? `${(r.clicks || r.impressions || 0).toLocaleString()} sessions`
          : `${(r.impressions || 0).toLocaleString()} impr`;

        const returnText = r.revenue > 0
          ? `<span style="color: #059669; font-weight: bold;">${formatVal(r.revenue)}</span>`
          : (r.seoKeywordsTop3 > 0 ? `<span style="color: #059669; font-weight: bold;">Top 3: #${r.seoKeywordsTop3}</span>` : "—");

        return `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 16px; white-space: nowrap;">${catBadge}</td>
            <td style="padding: 12px 16px;">
              <div style="font-weight: 700; color: #0f172a;">${r.name || "Campaign Asset"}</div>
              <div style="font-size: 10px; color: #64748b;">${r.subType || "Core Deliverable"} • ${r.date || "—"}</div>
            </td>
            <td style="padding: 12px 16px; text-align: right; font-weight: 800; font-family: monospace;">${formatVal(r.spend || 0)}</td>
            <td style="padding: 12px 16px; text-align: right; color: #64748b; font-family: monospace;">${trafficText}</td>
            <td style="padding: 12px 16px; text-align: right; font-weight: 800; font-family: monospace;">${(r.results || 0).toLocaleString()} ${r.resultLabel || "leads"}</td>
            <td style="padding: 12px 16px; text-align: right; color: #64748b; font-family: monospace;">${r.cpl > 0 ? formatVal(r.cpl) : "—"}</td>
            <td style="padding: 12px 16px; text-align: right;">${returnText}</td>
            <td style="padding: 12px 16px; text-align: center;">
              <span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 9999px; font-weight: 800; font-size: 9px;">VERIFIED</span>
            </td>
          </tr>
        `;
      }).join("");

    // Scope badges
    const scopeBadges = [
      selectedCategories.META ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">Meta Ads</span>` : "",
      selectedCategories.GOOGLE ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">Google Ads</span>` : "",
      selectedCategories.SEO ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Organic SEO</span>` : "",
    ].filter(Boolean).join(" ");

    const chartLabels = chartDeliverablesData.map(d => d.channel);
    const chartSpend = chartDeliverablesData.map(d => d.Spend);
    const chartRes = chartDeliverablesData.map(d => d.Deliverables);

    const mixLabels = chartMixData.map(d => d.name);
    const mixValues = chartMixData.map(d => d.value);
    const mixColors = chartMixData.map(d => d.color);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${displayName} - Executive Client Performance Intelligence Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    @media print {
      .no-print { display: none !important; }
      body { background-color: #ffffff !important; color: #0f172a !important; padding: 0 !important; }
      .page-container { max-width: 100% !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
      .avoid-break { break-inside: avoid; page-break-inside: avoid; }
      .force-print-border { border: 1px solid #e2e8f0 !important; }
    }
  </style>
</head>
<body class="bg-slate-100 text-slate-900 min-h-screen flex flex-col antialiased">
  
  <!-- Print & Download Control Bar -->
  <aside class="no-print sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-md">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3 text-white">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-xs">OT</div>
        <span class="text-sm font-bold">Executive Intelligence Audit</span>
        <span class="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">Client Deliverable</span>
      </div>
      <div class="flex items-center gap-2">
        <button id="standalonePrintBtn" onclick="triggerStandalonePrint()" class="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer">
          <i data-lucide="printer" class="w-3.5 h-3.5"></i>
          <span id="standalonePrintBtnText">Save PDF / Print</span>
        </button>
      </div>
    </div>
  </aside>

  <!-- Report Canvas -->
  <main class="flex-1 py-6 px-4 sm:px-6 max-w-5xl mx-auto w-full page-container">
    <div class="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden force-print-border">
      
      <!-- HERO HEADER -->
      <section class="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-7 sm:p-10 relative overflow-hidden">
        <div class="relative z-10 space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div class="flex items-center gap-2 text-indigo-400 font-bold text-xs tracking-wider uppercase mb-1.5">
                <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>
                Performance Intelligence Audit • Confidential Deliverable
              </div>
              <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight">${displayName}</h1>
              <p class="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                <span>Client: <strong class="text-white">${clientName}</strong></span>
                <span class="text-slate-600">•</span>
                <span>Growth Lead: <strong class="text-white">${strategistName}</strong></span>
                <span class="text-slate-600">•</span>
                <span>Reporting Window: <strong class="text-emerald-400 font-bold">${windowLabel}</strong></span>
                <span class="text-slate-600">•</span>
                <span>Audit Date: <strong class="text-white">${dateStamp}</strong></span>
              </p>
            </div>
            <div class="flex flex-col sm:items-end gap-1.5">
              <span class="text-[10px] uppercase font-bold tracking-widest text-slate-400">Contracted Retainer Scope</span>
              <div class="flex flex-wrap items-center gap-1.5">${scopeBadges}</div>
              <span class="text-[11px] font-semibold text-slate-300 mt-0.5">${categoryCount}-Category Retainer Stack</span>
            </div>
          </div>

          <!-- 4-PILLAR KPI BANNER -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div class="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Total Media Spend</span>
                <i data-lucide="wallet" class="w-4 h-4 text-indigo-400"></i>
              </div>
              <div class="mt-2">
                <h3 class="text-2xl font-black text-white">${formatVal(summary.totalSpend)}</h3>
                <p class="text-[11px] text-slate-400 mt-0.5">Paid Channels Combined</p>
              </div>
            </div>
            <div class="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Total Inbound Conversions</span>
                <i data-lucide="target" class="w-4 h-4 text-amber-400"></i>
              </div>
              <div class="mt-2">
                <h3 class="text-2xl font-black text-white">${summary.totalConversions.toLocaleString()}</h3>
                <p class="text-[11px] text-slate-400 mt-0.5">Qualified Leads & Sales</p>
              </div>
            </div>
            <div class="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Blended Cost / Acquisition</span>
                <i data-lucide="badge-percent" class="w-4 h-4 text-emerald-400"></i>
              </div>
              <div class="mt-2">
                <h3 class="text-2xl font-black text-emerald-400">${formatVal(summary.blendedCpl)}</h3>
                <p class="text-[11px] text-slate-400 mt-0.5">Average per verified result</p>
              </div>
            </div>
            <div class="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Tracked Return / Yield</span>
                <i data-lucide="trending-up" class="w-4 h-4 text-blue-400"></i>
              </div>
              <div class="mt-2">
                <h3 class="text-2xl font-black text-blue-400">${summary.totalRevenue > 0 ? formatVal(summary.totalRevenue) : `${summary.roas}x`}</h3>
                <p class="text-[11px] text-slate-400 mt-0.5">${summary.totalRevenue > 0 ? `ROAS: ${summary.roas}x` : "Direct Yield Rating"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- REPORT BODY -->
      <div class="p-6 sm:p-10 space-y-10">
        
        <!-- RECONCILIATION TABLE -->
        <section class="avoid-break space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
                <i data-lucide="layout-grid" class="w-4 h-4 text-indigo-600"></i>
                Channel-by-Channel Performance Reconciliation
              </h2>
              <p class="text-xs text-slate-500">Side-by-side audited metrics for active contracted marketing channels (${windowLabel})</p>
            </div>
            <span class="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
              Normalized Agency Audit
            </span>
          </div>
          <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th class="py-3 px-4">Channel Engine</th>
                    <th class="py-3 px-4">Contracted Activity / Sub-Type</th>
                    <th class="py-3 px-4 text-right">Ad Spend</th>
                    <th class="py-3 px-4 text-right">Traffic / Impressions</th>
                    <th class="py-3 px-4 text-right">Volume (Leads/Sales)</th>
                    <th class="py-3 px-4 text-right">Unit Efficiency</th>
                    <th class="py-3 px-4 text-right">Revenue / Rank</th>
                    <th class="py-3 px-4 text-center">ROI Rating</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                  ${tableRows}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- CHARTS SECTION -->
        <section class="avoid-break grid grid-cols-1 md:grid-cols-3 gap-5">
          <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200 md:col-span-2 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <i data-lucide="bar-chart-2" class="w-4 h-4 text-indigo-600"></i>
                  Budget Allocation vs Tangible Deliverables
                </h3>
                <p class="text-[11px] text-slate-500">Ad spend invested compared to verified inbound inquiries / sales</p>
              </div>
              <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">Comparative Yield</span>
            </div>
            <div class="h-56 relative w-full">
              <canvas id="budgetYieldChart"></canvas>
            </div>
          </div>
          <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <h3 class="text-xs font-bold text-slate-900 flex items-center gap-2">
                <i data-lucide="pie-chart" class="w-4 h-4 text-indigo-600"></i>
                Conversion Source Mix
              </h3>
              <p class="text-[11px] text-slate-500">Share of inquiries by channel</p>
            </div>
            <div class="h-44 relative flex items-center justify-center">
              <canvas id="conversionMixChart"></canvas>
            </div>
            <div class="flex flex-wrap justify-center gap-2 text-[10px] text-slate-600 pt-1">
              <span>Mix across active channels</span>
            </div>
          </div>
        </section>

        <!-- STRATEGIC ROADMAP -->
        <section class="avoid-break bg-slate-900 text-white rounded-2xl p-6 sm:p-8 space-y-4 shadow-lg">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <i data-lucide="compass" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-white">Agency Executive Observations & 30-Day Growth Roadmap</h3>
              <p class="text-xs text-slate-400">Tailored high-impact initiatives prioritized for your active contracted channels</p>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
            <div class="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
              <h4 class="font-bold text-white flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-blue-400"></span> 1. Paid Media Scale & Funnel Efficiency
              </h4>
              <p class="text-slate-300 leading-relaxed">
                Inbound lead volume achieved strong stability across active campaigns. Recommend testing incremental scaling of top-performing ad creatives by 15-20% into next sprint.
              </p>
            </div>
            <div class="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
              <h4 class="font-bold text-white flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span> 2. Organic Search & Commercial Positioning
              </h4>
              <p class="text-slate-300 leading-relaxed">
                Podium rankings climbed across commercial high-intent search queries. Continue authority cluster backlinks, FAQ schema indexing, and technical mobile speed optimization.
              </p>
            </div>
          </div>
        </section>

        <!-- FOOTER -->
        <footer class="pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black">OT</div>
            <span class="font-bold text-slate-800">OmniTrack Executive Reporting System</span>
            <span>• Confidentially Prepared for Client Leadership</span>
          </div>
          <div class="text-[11px] text-slate-400">
            Audit Date: ${dateStamp}
          </div>
        </footer>

      </div>
    </div>
  </main>

  <script>
    window.onload = function() {
      if (window.lucide) {
        window.lucide.createIcons();
      }
      
      const ctxYield = document.getElementById('budgetYieldChart');
      if (ctxYield) {
        new Chart(ctxYield, {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(chartLabels)},
            datasets: [
              {
                label: 'Ad Spend (${sym})',
                data: ${JSON.stringify(chartSpend)},
                backgroundColor: '#0668E1',
                borderRadius: 6,
              },
              {
                label: 'Deliverables / Results',
                data: ${JSON.stringify(chartRes)},
                backgroundColor: '#10B981',
                borderRadius: 6,
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
              x: { grid: { display: false } },
              y: { beginAtZero: true }
            }
          }
        });
      }

      const ctxMix = document.getElementById('conversionMixChart');
      if (ctxMix) {
        new Chart(ctxMix, {
          type: 'doughnut',
          data: {
            labels: ${JSON.stringify(mixLabels)},
            datasets: [{
              data: ${JSON.stringify(mixValues)},
              backgroundColor: ${JSON.stringify(mixColors)},
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            cutout: '65%'
          }
        });
      }
    };

    function triggerStandalonePrint() {
      var btn = document.getElementById('standalonePrintBtn');
      var txt = document.getElementById('standalonePrintBtnText');
      if (btn && txt) {
        btn.disabled = true;
        btn.style.opacity = '0.75';
        btn.style.cursor = 'wait';
        btn.style.pointerEvents = 'none';
        txt.innerText = 'Opening PDF...';
      }
      setTimeout(function() {
        window.print();
        setTimeout(function() {
          if (btn && txt) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.style.pointerEvents = 'auto';
            txt.innerText = 'Save PDF / Print';
          }
        }, 3000);
      }, 200);
    }
  </script>
</body>
</html>`;
  };

  // Download Standalone HTML Deliverable
  const handleDownloadHtml = () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const html = generateStandaloneHtmlReport();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (companyName || clientName || "Client").replace(/[^a-zA-Z0-9_-]/g, "_");
      const dateSuffix = timeframe === "CUSTOM" && startDate && endDate
        ? `_${startDate}_to_${endDate}`
        : timeframe !== "ALL"
        ? `_${timeframe.toLowerCase()}`
        : "";
      a.download = `${safeName}_Executive_Report${dateSuffix}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Executive Report HTML downloaded successfully!");
    } catch (err) {
      console.error("Failed to download HTML report:", err);
      toast.error("Could not trigger download. Please try printing to PDF instead.");
    } finally {
      setTimeout(() => setIsDownloading(false), 600);
    }
  };

  // Unclipped, Clean Print to PDF using an isolated print iframe with anti-multi-click lock
  const handlePrint = () => {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      const oldIframe = document.getElementById("hrms-print-iframe");
      if (oldIframe) {
        oldIframe.remove();
      }

      const iframe = document.createElement("iframe");
      iframe.id = "hrms-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
      iframe.style.zIndex = "-999";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        setTimeout(() => setIsPrinting(false), 2500);
        return;
      }

      const html = generateStandaloneHtmlReport();
      doc.open();
      doc.write(html);
      doc.close();

      let printed = false;
      const doPrint = () => {
        if (printed) return;
        printed = true;
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn("Iframe print error, falling back to window.print():", e);
          window.print();
        } finally {
          // Keep loader active for 3.5s to prevent multiple rapid clicks
          setTimeout(() => {
            setIsPrinting(false);
            setTimeout(() => {
              const current = document.getElementById("hrms-print-iframe");
              if (current) current.remove();
            }, 1000);
          }, 3500);
        }
      };

      try {
        iframe.contentWindow?.addEventListener("afterprint", () => {
          setIsPrinting(false);
          setTimeout(() => {
            const current = document.getElementById("hrms-print-iframe");
            if (current) current.remove();
          }, 500);
        });
      } catch (e) {
        // ignore
      }

      // Allow iframe styles and Chart.js to initialize cleanly
      setTimeout(doPrint, 1100);
    } catch (err) {
      console.error("Print invocation error:", err);
      window.print();
      setTimeout(() => setIsPrinting(false), 2500);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[98vw] sm:w-[96vw] max-h-[96vh] sm:max-h-[94vh] bg-background border-border/60 rounded-2xl sm:rounded-3xl p-0 overflow-y-auto shadow-2xl print:border-none print:shadow-none print:max-w-full print:w-full print:m-0 print:p-0 [&>button.absolute]:hidden">
        {/* Full Modal Loading Overlay while preparing Print preview to completely block multiple clicks */}
        {isPrinting && (
          <div className="absolute inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-6 rounded-3xl animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/90 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center max-w-sm space-y-3.5">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center ring-4 ring-emerald-500/10">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">Opening PDF / Print Preview</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Compiling clean unclipped report layout and opening print dialog. Please wait a moment...
                </p>
              </div>
              <div className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/30">
                Please wait • Multiple clicks prevented
              </div>
            </div>
          </div>
        )}
        
        {/* NON-PRINT CONTROLS BAR */}
        <aside className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white p-3 sm:p-3.5 print:hidden flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-md">
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-xs shrink-0">
                OT
              </div>
              <div>
                <h2 className="text-sm font-black text-white">Executive Client Performance Intelligence</h2>
                <p className="text-[11px] text-slate-400">Dynamic Multi-Category Retainer Reconciliation</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close report"
              className="sm:hidden h-8 w-8 shrink-0 flex items-center justify-center text-slate-300 bg-slate-800 border border-slate-700 hover:text-white hover:bg-rose-600 rounded-xl transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
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

            {/* Timeframe Date Filter */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-xl text-xs text-white">
              <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <label htmlFor="reportTimeframeSelect" className="sr-only">Date Filter</label>
              <select
                id="reportTimeframeSelect"
                value={timeframe}
                onChange={e => setTimeframe(e.target.value)}
                className="bg-transparent font-medium text-slate-200 outline-none cursor-pointer text-xs pr-1"
              >
                <option value="ALL" className="bg-slate-900 text-white font-medium">All Recorded Dates</option>
                <option value="TODAY" className="bg-slate-900 text-white font-medium">Today</option>
                <option value="YESTERDAY" className="bg-slate-900 text-white font-medium">Yesterday</option>
                <option value="LAST_7" className="bg-slate-900 text-white font-medium">Last 7 Days</option>
                <option value="LAST_30" className="bg-slate-900 text-white font-medium">Last 30 Days</option>
                <option value="THIS_MONTH" className="bg-slate-900 text-white font-medium">This Month</option>
                <option value="LAST_MONTH" className="bg-slate-900 text-white font-medium">Last Month</option>
                <option value="CUSTOM" className="bg-slate-900 text-white font-medium">Custom Range...</option>
              </select>
            </div>

            {/* Custom Date Range Inputs (visible if CUSTOM selected) */}
            {timeframe === "CUSTOM" && (
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2 py-1 rounded-xl text-xs text-white">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer"
                  title="Start Date"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer"
                  title="End Date"
                />
              </div>
            )}

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

            {/* Standalone Download HTML Deliverable */}
            <button
              type="button"
              onClick={handleDownloadHtml}
              disabled={isDownloading}
              className={cn(
                "px-3.5 py-1.5 font-bold rounded-xl text-white transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20",
                isDownloading
                  ? "bg-indigo-700/80 cursor-wait opacity-80"
                  : "bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
              )}
              title="Download standalone client report HTML file"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report</span>
                </>
              )}
            </button>

            {/* Print / Save PDF Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || isDownloading}
              className={cn(
                "px-3.5 py-1.5 font-bold rounded-xl text-white transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20",
                isPrinting
                  ? "bg-emerald-700/80 cursor-wait opacity-80 pointer-events-none"
                  : "bg-emerald-600 hover:bg-emerald-500 cursor-pointer"
              )}
              title="Save clean unclipped PDF or Print"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Opening PDF...</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>Save PDF / Print</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close report"
              title="Close"
              className="h-8 w-8 shrink-0 hidden sm:flex items-center justify-center text-slate-300 bg-slate-800 border border-slate-700 hover:text-white hover:bg-rose-600 hover:border-rose-500 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
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
                    <span>Window: <strong className="text-emerald-400 font-bold">{windowLabel}</strong></span>
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
                  Audited side-by-side metrics for active selected marketing channels ({windowLabel})
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
                          No performance data records matching selected channel scope and date filter.
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
                            <p className="font-bold text-foreground truncate">{rec.name || "Campaign Asset"}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{rec.subType} • {rec.date || "—"}</p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black">{formatMoney(rec.spend)}</td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {rec.category === "SEO" ? `${(rec.clicks || rec.impressions || 0).toLocaleString()} sessions` : `${(rec.impressions || 0).toLocaleString()} impr`}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            {(rec.results || 0).toLocaleString()} {rec.resultLabel || "leads"}
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

          {/* ================= 4. DYNAMIC DEEP-DIVE SECTIONS ================= */}
          {/* Section 4A: Meta Ads Deep Dive */}
          {selectedCategories.META && metaMetrics.list.length > 0 && (
            <section className="bg-muted/10 border border-blue-500/20 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-blue-500/20">
                    M
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">Meta Advertising Engine (Facebook & Instagram)</h3>
                    <p className="text-xs text-muted-foreground">Paid Social Funnel: Feed UGC, Story Placements, WhatsApp Leads & Catalog Sales</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                  Contracted Active
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Meta Ad Spend</span>
                  <p className="text-lg font-black text-foreground mt-1">{formatMoney(metaMetrics.spend)}</p>
                  <span className="text-[10px] text-muted-foreground">Total Campaign Budget</span>
                </div>
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Impressions & Reach</span>
                  <p className="text-lg font-black text-foreground mt-1">{metaMetrics.impr.toLocaleString()}</p>
                  <span className="text-[10px] text-muted-foreground">Avg CTR: {metaMetrics.ctr}%</span>
                </div>
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Conversions / Leads</span>
                  <p className="text-lg font-black text-blue-600 mt-1">{metaMetrics.results.toLocaleString()}</p>
                  <span className="text-[10px] text-muted-foreground">Unit Cost: {formatMoney(metaMetrics.cpl)}</span>
                </div>
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Revenue / ROAS</span>
                  <p className="text-lg font-black text-emerald-600 mt-1">{metaMetrics.rev > 0 ? formatMoney(metaMetrics.rev) : `${metaMetrics.roas}x`}</p>
                  <span className="text-[10px] text-muted-foreground">Attributed Yield</span>
                </div>
              </div>
            </section>
          )}

          {/* Section 4B: Google Ads Deep Dive */}
          {selectedCategories.GOOGLE && googleMetrics.list.length > 0 && (
            <section className="bg-muted/10 border border-red-500/20 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-red-500/20">
                    G
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">Google Ads Ecosystem (Search & Performance Max)</h3>
                    <p className="text-xs text-muted-foreground">High-Commercial Intent Capture: Exact Match Search, PMax Asset Groups & Video Action</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-red-600 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
                  Contracted Active
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Google Ad Spend</span>
                  <p className="text-lg font-black text-foreground mt-1">{formatMoney(googleMetrics.spend)}</p>
                  <span className="text-[10px] text-muted-foreground">Search & PMax</span>
                </div>
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">High-Intent Clicks</span>
                  <p className="text-lg font-black text-foreground mt-1">{googleMetrics.clicks.toLocaleString()}</p>
                  <span className="text-[10px] text-muted-foreground">Avg CPC: {formatMoney(googleMetrics.cpc)}</span>
                </div>
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Verified Conversions</span>
                  <p className="text-lg font-black text-red-600 mt-1">{googleMetrics.conv.toLocaleString()}</p>
                  <span className="text-[10px] text-muted-foreground">Conv. Rate: {googleMetrics.convRate}%</span>
                </div>
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Revenue / ROAS</span>
                  <p className="text-lg font-black text-emerald-600 mt-1">{googleMetrics.rev > 0 ? formatMoney(googleMetrics.rev) : `${googleMetrics.roas}x`}</p>
                  <span className="text-[10px] text-muted-foreground">Attributed Yield</span>
                </div>
              </div>
            </section>
          )}

          {/* Section 4C: SEO Organic Deep Dive */}
          {selectedCategories.SEO && seoMetrics.list.length > 0 && (
            <section className="bg-muted/10 border border-emerald-500/20 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/20">
                    SEO
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">SEO Organic Engine & Search Equity</h3>
                    <p className="text-xs text-muted-foreground">Organic Search Inbound: High-Intent Keyword Indexing, Technical Audits & Pillar Content</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                  Contracted Active
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Organic Sessions</span>
                  <p className="text-lg font-black text-foreground mt-1">{seoMetrics.sessions.toLocaleString()}</p>
                  <span className="text-[10px] text-muted-foreground">Search Engine Traffic</span>
                </div>
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Podium Keywords (Top 3)</span>
                  <p className="text-lg font-black text-emerald-600 mt-1">{seoMetrics.top3}</p>
                  <span className="text-[10px] text-muted-foreground">Ranked in Positions 1-3</span>
                </div>
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Organic Inbound Leads</span>
                  <p className="text-lg font-black text-foreground mt-1">{seoMetrics.leads.toLocaleString()}</p>
                  <span className="text-[10px] text-muted-foreground">Direct Inquiries</span>
                </div>
                <div className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground">Top 10 Keywords</span>
                  <p className="text-lg font-black text-blue-600 mt-1">{seoMetrics.top10}</p>
                  <span className="text-[10px] text-muted-foreground">First Page Rankings</span>
                </div>
              </div>
            </section>
          )}

          {/* ================= 5. STRATEGIC AGENCY TAKEAWAYS & NEXT MONTH ROADMAP ================= */}
          <section className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/30 border border-primary/40 flex items-center justify-center text-primary">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Agency Executive Observations & 30-Day Growth Roadmap</h3>
                <p className="text-xs text-slate-400">Tailored high-impact initiatives prioritized for your active contracted channels</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1.5">
                <h4 className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span> 1. Paid Media Scale & Funnel Efficiency
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  Inbound lead volume achieved strong stability across active campaigns. Recommend testing incremental scaling of top-performing ad sets by 15-20% into next sprint.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1.5">
                <h4 className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 2. Organic Search & Keyword Positioning
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  Podium rankings climbed across commercial high-intent queries. Continue authority cluster backlinks, FAQ schema indexing, and technical mobile speed optimization.
                </p>
              </div>
            </div>
          </section>

          {/* Report Footer */}
          <div className="pt-6 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <p>Generated via OmniTrack Enterprise Reporting System • Confidential Agency Client Deliverable</p>
            <p>Audit Date: {formatDate(new Date())}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
