import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CASH_FLOW, PROFIT_TREND } from "../dashboard-data";
import { CollapsibleSection } from "./CollapsibleSection";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";

const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function FinanceOverview() {
  // Pending payments BIG (Audio PDF) — live outstanding from project finance.
  const { data } = useDashboardOverview();
  const fin = data?.finance_pending || { total_budget: 0, total_received: 0, outstanding: 0 };
  const collectedPct = fin.total_budget > 0 ? Math.round((fin.total_received / fin.total_budget) * 100) : 0;

  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 08" title="Finance Overview">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending payments — BIG */}
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-w-0 lg:row-span-1">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Outstanding Payments</p>
            <p className="text-4xl font-black text-rose-600 leading-none">{inr(fin.outstanding)}</p>
            <p className="text-[11px] text-muted-foreground mt-2 font-semibold">Receivable from clients</p>
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex justify-between items-center bg-muted/50 border border-border/50 rounded-2xl px-4 py-3">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Total Budget</span>
              <span className="text-lg font-black text-foreground">{inr(fin.total_budget)}</span>
            </div>
            <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
              <span className="text-[11px] font-bold text-emerald-600 uppercase">Received</span>
              <span className="text-lg font-black text-emerald-700">{inr(fin.total_received)}</span>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground mb-1">
                <span>Collection</span><span>{collectedPct}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, collectedPct)}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Cash Flow */}
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm min-w-0 overflow-hidden">
          <div className="mb-6">
            <h3 className="font-bold text-foreground">Cash Flow</h3>
            <p className="text-[11px] text-muted-foreground">Revenue vs expense (₹ thousands)</p>
          </div>
          <div className="h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CASH_FLOW} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#00A56C" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit Trend */}
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm min-w-0 overflow-hidden">
          <div className="mb-6">
            <h3 className="font-bold text-foreground">Profit Trend</h3>
            <p className="text-[11px] text-muted-foreground">Net profit per month</p>
          </div>
          <div className="h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={PROFIT_TREND} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="profit" stroke="#00A56C" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
