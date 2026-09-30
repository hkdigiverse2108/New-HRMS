import { CollapsibleSection } from "./CollapsibleSection";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";

export function DepartmentStatus() {
  // Section 05 LIVE (overview.departments) — koi mock nahi.
  const { data } = useDashboardOverview();
  const depts: any[] = data?.departments || [];

  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 05" title="Department Status">
        {depts.length === 0 ? (
          <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-8 text-center bg-white">No department data.</p>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {depts.map((dept: any, i: number) => {
          const total = Number(dept.total || 0);
          const present = Number(dept.present || 0);
          const open = Number(dept.tasks || 0);
          const done = Number(dept.completed || 0);
          const denom = done + open;
          const pct = denom > 0 ? Math.round((done / denom) * 100) : 0;
          return (
          <div key={i} className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm min-w-0">
            <div className="mb-6">
              <h3 className="text-lg font-black text-foreground mb-1">{dept.name}</h3>
              <p className="text-[11px] text-muted-foreground">{total} Employees</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Present Today</p>
                  <p className="text-xl font-black text-primary leading-none">{present}<span className="text-sm text-muted-foreground font-medium">/{total}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Tasks</p>
                  <p className="text-xl font-black text-primary leading-none">{done}<span className="text-sm text-muted-foreground font-medium">/{denom}</span></p>
                </div>
              </div>

              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
            </div>
          </div>
          );
        })}
        </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
