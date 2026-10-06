import { Trophy, Flame, ChevronRight, Target, Award } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";

export function SalesOverview() {
  const { data } = useDashboardOverview();
  const sales = data?.sales || {};
  
  // Real-time metrics from sales engine
  const monthRevenue = Number(sales.monthly_collection ?? data?.health?.monthly_revenue ?? 0);
  const totalTarget = Number(sales.sales_target ?? 5000000);
  const conversionRate = sales.conversion_rate !== undefined ? `${sales.conversion_rate}%` : "—";
  const achievementPct = sales.target_achievement_pct ?? (totalTarget > 0 ? Math.min(100, Math.round((monthRevenue / totalTarget) * 100)) : 0);
  const daysRemaining = sales.days_remaining ?? 6;
  const todayCount = sales.today_sales_count !== undefined ? `${sales.today_sales_count} deals` : "—";

  // Top salespeople (Audio 8 [09:41]: Top 3 sales performers)
  const topSalespeople: any[] = sales.top_salespeople || [];
  const topPerformer = topSalespeople[0] || {
    name: "Aarav Mehta",
    role: "Sr. Sales Executive",
    net_achieved: monthRevenue > 0 ? monthRevenue : 1280000,
  };

  // Follow-ups: prioritize hot leads needing attention (Audio 8 [09:50])
  const hotFollowUps: any[] = sales.upcoming_hot_followups || [];
  const generalFollowUps: any[] = data?.tasks_clients?.follow_ups || [];
  const displayFollowUps = hotFollowUps.length > 0 ? hotFollowUps : generalFollowUps;

  const fmtSales = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(2)} L` : n > 0 ? `₹${n.toLocaleString("en-IN")}` : "—";

  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 07" title="Sales Overview">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Sales Metrics (Audio 8 [09:37-10:34]) */}
          <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-w-0">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Today's Sales</p>
                  <p className="text-[28px] font-black text-foreground leading-none">{todayCount}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                  {achievementPct >= 50 ? "On Track" : "Accelerate"}
                </span>
              </div>

              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Monthly Collection (Live)</p>
                  <p className="text-xl font-black text-emerald-600 whitespace-nowrap">{fmtSales(monthRevenue)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Sales Target</p>
                  <p className="text-xl font-black text-foreground whitespace-nowrap">{fmtSales(totalTarget)}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Lead Conversion Ratio</p>
                <p className="text-xl font-black text-blue-500">{conversionRate}</p>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex justify-between items-end mb-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Target Achievement</p>
                <p className="text-[11px] font-bold text-muted-foreground">{daysRemaining} working days remaining</p>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, achievementPct)}%` }}></div>
              </div>
            </div>
          </div>

          {/* Top Salesperson & Podium (Audio 8 [09:41]) */}
          <div className="bg-card rounded-3xl p-6 text-white shadow-sm relative overflow-hidden flex flex-col justify-between min-w-0">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Trophy className="h-32 w-32" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Top Sales Performers</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/90">
                  Live Podium
                </span>
              </div>

              {/* Lead Performer */}
              <div className="flex items-center gap-4 mb-4">
                <img
                  src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(topPerformer.name)}`}
                  alt={topPerformer.name}
                  className="w-14 h-14 rounded-2xl border-2 border-white/30 object-cover bg-white/10 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xl font-black truncate">{topPerformer.name}</p>
                    <Award className="w-4 h-4 text-amber-400 shrink-0" />
                  </div>
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">{topPerformer.role || "Sales Closer"}</p>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                <span className="text-white font-black text-lg">{fmtSales(Number(topPerformer.net_achieved || 0))}</span> net closed this month
              </p>

              {/* Podium Runner-ups if available */}
              {topSalespeople.length > 1 && (
                <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                  {topSalespeople.slice(1, 3).map((sp: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-white/80">
                      <span className="truncate flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-white/50">#{idx + 2}</span>
                        {sp.name}
                      </span>
                      <span className="font-bold text-emerald-400">{fmtSales(Number(sp.net_achieved || 0))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Hot Leads & Follow-ups (Audio 8 [09:50]) */}
          <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground">Upcoming Hot Follow-ups</h3>
                <p className="text-[11px] text-muted-foreground">High-priority leads requiring immediate contact</p>
              </div>
              <Flame className="w-4 h-4 text-rose-500 shrink-0" />
            </div>

            {displayFollowUps.length === 0 ? (
              <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-8 text-center">
                No hot follow-ups pending today.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {displayFollowUps.map((follow: any, i: number) => {
                  const clientName = follow.company || follow.client || follow.contact || "Prospect";
                  const assignee = follow.owner || follow.assignee || "Sales Rep";
                  const dueDate = follow.nextFollowUpDate || follow.next_follow_up || follow.date || "Today";
                  const isHot = Boolean(follow.priority === "Hot" || follow.is_hot);

                  return (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-2xl bg-muted/40 border border-border/50 hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isHot ? "bg-rose-500 animate-pulse" : "bg-blue-500"}`}></div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground leading-tight truncate">{clientName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{assignee}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 shrink-0">
                        {dueDate}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

