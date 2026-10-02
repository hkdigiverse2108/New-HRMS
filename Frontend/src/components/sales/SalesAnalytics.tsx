import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import { useSales } from "./SalesContext";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5 min-w-0 overflow-hidden", className)}>
      <div className="mb-4">
        <h3 className="text-sm font-bold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function SalesAnalytics({ onAction }: { onAction?: (action: string) => void }) {
  const { leads, targets, wonLeads, lostLeads, wonRevenue } = useSales();
  const { employees } = useEmployeesContext();

  // Dynamic Revenue Trend (Rolling 6 Months)
  const dynamicRevenueTrend = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const result = [];
    const totalTargetLakhs = targets.reduce((s, t) => s + (Number(t.targetAmount) || 0), 0) / 100000 || 50;

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
        target: Math.round((totalTargetLakhs / 6) * 10) / 10,
      });
    }
    return result;
  }, [leads, targets]);

  // Dynamic Conversion Funnel
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

  // Dynamic Lead Sources
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

  // Dynamic Category Mix
  const dynamicCategories = useMemo(() => {
    const catMap: Record<string, number> = {};
    leads.forEach((l) => {
      const c = l.category || "General";
      catMap[c] = (catMap[c] || 0) + 1;
    });
    const palette = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#64748b"];
    const total = leads.length || 1;
    return Object.entries(catMap).slice(0, 6).map(([name, count], i) => ({
      name,
      value: Math.round((count / total) * 100),
      color: palette[i] || "#10b981",
    }));
  }, [leads]);

  // Dynamic Salesperson Performance
  const dynamicSalespersonPerformance = useMemo(() => {
    const salesEmps = employees.filter((e) => {
      const dept = (e.department || "").toLowerCase();
      const role = (e.role || "").toLowerCase();
      return dept.includes("sale") || role.includes("sale") || role.includes("bde");
    });

    const activeEmps = salesEmps.length > 0 ? salesEmps : employees.slice(0, 5);

    return activeEmps.map((emp) => {
      const empName = emp.name;
      const empLeads = leads.filter((l) => {
        const assigned = Array.isArray(l.assignedTo) ? l.assignedTo : [l.assignedTo || l.owner];
        return assigned.some((a: any) => String(a).toLowerCase().includes(empName.toLowerCase()));
      });

      const won = empLeads.filter((l) => ["Client Won", "Won"].includes(l.status || l.stage || ""));
      const rev = won.reduce((acc, l) => acc + (Number(l.budget || l.expectedIncome) || 0), 0);
      const tgt = targets.find((t) => t.employeeId === emp.id || t.employeeName === empName)?.targetAmount || 1000000;

      return {
        name: empName.split(" ")[0] || "User",
        revenue: Math.round((rev / 100000) * 10) / 10,
        target: Math.round((tgt / 100000) * 10) / 10,
      };
    });
  }, [employees, leads, targets]);

  // Dynamic Lost Reasons
  const dynamicLostReasons = useMemo(() => {
    const reasonsMap: Record<string, number> = {};
    lostLeads.forEach((l) => {
      const r = (l as any).reason || l.remarks || "Lost to competitor";
      reasonsMap[r] = (reasonsMap[r] || 0) + 1;
    });

    const total = lostLeads.length || 1;
    const entries = Object.entries(reasonsMap);
    if (entries.length === 0) {
      return [{ reason: "No lost deals recorded", count: 0, pct: 0 }];
    }
    return entries.slice(0, 5).map(([reason, count]) => ({
      reason,
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [lostLeads]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Sales Analytics</h1>
          <p className="text-sm text-muted-foreground">Every number you need to steer revenue — updated live</p>
        </div>
        <button onClick={() => onAction?.("Export PDF")} className="flex items-center gap-1.5 self-start rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-emerald-700">
          <Download className="h-4 w-4" /> Export Report
        </button>
      </div>

      {/* Row 1: Revenue Trend & Funnel */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Revenue Trend" subtitle="6-month actual vs target">
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicRevenueTrend}>
                <defs>
                  <linearGradient id="aRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}L`} />
                <Tooltip formatter={(v: number) => [`₹${v}L`, ""]} />
                <Legend />
                <Area type="monotone" dataKey="target" stroke="#f59e0b" strokeDasharray="4 4" fill="none" strokeWidth={2} name="Target" />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#aRevGrad)" strokeWidth={2.5} name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Conversion Funnel" subtitle={`${leads.length} total leads → ${wonLeads.length} won`}>
          <div className="space-y-2.5">
            {dynamicFunnel.map((item) => {
              const maxVal = Math.max(...dynamicFunnel.map(d => d.value), 1);
              const pct = Math.max(12, Math.round((item.value / maxVal) * 100));
              return (
                <div key={item.stage} className="flex items-center gap-3">
                  <span className="w-20 text-right text-xs font-medium text-muted-foreground truncate">{item.stage}</span>
                  <div className="flex-1">
                    <div className="h-8 overflow-hidden rounded-lg bg-muted/40">
                      <div
                        className="flex h-full items-center rounded-lg px-3 text-xs font-bold text-white transition-all duration-700"
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
        </ChartCard>
      </div>

      {/* Row 2: Sources & Categories */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Lead Source Analysis" subtitle="Leads vs won by channel">
          <div className="h-72 w-full min-w-0">
            {dynamicSources.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No source data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dynamicSources} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="source" type="category" tick={{ fontSize: 10 }} width={75} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="leads" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={10} name="Leads" />
                  <Bar dataKey="won" fill="#10b981" radius={[0, 4, 4, 0]} barSize={10} name="Won" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Lead Category Analysis" subtitle="Volume share by business category">
          <div className="h-72 w-full min-w-0">
            {dynamicCategories.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No category data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dynamicCategories} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {dynamicCategories.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}%`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {dynamicCategories.map((c) => (
              <span key={c.name} className="flex items-center gap-1 text-[10px]">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name} ({c.value}%)
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Row 3: Salesperson Performance & Lost Reasons */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Salesperson Performance" subtitle="Revenue vs target achievement">
          <div className="h-72 w-full min-w-0">
            {dynamicSalespersonPerformance.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No sales employees data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dynamicSalespersonPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}L`} />
                  <Tooltip formatter={(v: number) => [`₹${v}L`, ""]} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} name="Revenue" />
                  <Bar dataKey="target" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={16} name="Target" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Lost Reason Analysis" subtitle="Root causes for lost deals">
          <div className="space-y-2.5">
            {dynamicLostReasons.map((r) => (
              <div key={r.reason}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{r.reason}</span>
                  <span className="text-xs text-muted-foreground">{r.count} ({r.pct}%)</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/50">
                  <div className="h-full rounded-full bg-rose-400 transition-all duration-700" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
