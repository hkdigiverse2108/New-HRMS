import { cn } from "@/lib/utils";
import { PROJECTS_GANTT } from "../dashboard-data";
import { CollapsibleSection } from "./CollapsibleSection";

export function ProjectDelivery() {
  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 06" title="Project Delivery">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Project KPIs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Projects</p>
            <p className="text-3xl font-black text-foreground">42</p>
          </div>
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Active</p>
            <p className="text-3xl font-black text-primary">24</p>
          </div>
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Completed</p>
            <p className="text-3xl font-black text-blue-500">12</p>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-2">Delayed</p>
            <p className="text-3xl font-black text-rose-600">4</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">Over Budget</p>
            <p className="text-3xl font-black text-amber-600">2</p>
          </div>
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Deadline Today</p>
            <p className="text-3xl font-black text-foreground">1</p>
          </div>
        </div>

        {/* Gantt Preview */}
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm md:col-span-2">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-foreground">Gantt preview of live delivery</h3>
              <p className="text-[11px] text-muted-foreground">Top active and at-risk projects</p>
            </div>
            <button className="text-[11px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg">View All</button>
          </div>
          
          <div className="space-y-5">
            {PROJECTS_GANTT.map((proj, i) => (
              <div key={i}>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-[13px] font-bold text-foreground">{proj.name}</p>
                    <p className="text-[11px] text-muted-foreground">{proj.client}</p>
                  </div>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", 
                    proj.status === 'Delayed' ? 'text-rose-600 bg-rose-50 border-rose-100' :
                    proj.status === 'Over Budget' ? 'text-amber-600 bg-amber-50 border-amber-100' : 
                    'text-primary bg-emerald-50 border-emerald-100'
                  )}>
                    {proj.status}
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-1000", 
                      proj.color === 'emerald' ? 'bg-primary' : 
                      proj.color === 'rose' ? 'bg-rose-500' : 'bg-amber-500'
                    )} 
                    style={{ width: `${proj.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
