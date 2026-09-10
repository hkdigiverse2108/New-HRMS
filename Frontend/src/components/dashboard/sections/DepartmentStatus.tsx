import { DEPARTMENTS } from "../dashboard-data";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "./CollapsibleSection";

export function DepartmentStatus() {
  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 05" title="Department Status">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DEPARTMENTS.map((dept, i) => (
          <div key={i} className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-black text-foreground mb-1">{dept.name}</h3>
              <p className="text-[11px] text-muted-foreground">{dept.total} Employees</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Present Today</p>
                  <p className="text-xl font-black text-primary leading-none">{dept.present}<span className="text-sm text-muted-foreground font-medium">/{dept.total}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Tasks</p>
                  <p className="text-xl font-black text-primary leading-none">{dept.completed}<span className="text-sm text-muted-foreground font-medium">/{dept.completed + dept.tasks}</span></p>
                </div>
              </div>
              
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full" 
                  style={{ width: `${(dept.completed / (dept.completed + dept.tasks)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}
