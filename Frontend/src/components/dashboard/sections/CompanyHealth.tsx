import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { TOP_METRICS, PROFIT_TREND } from "../dashboard-data";
import { CollapsibleSection } from "./CollapsibleSection";

export function CompanyHealth() {
  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 02" title="Company Health">

      <div className="grid grid-cols-4 gap-6">
        {TOP_METRICS.map((metric, i) => {
          const isUp = metric.trend === 'up';
          
          return (
            <div key={i} className="bg-white border border-border/60 rounded-3xl p-5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] relative overflow-hidden flex flex-col h-[140px]">
              <div className="flex justify-between items-start z-10">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] leading-none">{metric.emoji}</span>
                  <p className="text-[11px] font-bold text-muted-foreground">{metric.label}</p>
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5", 
                  isUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>
                  {metric.change}
                </span>
              </div>
              <p className="text-[26px] font-black text-foreground leading-none mt-3 z-10">{metric.value}</p>
              
              <div className="text-[10px] text-muted-foreground mt-auto z-10">vs last month</div>
              
              {/* Background Sparkline */}
              <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none opacity-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={(metric as any).chartData || PROFIT_TREND}>
                    <defs>
                      <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={metric.chartColor || "#10b981"} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={metric.chartColor || "#10b981"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="profit" 
                      stroke={metric.chartColor || "#10b981"} 
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
