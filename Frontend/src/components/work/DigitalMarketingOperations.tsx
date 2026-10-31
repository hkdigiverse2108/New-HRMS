import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  CreditCard,
  UserCheck,
  TrendingUp,
  Eye,
  Compass,
  Award,
  Search,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  PlusCircle,
  Table2,
  Maximize2,
  Trash2,
  Edit2,
  X,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Download,
  Printer,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  Check,
  Loader2,
  Building2,
  SlidersHorizontal,
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
  Legend,
} from "recharts";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExecutivePerformanceReportModal } from "./ExecutivePerformanceReportModal";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MarketingRecord {
  id: string;
  date: string;
  client: string;
  category: "META" | "GOOGLE" | "SEO";
  subType: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  resultLabel?: string | undefined;
  cpl: number;
  revenue: number;
  roas: number;
  seoKeywordsTop3: number;
  seoKeywordsTop10: number;
  notes?: string | undefined;
}

export const CAMPAIGN_SUB_TYPES: Record<string, { id: string; label: string }[]> = {
  META: [
    { id: "META_WA", label: "WhatsApp Direct Inbound Leads (Click-to-WA)" },
    { id: "META_D2C_SALES", label: "Advantage+ Shopping Purchases (E-commerce / D2C)" },
    { id: "META_LEAD_FORM", label: "Instant Lead Forms (High-Ticket / Service Lead Gen)" },
    { id: "META_WEBINAR", label: "Webinar & Virtual Masterclass Registrations" },
    { id: "META_INSTA_GROWTH", label: "Instagram Profile Visits & Engagement Scaling" },
    { id: "META_AWARENESS", label: "Brand Awareness & Video Views (Top-of-Funnel)" },
  ],
  GOOGLE: [
    { id: "GOOGLE_SEARCH_LEADS", label: "High-Intent Keyword Search Ads (B2B / Service Leads)" },
    { id: "GOOGLE_PMAX_D2C", label: "Performance Max (Omni-Channel Retail Shopping)" },
    { id: "GOOGLE_YOUTUBE_ACTION", label: "YouTube In-Stream Video Action Funnels" },
    { id: "GOOGLE_LOCAL_MAPS", label: "Google Local Services & Maps Direction Leads" },
    { id: "GOOGLE_DISPLAY_RM", label: "Display Network & Dynamic Catalog Remarketing" },
  ],
  SEO: [
    { id: "SEO_ORGANIC_GROWTH", label: "Monthly Organic Ranking & Session Tracking" },
    { id: "SEO_ONPAGE_CONTENT", label: "On-Page Semantic Optimization & Schema Clusters" },
    { id: "SEO_TECHNICAL_AUDIT", label: "Technical SEO, Core Web Vitals & Crawl Health" },
    { id: "SEO_LOCAL_GMB", label: "Google Business Profile (GMB) & Local 3-Pack Growth" },
    { id: "SEO_OFFPAGE_BACKLINKS", label: "Off-Page High-DR Link Building & PR Outreach" },
  ],
};

export interface DigitalMarketingOperationsProps {
  projectId: string;
  clientId: string;
  clientName: string;
  companyName?: string | undefined;
  initialRecords?: MarketingRecord[] | undefined;
  onOpenReportModal?: (() => void) | undefined;
  isReportOpen?: boolean | undefined;
  onCloseReport?: (() => void) | undefined;
}

