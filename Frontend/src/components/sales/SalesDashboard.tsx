import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  IndianRupee,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  Sparkles,
  ArrowRight,
  CalendarDays,
  Phone,
  FileText,
  UserCheck,
  MessageCircle,
  StickyNote,
  Download,
  UserPlus,
  CalendarPlus,
  Zap,
  Award,
  Activity,
  Eye,
  Plus,
  Upload,
  FileSpreadsheet,
  Bell,
  ListTodo,
  ArrowRightLeft,
  ChevronDown,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList,
} from "recharts";
import { cn, formatDate } from "@/lib/utils";
import {
  dashboardStats as stats,
  revenueVsTarget,
  conversionFunnel,
  leadSourceData,
  categoryMix,
  monthlyGrowth,
  aiInsights,
  founderSnapshot as snap,
  formatCurrency,
} from "./sales-data";
import { useSales } from "./SalesContext";

/* ─── Tiny reusable components ─────────────────────────────────────────── */

function StatCard({
  label, value, sub, icon: Icon, trend, color = "emerald",
}: {
  label: string; value: string; sub?: string; icon?: typeof TrendingUp; trend?: "up" | "down" | "neutral"; color?: string;
}) {
  const [period, setPeriod] = useState("last month");
  const [isOpen, setIsOpen] = useState(false);
  const periods = ["yesterday", "last week", "last month", "last quarter", "last year"];

  return (
    <div className="group relative rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tracking-tight">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
            color === "emerald" && "bg-emerald-50 text-emerald-600",
            color === "blue" && "bg-blue-50 text-blue-600",
            color === "amber" && "bg-amber-50 text-amber-600",
            color === "rose" && "bg-rose-50 text-rose-600",
            color === "violet" && "bg-violet-50 text-violet-600",
            color === "cyan" && "bg-cyan-50 text-cyan-600",
          )}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1 text-[11px]">
          {trend === "up" ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : trend === "down" ? <TrendingDown className="h-3 w-3 text-rose-500" /> : null}
          <div className="relative inline-block">
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className={cn(
                "flex items-center gap-0.5 hover:underline decoration-dashed underline-offset-2 transition-colors",
                trend === "up" ? "text-emerald-700 hover:text-emerald-800" : trend === "down" ? "text-rose-700 hover:text-rose-800" : "text-muted-foreground hover:text-foreground"
              )}
            >
              vs {period} <ChevronDown className="h-3 w-3" />
            </button>
            {isOpen && (
              <div className="absolute left-0 top-full mt-1 z-20 w-28 rounded-lg border border-border bg-white shadow-lg overflow-hidden animate-in fade-in zoom-in-95">
                {periods.map(p => (
                  <button 
                    key={p} 
                    onClick={() => { setPeriod(p); setIsOpen(false); }}
                    className={cn(
                      "block w-full text-left px-3 py-2 text-[11px] font-medium transition-colors hover:bg-muted",
                      period === p ? "text-emerald-700 bg-emerald-50" : "text-muted-foreground"
                    )}
                  >
                    vs {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: { label: string; onClick?: () => void } }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && (
        <button onClick={action.onClick} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50">
          {action.label} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function HealthScore() {
  const score = stats.salesHealthScore;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-700">Sales Health Score</p>
      <div className="relative h-28 w-28">
        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="8" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--chart-1)" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-emerald-700">{score}</span>
          <span className="text-[10px] text-emerald-600">out of 100</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-emerald-600">+6 pts vs last week</p>
    </div>
  );
}

/* ─── Quick Actions Grid ───────────────────────────────────────────────── */

const quickActionList = [
  { label: "Add Lead", icon: Plus },
  { label: "Bulk Upload Leads", icon: Upload },
  { label: "Import CSV", icon: FileText },
  { label: "Export Excel", icon: FileSpreadsheet },
  { label: "Export PDF", icon: FileText },
  { label: "Add Meeting", icon: CalendarPlus },
  { label: "Schedule Follow-up", icon: Bell },
  { label: "Create Task", icon: ListTodo },
  { label: "Create Quotation", icon: FileText },
  { label: "Convert Lead", icon: ArrowRightLeft },
  { label: "Add Payment", icon: IndianRupee },
  { label: "Add Note", icon: FileText },
];

function QuickActions({ onAction }: { onAction: (label: string) => void }) {
  return (
    <div className="rounded-2xl border border-emerald-100/50 bg-gradient-to-br from-emerald-50/40 to-white p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-bold tracking-tight text-foreground">Quick Actions</h2>
        <p className="text-[11px] text-muted-foreground">Everything one tap away</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {quickActionList.map(({ label, icon: Icon }) => (
          <button key={label} onClick={() => onAction(label)} className="group flex flex-col items-start gap-3 rounded-xl border border-emerald-100/50 bg-white p-3.5 text-left shadow-sm transition-all hover:border-emerald-200 hover:shadow-md">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100/60 text-emerald-600 transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-700">
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-bold leading-tight text-foreground/80 group-hover:text-foreground">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Charts ───────────────────────────────────────────────────────────── */

function RevenueChart() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionTitle title="Revenue vs Target" subtitle="Rolling 12 months" />
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={revenueVsTarget}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip formatter={(v: number) => [`₹${v}L`, ""]} />
            <Area type="monotone" dataKey="target" stroke="var(--chart-1)" strokeDasharray="4 4" fill="none" strokeWidth={2} />
            <Area type="monotone" dataKey="revenue" stroke="var(--chart-2)" fill="url(#revGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FunnelChartSection() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionTitle title="Conversion Funnel" subtitle="Lead to won journey" />
      <div className="mt-4 space-y-2">
        {conversionFunnel.map((item, i) => {
          const maxVal = conversionFunnel[0]?.value || 1;
          const pct = (item.value / maxVal) * 100;
          return (
            <div key={item.stage} className="flex items-center gap-3">
              <span className="w-20 text-right text-xs font-medium text-muted-foreground">{item.stage}</span>
              <div className="flex-1">
                <div className="h-7 overflow-hidden rounded-lg bg-muted/50" style={{ width: "100%" }}>
                  <div
                    className="flex h-full items-center rounded-lg px-2 text-[11px] font-bold text-white transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                  >
                    {item.value.toLocaleString()}
                  </div>
                </div>
              </div>
              {i > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {((item.value / (conversionFunnel[i - 1]?.value || 1)) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeadSourceChart() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionTitle title="Lead Source Analysis" />
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={leadSourceData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="source" type="category" tick={{ fontSize: 10 }} width={75} />
            <Tooltip />
            <Bar dataKey="leads" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={12} name="Leads" />
            <Bar dataKey="won" fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={12} name="Won" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CategoryPieChart() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionTitle title="Category Mix" />
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={categoryMix} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
              {categoryMix.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => [`${v}%`, ""]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {categoryMix.map((c) => (
          <span key={c.name} className="flex items-center gap-1 text-[10px]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function MonthlyGrowthChart() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionTitle title="Monthly Growth" />
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyGrowth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: number) => [`${v}%`, "Growth"]} />
            <Bar dataKey="growth" radius={[6, 6, 0, 0]} barSize={28}>
              {monthlyGrowth.map((entry, i) => (
                <Cell key={i} fill={entry.growth >= 0 ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Founder Snapshot ─────────────────────────────────────────────────── */

function FounderSnapshot({ setActive }: { setActive?: (path: string) => void }) {
  const items = [
    { label: "Top Performer", value: snap.topPerformer.name, sub: `${snap.topPerformer.pct}% of target`, color: "emerald" },
    { label: "Bottom Performer", value: snap.bottomPerformer.name, sub: `${snap.bottomPerformer.pct}% of target`, color: "rose" },
    { label: "Revenue Today", value: formatCurrency(snap.revenueToday), sub: `${snap.revenuePayments} payments received`, color: "blue" },
    { label: "Revenue This Month", value: formatCurrency(snap.revenueMonth), sub: `${snap.revenueMonthPct}% of ₹50 L target`, color: "emerald" },
    { label: "Pending Payments", value: formatCurrency(snap.pendingPayments), sub: `${snap.pendingInvoices} invoices`, color: "amber" },
    { label: "Pending Proposals", value: String(snap.pendingProposals), sub: `${formatCurrency(snap.pendingProposalValue)} value`, color: "violet" },
    { label: "Highest Lead Source", value: snap.highestLeadSource, sub: `${snap.highestLeadSourceLeads} leads · ${snap.highestLeadSourceWon} won`, color: "blue" },
    { label: "Best Category", value: snap.bestCategory, sub: `${formatCurrency(snap.bestCategoryRevenue)} revenue`, color: "amber" },
    { label: "Best Campaign", value: snap.bestCampaign, sub: `ROAS ${snap.bestCampaignROAS}x`, color: "emerald" },
    { label: "Upcoming Closings", value: `${snap.upcomingClosings} deals`, sub: `${formatCurrency(snap.upcomingClosingsValue)} this week`, color: "cyan" },
    { label: "Inactive Leads", value: String(snap.inactiveLeads), sub: `No activity ${snap.inactiveDays}+ days`, color: "rose" },
    { label: "Overdue Follow-up Owners", value: `${snap.overdueFollowUpOwners.length} employees`, sub: snap.overdueFollowUpOwners.join(", "), color: "amber" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionTitle title="Founder Snapshot" action={{ label: "Team performance", onClick: () => setActive?.("/work/sales/team") }} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-background p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-sm font-bold">{item.value}</p>
            <p className="text-[11px] text-muted-foreground">{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── AI Insights ──────────────────────────────────────────────────────── */

function AIInsights() {
  const iconMap: Record<string, typeof Sparkles> = {
    convert: TrendingUp,
    cold: AlertTriangle,
    timing: Clock,
    action: Zap,
    summary: Activity,
  };
  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-600" />
        <h2 className="text-lg font-bold">AI Sales Intelligence</h2>
      </div>
      <div className="mt-4 space-y-3">
        {aiInsights.map((insight) => {
          const Icon = iconMap[insight.type] || Sparkles;
          return (
            <div key={insight.title} className="flex gap-3 rounded-xl border border-border bg-white/70 p-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-600">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-violet-700">{insight.title}</p>
                <p className="text-[12px] leading-relaxed text-muted-foreground">{insight.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Hot Leads ────────────────────────────────────────────────────────── */

function HotLeads({ setActive }: { setActive?: (path: string) => void }) {
  const { leads } = useSales();
  const hotLeads = useMemo(
    () => leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost").sort((a, b) => b.aiScore - a.aiScore).slice(0, 6),
    [leads],
  );

  const stageColor: Record<string, string> = {
    "New Lead": "bg-primary/10 text-primary",
    Contacted: "bg-violet-100 text-violet-700",
    Meeting: "bg-blue-100 text-blue-700",
    Demo: "bg-cyan-100 text-cyan-700",
    Proposal: "bg-amber-100 text-amber-700",
    Negotiation: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionTitle title="Hot Leads Needing Attention" subtitle="Ranked by AI lead score" action={{ label: "All leads", onClick: () => setActive?.("/work/sales/leads") }} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {hotLeads.map((lead) => (
          <div key={lead.id} className="group cursor-pointer rounded-xl border border-border bg-background p-4 transition-all hover:border-emerald-300 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{lead.company}</p>
                <p className="text-xs text-muted-foreground">{lead.contact} · {lead.city}</p>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-sm font-black text-emerald-700">
                {lead.aiScore}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", stageColor[lead.stage] || "bg-gray-100 text-gray-700")}>
                {lead.stage}
              </span>
              <span className="text-xs font-semibold">{formatCurrency(lead.budget)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Dashboard Component ─────────────────────────────────────────── */

export function SalesDashboard({ setActive, onAction }: { setActive?: (path: string) => void; onAction?: (action: string) => void }) {
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">CEO Sales Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { day: '2-digit', month: '2-digit', year: 'numeric' })} · Complete sales operating system for HK DigiVerse
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative z-50">
            <button 
              onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <Zap className="h-4 w-4" /> Quick Actions <ChevronDown className="h-3 w-3" />
            </button>
            {isQuickActionsOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-white p-2 shadow-xl animate-in fade-in zoom-in-95">
                <div className="mb-2 px-2 pb-2 border-b border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</p>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {quickActionList.map(({ label, icon: Icon }) => (
                    <button 
                      key={label}
                      onClick={() => { onAction?.(label); setIsQuickActionsOpen(false); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <Icon className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setActive?.("/work/sales/analytics")} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent">Analytics</button>
          <button onClick={() => setActive?.("/work/sales/pipeline")} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent">Pipeline</button>
        </div>
      </div>

      {/* Morning Brief + Health */}
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-6">
          <h2 className="text-xl font-bold">Good Morning, Het 👋</h2>
          <p className="text-sm text-muted-foreground">Here is today's sales summary.</p>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {[
              ["42", "follow-ups due today"],
              ["8", "meetings scheduled"],
              ["3", "proposals pending"],
              ["₹8,45,000", "pipeline value"],
              ["6", "hot leads need attention"],
              ["2", "leads haven't been contacted for 5 days"],
              ["68%", "Revenue achieved of monthly target"],
              ["₹12.8 Lakhs", "Expected closing this week"],
            ].map(([val, label]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-emerald-700">{val}</span>
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <HealthScore />
      </div>

      {/* Stat Grid — 20 metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        <StatCard label="Today's Revenue" value="₹1.42 L" icon={IndianRupee} color="emerald" trend="up" />
        <StatCard label="Monthly Revenue" value="₹34.10 L" sub="68% of target" icon={IndianRupee} color="blue" trend="up" />
        <StatCard label="Monthly Target" value="₹50.00 L" sub="68% of target" icon={Target} color="amber" />
        <StatCard label="Achievement %" value="68.2%" sub="68% of target" icon={TrendingUp} color="emerald" />
        <StatCard label="Today's Leads" value="37" icon={Users} color="blue" trend="up" />
        <StatCard label="Active Leads" value="412" icon={Users} color="violet" />
        <StatCard label="Hot Leads" value="64" icon={Flame} color="rose" />
        <StatCard label="Qualified Leads" value="148" icon={CheckCircle2} color="emerald" />
        <StatCard label="Proposal Sent" value="52" icon={FileText} color="amber" />
        <StatCard label="Negotiation" value="28" icon={Activity} color="cyan" />
        <StatCard label="Won Deals" value="31" sub="74% of target" icon={CheckCircle2} color="emerald" trend="up" />
        <StatCard label="Lost Deals" value="17" icon={XCircle} color="rose" trend="down" />
        <StatCard label="Today's Follow-ups" value="42" sub="55% of target" icon={Phone} color="blue" />
        <StatCard label="Overdue Follow-ups" value="11" icon={AlertTriangle} color="rose" />
        <StatCard label="Average Deal Size" value="₹1.86 L" icon={IndianRupee} color="emerald" trend="up" />
        <StatCard label="Lead Conversion %" value="24.6%" sub="62% of target" icon={TrendingUp} color="violet" />
        <StatCard label="Sales Cycle (Days)" value="27" icon={Clock} color="cyan" />
        <StatCard label="Revenue Forecast" value="₹48.20 L" sub="82% of target" icon={BarChart3} color="emerald" trend="up" />
        <StatCard label="Collection Pending" value="₹9.65 L" icon={IndianRupee} color="amber" />
        <StatCard label="Target Remaining" value="₹15.90 L" sub="32% of target" icon={Target} color="rose" />
      </div>



      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueChart />
        <FunnelChartSection />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <LeadSourceChart />
        <CategoryPieChart />
        <MonthlyGrowthChart />
      </div>

      {/* Founder Snapshot + AI */}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <FounderSnapshot setActive={setActive!} />
        <AIInsights />
      </div>

      {/* Hot Leads */}
      <HotLeads setActive={setActive!} />
    </div>
  );
}
