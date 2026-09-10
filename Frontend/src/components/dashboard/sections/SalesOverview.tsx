import { Trophy } from "lucide-react";
import { SALES_METRICS, UPCOMING_FOLLOW_UPS } from "../dashboard-data";
import { CollapsibleSection } from "./CollapsibleSection";

export function SalesOverview() {
  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 07" title="Sales Overview">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Sales Metrics */}
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Today's Sales</p>
                <p className="text-[28px] font-black text-foreground leading-none">{SALES_METRICS.today}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                On Track
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Monthly Sales</p>
                <p className="text-xl font-black text-primary">{SALES_METRICS.monthly}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Sales Target</p>
                <p className="text-xl font-black text-foreground">{SALES_METRICS.target}</p>
              </div>
            </div>
            
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Lead Conversion</p>
              <p className="text-xl font-black text-blue-500">{SALES_METRICS.conversion}</p>
            </div>
          </div>
          
          <div className="mt-8">
            <div className="flex justify-between items-end mb-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Target Achievement</p>
              <p className="text-[11px] font-bold text-muted-foreground">6 working days remaining</p>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${SALES_METRICS.achievement}%` }}></div>
            </div>
          </div>
        </div>

        {/* Top Salesperson */}
        <div className="bg-card rounded-3xl p-6 text-white shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy className="h-32 w-32" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-border uppercase tracking-wider mb-6">Top Salesperson</h3>
            <p className="text-3xl font-black mb-1">Aarav Mehta</p>
            <p className="text-muted-foreground text-sm">₹12.8 L closed this month</p>
          </div>
        </div>

        {/* Upcoming Follow Ups */}
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="font-bold text-foreground">Upcoming Follow Ups</h3>
            <p className="text-[11px] text-muted-foreground">Scheduled client interactions</p>
          </div>
          <div className="space-y-3">
            {UPCOMING_FOLLOW_UPS.map((follow, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <div>
                    <p className="text-[13px] font-bold text-foreground leading-tight">{follow.client}</p>
                    <p className="text-[11px] text-muted-foreground">{follow.assignee}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                  {follow.date}
                </span>
              </div>
            ))}
          </div>
        </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
