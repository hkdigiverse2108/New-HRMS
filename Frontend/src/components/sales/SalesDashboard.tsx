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
  Phone,
  FileText,
  Activity,
  Plus,
  Upload,
  FileSpreadsheet,
  Bell,
  ListTodo,
  ArrowRightLeft,
  ChevronDown,
  Zap,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency, aiInsights, type Lead } from "./sales-data";
import { useSales } from "./SalesContext";
import { useAuth } from "@/components/auth/AuthContext";

/* ─── Tiny reusable components ─────────────────────────────────────────── */

function StatCard({
  label, value, sub, icon: Icon, trend, color = "emerald",
}: {
  label: string; value: string; sub?: string; icon?: any; trend?: "up" | "down" | "neutral"; color?: string;
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
          {trend === "up" ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-rose-500" />}
          <div className="relative inline-block">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "flex items-center gap-0.5 hover:underline decoration-dashed underline-offset-2 transition-colors",
                trend === "up" ? "text-emerald-700 hover:text-emerald-800" : "text-rose-700 hover:text-rose-800"
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

function HealthScore({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, score || 85));
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (safeScore / 100) * circumference;
  return (
    <div className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-700">Sales Health Score</p>
      <div className="relative h-28 w-28">
        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="8" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-foreground">{safeScore}</span>
          <span className="text-[10px] font-bold text-muted-foreground">OUT OF 100</span>
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-emerald-700">
        {safeScore >= 80 ? "Optimal Performance" : safeScore >= 50 ? "Steady Growth" : "Attention Needed"}
      </p>
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
  { label: "Schedule Follow-up", icon: Bell },
  { label: "Create Task", icon: ListTodo },
  { label: "Convert Lead", icon: ArrowRightLeft },
  { label: "Add Payment", icon: IndianRupee },
];

/* ─── Main Dashboard Component ─────────────────────────────────────────── */

export function SalesDashboard({ setActive, onAction }: { setActive?: (path: string) => void; onAction?: (action: string) => void }) {
  const { user } = useAuth();
  const {
    leads,
    targets,
    activeLeads,
    wonLeads,
    lostLeads,
    pipelineValue,
    wonRevenue,
    winRate,
    todayFollowUps,
    overdueFollowUps,
    hotLeads,
  } = useSales();

  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  const firstName = (user?.name || "User").split(" ")[0];

  // Dynamic KPI Aggregations
  const totalTarget = useMemo(() => {
    return targets.reduce((sum, t) => sum + (Number(t.targetAmount) || 0), 0) || 5000000;
  }, [targets]);

  const targetPct = totalTarget > 0 ? Math.round((wonRevenue / totalTarget) * 100) : 0;
  const avgDealSize = wonLeads.length > 0 ? Math.round(wonRevenue / wonLeads.length) : 0;

  // Conversion Funnel Data dynamically derived from live leads
  const dynamicFunnel = useMemo(() => {
    const stageCounts: Record<string, number> = {
      "New Lead": 0,
      Contacted: 0,
      Proposal: 0,
      Negotiation: 0,
      Won: 0,
    };
    leads.forEach((l) => {
      const st = (l.stage || l.status || "Lead").toLowerCase();
      if (st.includes("won")) stageCounts["Won"] = (stageCounts["Won"] ?? 0) + 1;
      else if (st.includes("propos")) stageCounts["Proposal"] = (stageCounts["Proposal"] ?? 0) + 1;
      else if (st.includes("negotiat")) stageCounts["Negotiation"] = (stageCounts["Negotiation"] ?? 0) + 1;
      else if (st.includes("contact")) stageCounts["Contacted"] = (stageCounts["Contacted"] ?? 0) + 1;
      else stageCounts["New Lead"] = (stageCounts["New Lead"] ?? 0) + 1;
    });

    const colors = ["#3b82f6", "#8b5cf6", "#f59e0b", "#f97316", "#10b981"];
    const stagesList = ["New Lead", "Contacted", "Proposal", "Negotiation", "Won"];
    return stagesList.map((stage, idx) => ({
      stage,
      value: stageCounts[stage] ?? 0,
      color: colors[idx] ?? "#10b981",
    }));
  }, [leads]);

  // Lead Source breakdown
  const dynamicSources = useMemo(() => {
    const srcMap: Record<string, { leads: number; won: number }> = {};
    leads.forEach((l) => {
      const s = l.source || "Website";
      if (!srcMap[s]) srcMap[s] = { leads: 0, won: 0 };
      srcMap[s].leads += 1;
      if (["Client Won", "Won"].includes(l.status || l.stage || "")) {
        srcMap[s].won += 1;
      }
    });
    return Object.entries(srcMap).slice(0, 6).map(([source, data]) => ({
      source,
      leads: data.leads,
      won: data.won,
    }));
  }, [leads]);

  // Health Score Calculation
  const healthScore = useMemo(() => {
    if (leads.length === 0) return 85;
    const followUpPenalty = Math.min(25, overdueFollowUps.length * 5);
    const winScore = Math.min(40, winRate * 0.4);
    const achieveScore = Math.min(35, targetPct * 0.35);
    return Math.max(10, Math.round(winScore + achieveScore + (25 - followUpPenalty)));
  }, [leads, overdueFollowUps, winRate, targetPct]);

  // Rolling 6 months Revenue chart dynamically calculated
  const dynamicRevenueChart = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const mName = months[mIdx] ?? "";
      const monthPrefix = `${d.getFullYear()}-${String(mIdx + 1).padStart(2, "0")}`;

      const monthWon = leads.filter((l) => {
        const isWon = ["Client Won", "Won"].includes(l.status || l.stage || "");
        const closed = l.closedDate || l.date || "";
        return isWon && closed.startsWith(monthPrefix);
      }).reduce((acc, l) => acc + (Number(l.budget || l.expectedIncome) || 0), 0);

      result.push({
        month: mName,
        revenue: Math.round((monthWon / 100000) * 10) / 10,
        target: Math.round((totalTarget / 600000) * 10) / 10,
      });
    }
    return result;
  }, [leads, totalTarget]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">CEO Sales Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { day: '2-digit', month: '2-digit', year: 'numeric' })} · Live sales operating system for HK DigiVerse
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative z-50">
            <button
              onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 min-h-[44px] sm:min-h-0 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
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
          <button onClick={() => setActive?.("/work/sales/analytics")} className="rounded-lg border border-border px-3 sm:px-4 py-2 min-h-[44px] sm:min-h-0 text-sm font-semibold transition-colors hover:bg-accent">Analytics</button>
          <button onClick={() => setActive?.("/work/sales/pipeline")} className="rounded-lg border border-border px-3 sm:px-4 py-2 min-h-[44px] sm:min-h-0 text-sm font-semibold transition-colors hover:bg-accent">Pipeline</button>
        </div>
      </div>

      {/* Morning Brief + Health */}
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 sm:p-6 min-w-0">
          <h2 className="text-xl font-bold">Good Morning, {firstName} 👋</h2>
          <p className="text-sm text-muted-foreground">Here is today's real-time sales overview.</p>
          <div className="mt-4 grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
            {[
              [String(todayFollowUps.length), "follow-ups due today"],
              [String(hotLeads.length), "hot leads needing attention"],
              [String(overdueFollowUps.length), "overdue follow-ups"],
              [formatCurrency(pipelineValue), "live pipeline value"],
              [String(wonLeads.length), "deals won"],
              [String(activeLeads.length), "active leads in progress"],
              [`${targetPct}%`, "revenue target achieved"],
              [formatCurrency(wonRevenue), "total closed revenue"],
            ].map(([val, label]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-emerald-700">{val}</span>
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <HealthScore score={healthScore} />
      </div>

      {/* Stat Grid — 20 live metrics */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        <StatCard label="Pipeline Value" value={formatCurrency(pipelineValue)} icon={IndianRupee} color="emerald" trend="up" />
        <StatCard label="Won Revenue" value={formatCurrency(wonRevenue)} sub={`${targetPct}% of target`} icon={IndianRupee} color="blue" trend="up" />
        <StatCard label="Monthly Target" value={formatCurrency(totalTarget)} icon={Target} color="amber" />
        <StatCard label="Achievement %" value={`${targetPct}%`} icon={TrendingUp} color="emerald" />
        <StatCard label="Total Leads" value={String(leads.length)} icon={Users} color="blue" />
        <StatCard label="Active Leads" value={String(activeLeads.length)} icon={Users} color="violet" />
        <StatCard label="Hot Leads" value={String(hotLeads.length)} icon={Flame} color="rose" />
        <StatCard label="Won Deals" value={String(wonLeads.length)} icon={CheckCircle2} color="emerald" trend="up" />
        <StatCard label="Lost Deals" value={String(lostLeads.length)} icon={XCircle} color="rose" trend="down" />
        <StatCard label="Today's Follow-ups" value={String(todayFollowUps.length)} icon={Phone} color="blue" />
        <StatCard label="Overdue Follow-ups" value={String(overdueFollowUps.length)} icon={AlertTriangle} color="rose" />
        <StatCard label="Average Deal Size" value={formatCurrency(avgDealSize)} icon={IndianRupee} color="emerald" trend="up" />
        <StatCard label="Win Rate %" value={`${winRate}%`} icon={TrendingUp} color="violet" />
        <StatCard label="Remaining Target" value={formatCurrency(Math.max(0, totalTarget - wonRevenue))} icon={Target} color="rose" />
      </div>

      {/* Charts Row 1: Funnel & Revenue Trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 min-w-0 overflow-hidden">
          <SectionTitle title="Revenue vs Target" subtitle="Rolling 6 months" />
          <div className="mt-4 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicRevenueChart}>
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
                <Area type="monotone" dataKey="target" stroke="#f59e0b" strokeDasharray="4 4" fill="none" strokeWidth={2} name="Target" />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2.5} name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 min-w-0 overflow-hidden">
          <SectionTitle title="Conversion Funnel" subtitle="Live stages pipeline" />
          <div className="mt-4 space-y-2">
            {dynamicFunnel.map((item) => {
              const maxVal = Math.max(...dynamicFunnel.map(d => d.value), 1);
              const pct = Math.max(12, Math.round((item.value / maxVal) * 100));
              return (
                <div key={item.stage} className="flex items-center gap-2 sm:gap-3">
                  <span className="w-16 sm:w-20 text-right text-xs font-medium text-muted-foreground truncate">{item.stage}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-7 overflow-hidden rounded-lg bg-muted/50" style={{ width: "100%" }}>
                      <div
                        className="flex h-full items-center rounded-lg px-2 text-[11px] font-bold text-white transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      >
                        {item.value.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Sources & Hot Leads */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 min-w-0 overflow-hidden">
          <SectionTitle title="Lead Source Analysis" subtitle="Performance by origin" />
          <div className="mt-4 h-64 w-full min-w-0">
            {dynamicSources.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No source data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dynamicSources} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="source" type="category" tick={{ fontSize: 10 }} width={75} />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} name="Total Leads" />
                  <Bar dataKey="won" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} name="Deals Won" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Hot Leads Section */}
        <div className="rounded-2xl border border-border bg-card p-5 min-w-0">
          <SectionTitle title="Hot Leads Needing Attention" subtitle="High priority active opportunities" action={{ label: "All leads", onClick: () => setActive?.("/work/sales/leads") }} />
          {hotLeads.length === 0 ? (
            <p className="mt-4 text-xs font-semibold text-muted-foreground border border-dashed border-border rounded-xl p-6 text-center">
              No hot leads marked currently. Mark leads as 🔥 Hot to prioritize them here.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {hotLeads.slice(0, 4).map((lead) => (
                <div key={lead.id || lead._id} className="group cursor-pointer rounded-xl border border-border bg-background p-4 transition-all hover:border-emerald-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{lead.company}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.contact} · {lead.city || lead.source || ""}</p>
                    </div>
                    <span className="inline-flex items-center text-xs shrink-0">🔥</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {lead.stage || lead.status}
                    </span>
                    <span className="font-semibold">{formatCurrency(Number(lead.budget || lead.expectedIncome) || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
