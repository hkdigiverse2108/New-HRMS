import { OVERALL_KPIS } from "../dashboard-data";
import { CloudSun, Clock, Target } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";

export function OverallKPIs() {
  return (
    <div className="mb-12">
      {/* SECTION 16: Overall KPIs */}
      <div className="mb-12">
        <CollapsibleSection section="Section 16" title="Overall KPIs">

      <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-8">
          {OVERALL_KPIS.map((kpi, i) => (
            <div key={i}>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{kpi.label}</p>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl">
            <CloudSun className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-foreground">31°C · Ahmedabad</p>
            <p className="text-[11px] text-muted-foreground">Partly cloudy · humidity 68%</p>
          </div>
        </div>

        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-foreground">07:13:03</p>
            <p className="text-[11px] text-muted-foreground">Until office closes at 7:00 PM</p>
          </div>
        </div>

        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm flex items-center gap-4 md:col-span-2">
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
