import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import {
  revenueVsTarget,
  conversionFunnel,
  leadSourceData,
  categoryMix,
  salespersonPerformance,
  quarterlyGrowth,
  revenueForecast,
  avgDealSizeTrend,
  lostReasons,
} from "./sales-data";

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <div className="mb-4">
        <h3 className="text-sm font-bold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function SalesAnalytics({ onAction }: { onAction?: (action: string) => void }) {
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

      {/* Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Trend */}
        <ChartCard title="Revenue Trend" subtitle="12-month actual vs target">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueVsTarget}>
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
                <Area type="monotone" dataKey="target" stroke="var(--chart-1)" strokeDasharray="4 4" fill="none" strokeWidth={2} name="Target" />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-2)" fill="url(#aRevGrad)" strokeWidth={2.5} name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Conversion Funnel */}
        <ChartCard title="Conversion Funnel" subtitle="1,240 leads → 78 won (6.3%)">
          <div className="space-y-2.5">
            {conversionFunnel.map((item, i) => {
              const maxVal = conversionFunnel[0]?.value || 1;
              const pct = (item.value / maxVal) * 100;
              return (
                <div key={item.stage} className="flex items-center gap-3">
                  <span className="w-20 text-right text-xs font-medium text-muted-foreground">{item.stage}</span>
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
                  {i > 0 && (
                    <span className="w-10 text-right text-[10px] text-muted-foreground">
                      {((item.value / (conversionFunnel[i - 1]?.value || 1)) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      {/* Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Lead Source */}
        <ChartCard title="Lead Source Analysis" subtitle="Leads vs won by channel">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadSourceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="source" type="category" tick={{ fontSize: 10 }} width={75} />
                <Tooltip />
                <Legend />
                <Bar dataKey="leads" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={10} name="Leads" />
                <Bar dataKey="won" fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={10} name="Won" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Category Analysis */}
        <ChartCard title="Lead Category Analysis" subtitle="Volume share by business category">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryMix} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
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
                {c.name} ({c.value}%)
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Row 3 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Salesperson Performance */}
        <ChartCard title="Salesperson Performance" subtitle="Revenue vs target achievement">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salespersonPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}L`} />
                <Tooltip formatter={(v: number) => [`₹${v}L`, ""]} />
                <Legend />
                <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} barSize={16} name="Revenue" />
                <Bar dataKey="target" fill="var(--chart-2)" radius={[4, 4, 0, 0]} barSize={16} name="Target" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Quarterly Growth */}
        <ChartCard title="Quarterly Growth" subtitle="Revenue by quarter with growth %">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quarterlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="quarter" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}L`} />
                <Tooltip formatter={(v: number, name: string) => [name === "revenue" ? `₹${v}L` : `${v}%`, name === "revenue" ? "Revenue" : "Growth"]} />
                <Bar dataKey="revenue" fill="var(--chart-1)" radius={[6, 6, 0, 0]} barSize={32} name="Revenue">
                  {quarterlyGrowth.map((entry, i) => (
                    <Cell key={i} fill={entry.growth >= 0 ? "#6366f1" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Row 4 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Forecast */}
        <ChartCard title="Revenue Forecast" subtitle="AI projected vs actual, next 6 months">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}L`} />
                <Tooltip formatter={(v: number) => [`₹${v}L`, ""]} />
                <Line type="monotone" dataKey="forecast" stroke="var(--chart-1)" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 4 }} name="Forecast" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Avg Deal Size */}
        <ChartCard title="Average Deal Size" subtitle="Trending upward 5.7% MoM">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={avgDealSizeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}L`} domain={[1.4, 2.0]} />
                <Tooltip formatter={(v: number) => [`₹${v}L`, "Deal Size"]} />
                <Line type="monotone" dataKey="size" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--chart-1)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Lost Reason */}
        <ChartCard title="Lost Reason Analysis" subtitle="104 deals lost in last 90 days">
          <div className="space-y-2.5">
            {lostReasons.map((r) => (
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
