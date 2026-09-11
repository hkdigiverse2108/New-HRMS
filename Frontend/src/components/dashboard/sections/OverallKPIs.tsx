import { OVERALL_KPIS } from "../dashboard-data";
import { CloudSun, Clock, Target } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";

export function OverallKPIs() {
  return (
    <div className="mb-12">
      {/* SECTION 16: Overall KPIs */}
      <div className="mb-12">
        <CollapsibleSection section="Section 16" title="Overall KPIs">

      <div className="bg-white border border-border/60 rounded-3xl p-4 sm:p-6 shadow-sm mb-12">
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 sm:gap-x-6 gap-y-6 sm:gap-y-8">
          {OVERALL_KPIS.map((kpi, i) => (
            <div key={i} className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 truncate">{kpi.label}</p>
              <p className="text-xl font-black text-foreground leading-none">{kpi.value}</p>
              {kpi.value.includes('%') && (
                <div className="h-1 w-full bg-muted rounded-full mt-3 overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full" 
                    style={{ width: kpi.value }}
                  ></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
        </CollapsibleSection>
      </div>

      {/* SECTION 17: Bottom Widgets */}
      <div>
        <CollapsibleSection section="Section 17" title="Status & Targets">

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm flex items-center gap-4 min-w-0">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl shrink-0">
            <CloudSun className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-foreground truncate">31°C · Ahmedabad</p>
            <p className="text-[11px] text-muted-foreground truncate">Partly cloudy · humidity 68%</p>
          </div>
        </div>

        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm flex items-center gap-4 min-w-0">
          <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-foreground truncate">07:13:03</p>
            <p className="text-[11px] text-muted-foreground truncate">Until office closes at 7:00 PM</p>
          </div>
        </div>

        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm flex items-center gap-4 sm:col-span-2 min-w-0">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Target className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-end mb-2">
              <p className="text-[15px] font-bold text-foreground">Sales Target</p>
              <p className="text-[11px] font-bold text-emerald-600">82% achieved</p>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '82%' }}></div>
            </div>
          </div>
        </div>
        </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
