import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { PROFIT_TREND } from "../dashboard-data";
import { CollapsibleSection } from "./CollapsibleSection";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";

// Audio PDF: revenue/expense/profit by default HIDE (monopoly) — eye click = show.
const SENSITIVE_LABELS = ["Monthly Revenue", "Monthly Expense", "Net Profit"];

const fmtLakh = (n: any) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)} K`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export function CompanyHealth() {
  const [revealed, setRevealed] = useState<string[]>([]);
  const toggle = (label: string) => {
    setRevealed(prev => (prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]));
  };

  // Badha cards LIVE (overview.health) — koi mock number nahi.
  const { data } = useDashboardOverview();
  const h = data?.health || {};

  const metrics = [
    { label: "Total Employees", emoji: "👥", value: String(h.total_employees ?? 0), chartColor: "#00A56C" },
    { label: "Present Today", emoji: "🟢", value: String(h.present_today ?? 0), chartColor: "#00A56C" },
    { label: "Absent Today", emoji: "🔴", value: String(h.absent_today ?? 0), chartColor: "#e11d48" },
    { label: "Late Today", emoji: "🟠", value: String(h.late_today ?? 0), chartColor: "#f59e0b" },
    { label: "Total Interns", emoji: "🎓", value: String(h.total_interns ?? 0), chartColor: "#3b82f6" },
    { label: "Pending Leaves", emoji: "📋", value: String(h.pending_leaves ?? 0), chartColor: "#f59e0b" },
    { label: "Active Clients", emoji: "💼", value: String(h.active_clients ?? 0), chartColor: "#00A56C" },
    { label: "Running Projects", emoji: "📂", value: String(h.running_projects ?? 0), chartColor: "#3b82f6" },
    { label: "Pending Tasks", emoji: "📌", value: String(h.pending_tasks ?? 0), chartColor: "#f59e0b" },
    { label: "Monthly Revenue", emoji: "💰", value: fmtLakh(h.monthly_revenue), chartColor: "#00A56C" },
    { label: "Monthly Expense", emoji: "💸", value: "—", chartColor: "#e11d48" },
    { label: "Net Profit", emoji: "📈", value: "—", chartColor: "#00A56C" },
  ];

  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 02" title="Company Health">

      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {metrics.map((metric, i) => {
          const sensitive = SENSITIVE_LABELS.includes(metric.label);
          const hidden = sensitive && !revealed.includes(metric.label);

          return (
            <div key={i} className="bg-white border border-border/60 rounded-3xl p-5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] relative overflow-hidden flex flex-col h-[140px] min-w-0">
              <div className="flex justify-between items-start z-10">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] leading-none">{metric.emoji}</span>
                  <p className="text-[11px] font-bold text-muted-foreground">{metric.label}</p>
                </div>
                <div className="flex items-center gap-1">
                  {sensitive && (
                    <button
                      type="button"
                      onClick={() => toggle(metric.label)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={hidden ? "Show value" : "Hide value"}
                    >
                      {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 bg-primary/10 text-primary">
                    LIVE
                  </span>
                </div>
              </div>
              <p className="text-[26px] font-black text-foreground leading-none mt-3 z-10">
                {hidden ? "••••••" : metric.value}
              </p>

              <div className="text-[10px] text-muted-foreground mt-auto z-10">live data</div>

              {/* Background Sparkline */}
              <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none opacity-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={PROFIT_TREND}>
                    <defs>
                      <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={metric.chartColor} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={metric.chartColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke={metric.chartColor}
                      strokeWidth={2}
                      fill={`url(#grad-${i})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })}
        </div>
      </CollapsibleSection>
    </div>
  );
}
