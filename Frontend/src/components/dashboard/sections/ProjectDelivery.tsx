import { cn } from "@/lib/utils";
import { CollapsibleSection } from "./CollapsibleSection";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";

export function ProjectDelivery() {
  // Roadmap ma 5 projects LIVE (Audio PDF) — backend $sample active projects.
  const { data } = useDashboardOverview();
  const proj = data?.projects || { total: 0, active: 0, completed: 0, onhold: 0, roadmap: [] };
  const roadmap: any[] = proj.roadmap || [];

  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 06" title="Project Delivery">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Project KPIs — live counts */}
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Projects</p>
            <p className="text-3xl font-black text-foreground">{proj.total ?? 0}</p>
          </div>
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Active</p>
            <p className="text-3xl font-black text-primary">{proj.active ?? 0}</p>
          </div>
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Completed</p>
            <p className="text-3xl font-black text-blue-500">{proj.completed ?? 0}</p>
          </div>
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">On Hold</p>
            <p className="text-3xl font-black text-amber-600">{proj.onhold ?? 0}</p>
          </div>
        </div>

        {/* Roadmap — live 5 projects */}
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm md:col-span-2 min-w-0">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-foreground">Live Roadmap</h3>
              <p className="text-[11px] text-muted-foreground">Top active projects — live progress</p>
            </div>
            <button className="text-[11px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg">View All</button>
          </div>

          {roadmap.length === 0 ? (
            <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-6 text-center">No active projects.</p>
          ) : (
          <div className="space-y-5">
            {roadmap.map((r: any) => (
              <div key={r.id}>
                <div className="flex justify-between items-end mb-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-foreground truncate">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">{r.progress || 0}% complete</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border text-primary bg-emerald-50 border-emerald-100 shrink-0">
                    {r.status}
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 bg-primary"
                    style={{ width: `${Math.min(100, Number(r.progress) || 0)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