export const DigitalMarketingOperations: React.FC<DigitalMarketingOperationsProps> = ({
  projectId,
  clientId,
  clientName,
  companyName,
  initialRecords,
  onOpenReportModal,
  isReportOpen,
  onCloseReport,
}) => {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Currency state (INR / USD)
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const USD_RATE = 0.012; // 1 INR ~ 0.012 USD

  const formatMoney = (amount: number) => {
    if (!amount || amount === 0) return currency === "INR" ? "₹0" : "$0";
    const val = currency === "INR" ? amount : amount * USD_RATE;
    const symbol = currency === "INR" ? "₹" : "$";
    return `${symbol}${Math.round(val).toLocaleString("en-IN")}`;
  };

  // Records state
  const [records, setRecords] = useState<MarketingRecord[]>(initialRecords || []);
  const [loading, setLoading] = useState(false);

  // Campaign names list (autocomplete with delete)
  const [savedCampaignNames, setSavedCampaignNames] = useState<string[]>([]);
  const [showNameDropdown, setShowNameDropdown] = useState(false);

  // Filters state
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("ALL");
  const [selectedSubTypeFilter, setSelectedSubTypeFilter] = useState<string>("ALL");
  const [timeframeFilter, setTimeframeFilter] = useState<string>("ALL");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isFullTableModalOpen, setIsFullTableModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MarketingRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "META" as "META" | "GOOGLE" | "SEO",
    subType: "META_WA",
    name: "",
    spend: 0,
    impressions: 0,
    clicks: 0,
    results: 0,
    resultLabel: "Leads (WA)",
    revenue: 0,
    seoKeywordsTop3: 0,
    seoKeywordsTop10: 0,
    notes: "",
  });

  // Fetch records and campaign names from backend
  const fetchMarketingData = async () => {
    try {
      setLoading(true);
      const [statsRes, campsRes] = await Promise.allSettled([
        api.get<any[]>(`/projects/${projectId}/marketing-stats`, { showLoader: false, showErrorToast: false }),
        api.get<string[]>(`/projects/${projectId}/marketing-campaigns`, { showLoader: false, showErrorToast: false }),
      ]);

      if (statsRes.status === "fulfilled" && Array.isArray(statsRes.value)) {
        const mapped: MarketingRecord[] = statsRes.value.map((s: any) => ({
          id: s.id || s._id,
          date: s.date ? (String(s.date).split("T")[0] || "") : "",
          client: clientName,
          category: s.category || "META",
          subType: s.sub_type || s.subType || (s.category === "SEO" ? "SEO_ORGANIC_GROWTH" : s.category === "GOOGLE" ? "GOOGLE_SEARCH_LEADS" : "META_WA"),
          name: s.campaign_name || s.name || "Campaign",
          spend: Number(s.spend) || 0,
          impressions: Number(s.impressions) || 0,
          clicks: Number(s.clicks) || 0,
          results: Number(s.results ?? s.leads) || 0,
          resultLabel: s.result_label || (s.category === "SEO" ? "Organic Leads" : "Leads"),
          cpl: Number(s.cpl ?? s.cost_metric) || 0,
          revenue: Number(s.revenue) || 0,
          roas: Number(s.roas) || 0,
          seoKeywordsTop3: Number(s.seo_keywords_top3) || 0,
          seoKeywordsTop10: Number(s.seo_keywords_top10) || 0,
          notes: s.notes || "",
        }));
        setRecords(mapped);
      }

      if (campsRes.status === "fulfilled" && Array.isArray(campsRes.value)) {
        setSavedCampaignNames(campsRes.value);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchMarketingData();
    }
  }, [projectId]);

  // Handle Form Category change
  const handleFormCategoryChange = (cat: "META" | "GOOGLE" | "SEO") => {
    const defaultSubType = CAMPAIGN_SUB_TYPES[cat]?.[0]?.id || "";
    let defaultLabel = "Leads";
    if (cat === "META") defaultLabel = "Leads (WA)";
    if (cat === "GOOGLE") defaultLabel = "Demo Requests";
    if (cat === "SEO") defaultLabel = "Organic Leads";

    setFormData(prev => ({
      ...prev,
      category: cat,
      subType: defaultSubType,
      resultLabel: defaultLabel,
    }));
  };

  // Handle Sub-type change
  const handleFormSubTypeChange = (typeId: string) => {
    let lbl = "Leads";
    if (typeId.includes("D2C") || typeId.includes("SALES")) lbl = "Purchases";
    else if (typeId.includes("WEBINAR")) lbl = "Registrations";
    else if (typeId.includes("MAPS")) lbl = "Store Calls";
    else if (typeId.includes("ORGANIC")) lbl = "Organic Leads";
    setFormData(prev => ({ ...prev, subType: typeId, resultLabel: lbl }));
  };

  // Open Entry Modal (New or Edit)
  const openEntryModal = (rec?: MarketingRecord) => {
    if (rec) {
      setEditingRecord(rec);
      setFormData({
        date: rec.date,
        category: rec.category,
        subType: rec.subType,
        name: rec.name,
        spend: rec.spend,
        impressions: rec.impressions,
        clicks: rec.clicks,
        results: rec.results,
        resultLabel: rec.resultLabel || "Leads",
        revenue: rec.revenue,
        seoKeywordsTop3: rec.seoKeywordsTop3,
        seoKeywordsTop10: rec.seoKeywordsTop10,
        notes: rec.notes || "",
      });
    } else {
      setEditingRecord(null);
      setFormData({
        date: new Date().toISOString().split("T")[0],
        category: "META",
        subType: "META_WA",
        name: "",
        spend: 0,
        impressions: 0,
        clicks: 0,
        results: 0,
        resultLabel: "Leads (WA)",
        revenue: 0,
        seoKeywordsTop3: 0,
        seoKeywordsTop10: 0,
        notes: "",
      });
    }
    setIsEntryModalOpen(true);
  };

  // Submit Record
  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter a Campaign Name / Focus");
      return;
    }

    try {
      setIsSubmitting(true);
      const computedCpl = formData.results > 0 ? Math.round((formData.spend / formData.results) * 100) / 100 : 0;
      const computedRoas = formData.spend > 0 ? Math.round((formData.revenue / formData.spend) * 100) / 100 : 0;

      const payload = {
        date: formData.date,
        campaign_name: formData.name.trim(),
        category: formData.category,
        sub_type: formData.subType,
        reach: formData.impressions,
        impressions: formData.impressions,
        clicks: formData.clicks,
        leads: formData.results,
        results: formData.results,
        result_label: formData.resultLabel,
        revenue: formData.revenue,
        spend: formData.spend,
        cost_metric: computedCpl,
        cpl: computedCpl,
        roas: computedRoas,
        seo_keywords_top3: formData.seoKeywordsTop3,
        seo_keywords_top10: formData.seoKeywordsTop10,
        notes: formData.notes.trim(),
        currency: currency,
      };

      if (editingRecord) {
        await api.put(`/projects/${projectId}/marketing-stats/${editingRecord.id}`, payload);
        toast.success("Marketing record updated successfully!");
      } else {
        await api.post(`/projects/${projectId}/marketing-stats`, payload);
        toast.success("Marketing record saved successfully!");
      }

      setIsEntryModalOpen(false);
      setEditingRecord(null);
      await fetchMarketingData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save marketing record");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm("Are you sure you want to delete this marketing entry?")) return;
    try {
      await api.delete(`/projects/${projectId}/marketing-stats/${recordId}`);
      toast.success("Record deleted successfully");
      setRecords(prev => prev.filter(r => r.id !== recordId));
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete record");
    }
  };

  // Delete Campaign Name from Autocomplete List
  const handleDeleteCampaignName = async (nameToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/projects/${projectId}/marketing-campaigns/${encodeURIComponent(nameToDelete)}`);
      setSavedCampaignNames(prev => prev.filter(n => n.toLowerCase() !== nameToDelete.toLowerCase()));
      toast.success(`Removed "${nameToDelete}" from suggestions`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete campaign suggestion");
    }
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      // Category filter
      if (activeCategoryFilter !== "ALL" && rec.category !== activeCategoryFilter) return false;

      // Sub-Type filter
      if (selectedSubTypeFilter !== "ALL" && rec.subType !== selectedSubTypeFilter) return false;

      // Timeframe filter
      if (timeframeFilter !== "ALL" && rec.date) {
        const today = new Date();
        const rDate = new Date(rec.date);
        if (timeframeFilter === "TODAY") {
          const tStr = today.toISOString().split("T")[0];
          if (rec.date !== tStr) return false;
        } else if (timeframeFilter === "YESTERDAY") {
          const y = new Date(today);
          y.setDate(y.getDate() - 1);
          const yStr = y.toISOString().split("T")[0];
          if (rec.date !== yStr) return false;
        } else if (timeframeFilter === "LAST_7") {
          const past = new Date(today);
          past.setDate(past.getDate() - 7);
          if (rDate < past) return false;
        } else if (timeframeFilter === "LAST_30") {
          const past = new Date(today);
          past.setDate(past.getDate() - 30);
          if (rDate < past) return false;
        } else if (timeframeFilter === "THIS_MONTH") {
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          if (rDate < monthStart) return false;
        } else if (timeframeFilter === "CUSTOM") {
          if (customStartDate && rec.date < customStartDate) return false;
          if (customEndDate && rec.date > customEndDate) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = rec.name.toLowerCase().includes(q);
        const matchesClient = rec.client.toLowerCase().includes(q);
        const matchesSub = rec.subType.toLowerCase().includes(q);
        const matchesNotes = (rec.notes || "").toLowerCase().includes(q);
        if (!matchesName && !matchesClient && !matchesSub && !matchesNotes) return false;
      }

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, activeCategoryFilter, selectedSubTypeFilter, timeframeFilter, customStartDate, customEndDate, searchQuery]);

  // Computed KPIs
  const kpis = useMemo(() => {
    const totalSpend = filteredRecords.reduce((s, r) => s + (r.spend || 0), 0);
    const paidLeads = filteredRecords
      .filter(r => r.category === "META" || r.category === "GOOGLE")
      .reduce((s, r) => s + (r.results || 0), 0);
    const avgCpl = paidLeads > 0 ? Math.round(totalSpend / paidLeads) : 0;

    const totalRevenue = filteredRecords.reduce((s, r) => s + (r.revenue || 0), 0);
    const blendedRoas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : "0.00";

    const totalImpressions = filteredRecords.reduce((s, r) => s + (r.impressions || 0), 0);
    const totalClicks = filteredRecords.reduce((s, r) => s + (r.clicks || 0), 0);

    const seoSessions = filteredRecords
      .filter(r => r.category === "SEO")
      .reduce((s, r) => s + (r.clicks || 0), 0);
    const seoLeads = filteredRecords
      .filter(r => r.category === "SEO")
      .reduce((s, r) => s + (r.results || 0), 0);

    const top10Keywords = filteredRecords
      .filter(r => r.category === "SEO")
      .reduce((max, r) => Math.max(max, r.seoKeywordsTop10 || 0), 0);
    const top3Podiums = filteredRecords
      .filter(r => r.category === "SEO")
      .reduce((max, r) => Math.max(max, r.seoKeywordsTop3 || 0), 0);

    return {
      totalSpend,
      paidLeads,
      avgCpl,
      totalRevenue,
      blendedRoas,
      totalImpressions,
      totalClicks,
      seoSessions,
      seoLeads,
      top10Keywords,
      top3Podiums,
    };
  }, [filteredRecords]);

  // Chart 1: Spend vs Revenue Data
  const chartSpendRevenueData = useMemo(() => {
    const metaSpend = filteredRecords.filter(r => r.category === "META").reduce((s, r) => s + r.spend, 0);
    const metaRev = filteredRecords.filter(r => r.category === "META").reduce((s, r) => s + r.revenue, 0);

    const googleSpend = filteredRecords.filter(r => r.category === "GOOGLE").reduce((s, r) => s + r.spend, 0);
    const googleRev = filteredRecords.filter(r => r.category === "GOOGLE").reduce((s, r) => s + r.revenue, 0);

    const seoRev = filteredRecords.filter(r => r.category === "SEO").reduce((s, r) => s + r.revenue, 0);

    return [
      { name: "Meta Ads", Spend: currency === "INR" ? metaSpend : Math.round(metaSpend * USD_RATE), Revenue: currency === "INR" ? metaRev : Math.round(metaRev * USD_RATE) },
      { name: "Google Ads", Spend: currency === "INR" ? googleSpend : Math.round(googleSpend * USD_RATE), Revenue: currency === "INR" ? googleRev : Math.round(googleRev * USD_RATE) },
      { name: "Organic SEO", Spend: 0, Revenue: currency === "INR" ? seoRev : Math.round(seoRev * USD_RATE) },
    ];
  }, [filteredRecords, currency]);

  // Chart 2: Inbound Conversion Mix
  const chartMixData = useMemo(() => {
    const metaResults = filteredRecords.filter(r => r.category === "META").reduce((s, r) => s + r.results, 0);
    const googleResults = filteredRecords.filter(r => r.category === "GOOGLE").reduce((s, r) => s + r.results, 0);
    const seoResults = filteredRecords.filter(r => r.category === "SEO").reduce((s, r) => s + r.results, 0);

    const data = [
      { name: "Meta Ads", value: metaResults, color: "#0668E1" },
      { name: "Google Ads", value: googleResults, color: "#EA4335" },
      { name: "SEO Organic", value: seoResults, color: "#10B981" },
    ].filter(d => d.value > 0);

    return data.length > 0 ? data : [{ name: "No Conversions", value: 1, color: "#cbd5e1" }];
  }, [filteredRecords]);

  // Export CSV
  const exportLedgerToCSV = () => {
    if (filteredRecords.length === 0) {
      toast.error("No records available to export");
      return;
    }
    const headers = ["Date", "Client", "Category", "Sub-Type", "Campaign Name", "Ad Spend (INR)", "Impressions", "Clicks/Traffic", "Results (Leads/Sales)", "Unit CPL", "Revenue", "ROAS", "Top 3 Podium", "Top 10 Keywords", "Notes"];
    const rows = filteredRecords.map(r => [
      r.date,
      `"${r.client}"`,
      r.category,
      `"${r.subType}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      r.spend,
      r.impressions,
      r.clicks,
      r.results,
      r.cpl,
      r.revenue,
      r.roas,
      r.seoKeywordsTop3,
      r.seoKeywordsTop10,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Campaign_Ledger_${clientName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded successfully!");
  };

  // Autocomplete campaign names filtering
  const filteredCampaignSuggestions = useMemo(() => {
    if (!formData.name) return savedCampaignNames;
    return savedCampaignNames.filter(n => n.toLowerCase().includes(formData.name.toLowerCase()));
  }, [savedCampaignNames, formData.name]);

  return (
    <div className="space-y-6">
      {/* Top Header Controls Bar */}
      <div className="bg-card border border-border/60 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-foreground tracking-tight">
                Digital Marketing <span className="text-primary">Performance Engine</span>
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                Multi-Channel
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Meta Ads, Google Ads & SEO Retainer Intelligence
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Currency Toggle */}
          <div className="inline-flex rounded-xl p-1 bg-muted/40 border border-border/60 text-xs shadow-inner">
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold transition-all",
                currency === "INR"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              ₹ INR
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold transition-all",
                currency === "USD"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              $ USD
            </button>
          </div>

          {/* Full-Screen Interactive Explorer Button */}
          <button
            type="button"
            onClick={() => setIsFullTableModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-border/60 bg-card hover:bg-muted/70 text-foreground transition-all shadow-sm flex items-center gap-1.5"
            title="Expand Full Screen Table"
          >
            <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Full Table</span>
          </button>

          {/* Export Data / Executive Report Trigger */}
          <button
            type="button"
            onClick={() => {
              setIsReportModalOpen(true);
              onOpenReportModal?.();
            }}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Open Executive Client Performance Intelligence Report"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Executive Report</span>
          </button>


          {/* Add Record Trigger */}
          <button
            type="button"
            onClick={() => openEntryModal()}
            className="px-4 py-2 text-xs font-black rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-md shadow-primary/20 flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Record</span>
          </button>
        </div>
      </div>

      {/* TOP ROW: 6 EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* KPI 1: Total Ad Spend */}
        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm hover:shadow transition-all group">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold mb-1">
            <span>Total Ad Spend</span>
            <CreditCard className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-black text-foreground">{formatMoney(kpis.totalSpend)}</div>
          <p className="text-[10px] text-primary font-bold mt-1">Meta & Google Combined</p>
        </div>

        {/* KPI 2: Inbound Paid Leads */}
        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm hover:shadow transition-all group">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold mb-1">
            <span>Inbound Paid Leads</span>
            <UserCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-foreground">{kpis.paidLeads.toLocaleString()}</div>
          <p className="text-[10px] text-muted-foreground font-semibold mt-1">
            Avg CPL: <span className="font-bold text-foreground">{formatMoney(kpis.avgCpl)}</span>
          </p>
        </div>

        {/* KPI 3: Tracked Revenue & ROAS */}
        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm hover:shadow transition-all group">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold mb-1">
            <span>Tracked Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-foreground">{formatMoney(kpis.totalRevenue)}</div>
          <p className="text-[10px] text-emerald-600 font-bold mt-1">
            ROAS: {kpis.blendedRoas}x
          </p>
        </div>

        {/* KPI 4: Impressions & Clicks */}
        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm hover:shadow transition-all group">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold mb-1">
            <span>Ad Impressions</span>
            <Eye className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-black text-foreground">{kpis.totalImpressions.toLocaleString()}</div>
          <p className="text-[10px] text-muted-foreground font-semibold mt-1">
            Clicks: <span className="font-bold text-foreground">{kpis.totalClicks.toLocaleString()}</span>
          </p>
        </div>

        {/* KPI 5: Organic SEO Sessions */}
        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm hover:shadow transition-all group">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold mb-1">
            <span>Organic Sessions</span>
            <Compass className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-xl font-black text-foreground">{kpis.seoSessions.toLocaleString()}</div>
          <p className="text-[10px] text-teal-600 font-bold mt-1">
            SEO Leads: {kpis.seoLeads.toLocaleString()}
          </p>
        </div>

        {/* KPI 6: Top 10 Keywords */}
        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm hover:shadow transition-all group">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold mb-1">
            <span>Top 10 Keywords</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-foreground">{kpis.top10Keywords}</div>
          <p className="text-[10px] text-amber-600 font-bold mt-1">
            Podium Top 3: {kpis.top3Podiums}
          </p>
        </div>
      </div>

      {/* MIDDLE ROW: PERFORMANCE CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Spend vs Revenue Bar Chart */}
        <div className="bg-card p-5 rounded-3xl border border-border/60 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-foreground text-sm">Channel Financial Performance</h3>
              <p className="text-xs text-muted-foreground">Spend vs Generated Revenue by Marketing Channel</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-2.5 h-2.5 rounded bg-blue-600" /> Spend
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Revenue
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSpendRevenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: "bold" }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${currency === "INR" ? "₹" : "$"}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <Tooltip
                  formatter={(val: any) => [`${currency === "INR" ? "₹" : "$"}${Number(val).toLocaleString()}`, ""]}
                  contentStyle={{ backgroundColor: "var(--card)", borderRadius: "1rem", border: "1px solid var(--border)", fontSize: "11px", fontWeight: "bold" }}
                />
                <Bar dataKey="Spend" fill="#0668E1" radius={[6, 6, 0, 0]} maxBarSize={48} />
                <Bar dataKey="Revenue" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inbound Conversion Mix Doughnut */}
        <div className="bg-card p-5 rounded-3xl border border-border/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-black text-foreground text-sm">Inbound Conversion Mix</h3>
              <p className="text-xs text-muted-foreground">Volume share across channels</p>
            </div>
          </div>
          <div className="h-56 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartMixData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {chartMixData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [`${val} conversions`, name]}
                  contentStyle={{ backgroundColor: "var(--card)", borderRadius: "1rem", border: "1px solid var(--border)", fontSize: "11px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-border/40 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-[#0668E1]"><span className="w-2 h-2 rounded-full bg-[#0668E1]" /> Meta Ads</span>
            <span className="flex items-center gap-1 text-[#EA4335]"><span className="w-2 h-2 rounded-full bg-[#EA4335]" /> Google Ads</span>
            <span className="flex items-center gap-1 text-[#10B981]"><span className="w-2 h-2 rounded-full bg-[#10B981]" /> Organic SEO</span>
          </div>
        </div>
      </div>

      {/* ADVANCED FILTER & SEARCH TOOLBAR */}
      <div className="bg-card p-4 rounded-3xl border border-border/60 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Channel Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/30 border border-border/50 rounded-2xl overflow-x-auto text-xs font-bold">
            {["ALL", "META", "GOOGLE", "SEO"].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveCategoryFilter(cat);
                  setSelectedSubTypeFilter("ALL");
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap",
                  activeCategoryFilter === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cat === "ALL" ? "All Channels" : cat === "META" ? "Meta Ads" : cat === "GOOGLE" ? "Google Ads" : "SEO & Organic"}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search campaign, keyword, notes..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border/60 bg-muted/20 focus:ring-2 focus:ring-primary/20 text-foreground"
            />
          </div>
        </div>

        {/* Secondary Filter Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-border/40 text-xs">
          {/* Sub-type filter */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Campaign Sub-Type
            </label>
            <Select
              value={selectedSubTypeFilter}
              onValueChange={val => setSelectedSubTypeFilter(val)}
            >
              <SelectTrigger className="w-full h-9 px-3 rounded-xl border border-border/60 bg-background text-foreground text-xs font-semibold focus:ring-1 focus:ring-primary shadow-xs">
                <SelectValue placeholder="All Sub-Types" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300] max-h-60">
                <SelectItem value="ALL" className="text-xs font-semibold rounded-lg cursor-pointer">
                  All Sub-Types
                </SelectItem>
                {(activeCategoryFilter === "ALL"
                  ? Object.values(CAMPAIGN_SUB_TYPES).flat()
                  : CAMPAIGN_SUB_TYPES[activeCategoryFilter] || []
                ).map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-xs font-semibold rounded-lg cursor-pointer">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timeframe filter */}
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Timeframe
            </label>
            <Select
              value={timeframeFilter}
              onValueChange={val => setTimeframeFilter(val as any)}
            >
              <SelectTrigger className="w-full h-9 px-3 rounded-xl border border-border/60 bg-background text-foreground text-xs font-semibold focus:ring-1 focus:ring-primary shadow-xs">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300] max-h-60">
                <SelectItem value="ALL" className="text-xs font-semibold rounded-lg cursor-pointer">All Recorded Dates</SelectItem>
                <SelectItem value="TODAY" className="text-xs font-semibold rounded-lg cursor-pointer">Today</SelectItem>
                <SelectItem value="YESTERDAY" className="text-xs font-semibold rounded-lg cursor-pointer">Yesterday</SelectItem>
                <SelectItem value="LAST_7" className="text-xs font-semibold rounded-lg cursor-pointer">Last 7 Days</SelectItem>
                <SelectItem value="LAST_30" className="text-xs font-semibold rounded-lg cursor-pointer">Last 30 Days</SelectItem>
                <SelectItem value="THIS_MONTH" className="text-xs font-semibold rounded-lg cursor-pointer">This Month</SelectItem>
                <SelectItem value="CUSTOM" className="text-xs font-semibold rounded-lg cursor-pointer">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Pickers (if Custom selected) */}
          {timeframeFilter === "CUSTOM" && (
            <div className="col-span-2 flex items-center gap-2">
              <DatePicker
                value={customStartDate}
                onChange={val => setCustomStartDate(val)}
                placeholder="Start Date"
                className="w-full h-9 rounded-xl text-xs"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <DatePicker
                value={customEndDate}
                minDate={customStartDate}
                onChange={val => setCustomEndDate(val)}
                placeholder="End Date"
                className="w-full h-9 rounded-xl text-xs"
              />
            </div>
          )}

          {/* Reset & Export CSV */}
          <div className={cn("flex items-end justify-end gap-2", timeframeFilter !== "CUSTOM" && "col-span-2")}>
            <button
              type="button"
              onClick={() => {
                setActiveCategoryFilter("ALL");
                setSelectedSubTypeFilter("ALL");
                setTimeframeFilter("ALL");
                setSearchQuery("");
                setCustomStartDate("");
                setCustomEndDate("");
              }}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-border/60 hover:bg-muted/70 text-muted-foreground hover:text-foreground transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={exportLedgerToCSV}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* PRIMARY OPERATIONAL CAMPAIGN LEDGER TABLE */}
      <div className="bg-card rounded-3xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 bg-muted/10">
          <div>
            <h3 className="font-black text-foreground text-sm flex items-center gap-2">
              <span>Operational Campaign Ledger</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                {filteredRecords.length} records
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Audited cross-channel activity logs for {clientName} {companyName ? `(${companyName})` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsFullTableModalOpen(true)}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>Expand Full Interactive Table</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-muted/30 text-muted-foreground font-black uppercase tracking-wider border-b border-border/50 text-[10px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Channel & Type</th>
                <th className="py-3 px-4">Campaign Name / Scope</th>
                <th className="py-3 px-4 text-right">Ad Spend</th>
                <th className="py-3 px-4 text-right">Traffic / Impr</th>
                <th className="py-3 px-4 text-right">Results</th>
                <th className="py-3 px-4 text-right">Unit CPL</th>
                <th className="py-3 px-4 text-right">Revenue</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-foreground font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <p className="font-bold text-xs">No campaign records found.</p>
                    <p className="text-[11px] mt-0.5">Click "Add Record" above to log campaign performance data.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold whitespace-nowrap text-muted-foreground">
                      {rec.date}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1",
                          rec.category === "META" && "bg-blue-500/10 text-blue-600 border border-blue-500/20",
                          rec.category === "GOOGLE" && "bg-red-500/10 text-red-600 border border-red-500/20",
                          rec.category === "SEO" && "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        )}
                      >
                        {rec.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[240px]">
                      <p className="font-bold text-foreground truncate" title={rec.name}>{rec.name}</p>
                      {rec.notes && (
                        <p className="text-[10px] text-muted-foreground truncate" title={rec.notes}>{rec.notes}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-foreground whitespace-nowrap">
                      {formatMoney(rec.spend)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground whitespace-nowrap">
                      {rec.category === "SEO" ? `${rec.clicks.toLocaleString()} sessions` : `${rec.impressions.toLocaleString()} impr`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-foreground whitespace-nowrap">
                      {rec.category === "SEO" ? (
                        <span className="text-emerald-600">{rec.results} leads</span>
                      ) : (
                        <span>{rec.results} {rec.resultLabel || "leads"}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground whitespace-nowrap">
                      {rec.cpl > 0 ? formatMoney(rec.cpl) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                      {rec.revenue > 0 ? formatMoney(rec.revenue) : "—"}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEntryModal(rec)}
                          className="p-1 text-muted-foreground hover:text-primary rounded-lg transition"
                          title="Edit Record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(rec.id)}
                          className="p-1 text-muted-foreground hover:text-rose-600 rounded-lg transition"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD / EDIT CAMPAIGN RECORD */}
      <Dialog open={isEntryModalOpen} onOpenChange={setIsEntryModalOpen}>
        <DialogContent className="max-w-2xl bg-card border-border/60 rounded-3xl p-0 overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-primary" />
                <span>{editingRecord ? "Edit Marketing Record" : "Log Daily Campaign / SEO Activity"}</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Channel category and campaign parameters for {clientName}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitRecord} className="p-6 space-y-4 text-xs">
            {/* Row 1: Date & Client Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-muted-foreground uppercase text-[10px] mb-1">
                  Execution / Log Date *
                </label>
                <DatePicker
                  value={formData.date}
                  onChange={val => setFormData({ ...formData, date: val })}
                  placeholder="Select Date"
                  className="w-full h-10 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-muted-foreground uppercase text-[10px] mb-1">
                  Client Profile *
                </label>
                <input
                  type="text"
                  value={companyName ? `${clientName} (${companyName})` : clientName}
                  disabled
                  className="w-full px-3 h-10 rounded-xl border border-border/60 bg-muted/30 text-muted-foreground text-xs font-semibold"
                />
              </div>
            </div>

            {/* Row 2: Category & Cascading Campaign Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-muted-foreground uppercase text-[10px] mb-1">
                  Channel Category *
                </label>
                <Select
                  value={formData.category}
                  onValueChange={val => handleFormCategoryChange(val as any)}
                >
                  <SelectTrigger className="w-full px-3 h-10 rounded-xl border border-border/60 bg-background text-foreground text-xs font-bold focus:ring-2 focus:ring-primary/20 shadow-xs">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                    <SelectItem value="META" className="text-xs font-semibold rounded-lg cursor-pointer">
                      Meta Ads (Facebook & Instagram)
                    </SelectItem>
                    <SelectItem value="GOOGLE" className="text-xs font-semibold rounded-lg cursor-pointer">
                      Google Ads (Search, PMax, YouTube...)
                    </SelectItem>
                    <SelectItem value="SEO" className="text-xs font-semibold rounded-lg cursor-pointer">
                      SEO (Organic Search & Technical)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block font-bold text-muted-foreground uppercase text-[10px] mb-1">
                  Specific Campaign / Activity Sub-Type *
                </label>
                <Select
                  value={formData.subType}
                  onValueChange={val => handleFormSubTypeChange(val)}
                >
                  <SelectTrigger className="w-full px-3 h-10 rounded-xl border border-border/60 bg-background text-foreground text-xs font-semibold focus:ring-2 focus:ring-primary/20 shadow-xs">
                    <SelectValue placeholder="Select Sub-Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300] max-h-60">
                    {(CAMPAIGN_SUB_TYPES[formData.category] || []).map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-xs font-semibold rounded-lg cursor-pointer">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Campaign Name with Autocomplete & Dropdown Deletion */}
            <div className="relative">
              <label className="block font-bold text-muted-foreground uppercase text-[10px] mb-1">
                Campaign Name / Focus * (Type to search previous campaigns)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => {
                    setFormData({ ...formData, name: e.target.value });
                    setShowNameDropdown(true);
                  }}
                  onFocus={() => setShowNameDropdown(true)}
                  placeholder="e.g. Diwali High-Ticket Jewellery WhatsApp Inbound"
                  required
                  className="w-full px-3 h-10 rounded-xl border border-border/60 bg-background text-foreground text-xs font-bold focus:ring-2 focus:ring-primary/20 pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowNameDropdown(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Suggestions Dropdown with Delete button for each name */}
              {showNameDropdown && savedCampaignNames.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border/60 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto p-1.5 backdrop-blur-md">
                  <div className="text-[10px] font-black text-muted-foreground px-2 py-1 uppercase tracking-wider flex items-center justify-between border-b border-border/40">
                    <span>Saved Campaign Names</span>
                    <button
                      type="button"
                      onClick={() => setShowNameDropdown(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {filteredCampaignSuggestions.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground p-2">No matching names. Press Enter to use new name.</p>
                  ) : (
                    filteredCampaignSuggestions.map(name => (
                      <div
                        key={name}
                        onClick={() => {
                          setFormData({ ...formData, name });
                          setShowNameDropdown(false);
                        }}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-muted/50 cursor-pointer text-xs font-semibold group transition-colors"
                      >
                        <span className="truncate flex-1">{name}</span>
                        <button
                          type="button"
                          onClick={e => handleDeleteCampaignName(name, e)}
                          className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-rose-600 rounded transition"
                          title="Delete this campaign name from suggestions"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* DYNAMIC FIELDS CONTAINER */}
            <div className="p-4 bg-muted/20 rounded-2xl border border-border/50 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                Performance Metrics Input ({formData.category})
              </span>

              {formData.category === "SEO" ? (
                /* SEO Dynamic Inputs */
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Organic Impressions</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.impressions}
                      onChange={e => setFormData({ ...formData, impressions: Number(e.target.value) || 0 })}
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Organic Sessions/Clicks</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.clicks}
                      onChange={e => setFormData({ ...formData, clicks: Number(e.target.value) || 0 })}
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Keywords in Top 10</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.seoKeywordsTop10}
                      onChange={e => setFormData({ ...formData, seoKeywordsTop10: Number(e.target.value) || 0 })}
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Keywords in Top 3 Podium</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.seoKeywordsTop3}
                      onChange={e => setFormData({ ...formData, seoKeywordsTop3: Number(e.target.value) || 0 })}
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono font-bold text-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Organic Leads / Inquiries</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.results}
                      onChange={e => setFormData({ ...formData, results: Number(e.target.value) || 0 })}
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono font-bold text-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Attributed Revenue ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.revenue}
                      onChange={e => setFormData({ ...formData, revenue: Number(e.target.value) || 0 })}
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono font-bold text-emerald-600"
                    />
                  </div>
                </div>
              ) : (
                /* META & GOOGLE Paid Ads Inputs */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Ad Spend ({currency}) *</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.spend}
                      onChange={e => setFormData({ ...formData, spend: Number(e.target.value) || 0 })}
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Impressions</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.impressions}
                      onChange={e => setFormData({ ...formData, impressions: Number(e.target.value) || 0 })}
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Clicks</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.clicks}
                      onChange={e => setFormData({ ...formData, clicks: Number(e.target.value) || 0 })}
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Primary Results (Volume) *</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.results}
                      onChange={e => setFormData({ ...formData, results: Number(e.target.value) || 0 })}
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Result Metric Label</label>
                    <input
                      type="text"
                      value={formData.resultLabel}
                      onChange={e => setFormData({ ...formData, resultLabel: e.target.value })}
                      placeholder="e.g. Purchases, Leads"
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Tracked Revenue ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.revenue}
                      onChange={e => setFormData({ ...formData, revenue: Number(e.target.value) || 0 })}
                      className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono font-bold text-emerald-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Daily Remarks / Notes */}
            <div>
              <label className="block font-bold text-muted-foreground uppercase text-[10px] mb-1">
                Daily Optimization Remarks / Notes
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g. Swapped creative to testimonial video; scaled daily budget by 15%"
                className="w-full px-3 h-10 rounded-xl border border-border/60 bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEntryModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-md shadow-primary/20 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isSubmitting ? "Saving..." : "Save Record"}</span>
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: FULL-SCREEN INTERACTIVE DATA EXPLORER */}
      <Dialog open={isFullTableModalOpen} onOpenChange={setIsFullTableModalOpen}>
        <DialogContent className="max-w-6xl w-[calc(100vw-1rem)] sm:w-[95vw] h-[92dvh] sm:h-[90vh] bg-card border-border/60 rounded-2xl sm:rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col">
          <div className="px-4 sm:px-6 py-3 sm:py-4 pr-12 sm:pr-14 border-b border-border/50 bg-muted/20 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1 basis-60">
              <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black shrink-0">
                <Table2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm sm:text-base font-black text-foreground leading-snug">
                  All Campaigns Data Ledger (Full Screen)
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Complete dataset with custom filtering and CSV export for {clientName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportLedgerToCSV}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Quick channel tabs inside full modal */}
          <div className="px-4 sm:px-6 py-2.5 bg-muted/30 border-b border-border/40 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar max-w-full">
              <span className="text-muted-foreground font-bold shrink-0">Channel:</span>
              {["ALL", "META", "GOOGLE", "SEO"].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategoryFilter(cat)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0",
                    activeCategoryFilter === cat
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card text-muted-foreground hover:text-foreground border border-border/40"
                  )}
                >
                  {cat === "ALL" ? "All" : cat === "META" ? "Meta Ads" : cat === "GOOGLE" ? "Google Ads" : "SEO"}
                </button>
              ))}
            </div>
            <div className="text-muted-foreground font-bold text-xs whitespace-nowrap">
              Showing <span className="text-foreground">{filteredRecords.length}</span> records
            </div>
          </div>

          {/* Scrollable table container */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[750px]">
              <thead className="sticky top-0 bg-muted/90 backdrop-blur-md text-muted-foreground font-black uppercase text-[10px] tracking-wider border-b border-border/60 z-10 shadow-xs">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Sub-Type</th>
                  <th className="py-3 px-4">Campaign Name / Scope</th>
                  <th className="py-3 px-4 text-right">Ad Spend</th>
                  <th className="py-3 px-4 text-right">Impressions</th>
                  <th className="py-3 px-4 text-right">Clicks/Traffic</th>
                  <th className="py-3 px-4 text-right">Results</th>
                  <th className="py-3 px-4 text-right">Unit CPL</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                  <th className="py-3 px-4 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-foreground font-medium">
                {filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold whitespace-nowrap text-muted-foreground">{rec.date}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-muted text-foreground border border-border/60">
                        {rec.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">{rec.subType}</td>
                    <td className="py-3 px-4 font-bold text-foreground max-w-[280px] truncate" title={rec.name}>{rec.name}</td>
                    <td className="py-3 px-4 text-right font-mono font-black">{formatMoney(rec.spend)}</td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">{rec.impressions.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">{rec.clicks.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">{rec.results} {rec.resultLabel || ""}</td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">{rec.cpl > 0 ? formatMoney(rec.cpl) : "—"}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">{rec.revenue > 0 ? formatMoney(rec.revenue) : "—"}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-600">{rec.roas > 0 ? `${rec.roas}x` : "—"}</td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-sm font-semibold text-muted-foreground">
                      No campaign records found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Executive Client Performance Intelligence Report Modal with Live Records */}
      <ExecutivePerformanceReportModal
        isOpen={isReportModalOpen || !!isReportOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          onCloseReport?.();
        }}
        clientName={clientName}
        companyName={companyName}
        records={records}
      />
    </div>
  );
};
