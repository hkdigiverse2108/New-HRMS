import { MY_TASKS, KEY_ACCOUNTS } from "../dashboard-data";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";

export function TasksAndClients() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
      {/* SECTION 09: Tasks */}
      <div>
        <CollapsibleSection section="Section 09" title="Tasks & Deadlines">

        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm mb-6">
          <div className="mb-6">
            <h3 className="font-bold text-foreground">My Tasks & Team Tasks</h3>
            <p className="text-[11px] text-muted-foreground">Active tasks across projects</p>
          </div>
          <div className="space-y-3">
            {MY_TASKS.map((task, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/50 border border-border/50 hover:bg-muted transition-colors cursor-pointer">
                <div className="mt-0.5">
                  {task.status === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-border" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={cn("text-[13px] font-bold leading-tight mb-1", task.status === "completed" ? "text-muted-foreground line-through" : "text-foreground")}>
                    {task.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{task.assignee} · due {task.due}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 shadow-sm">
            <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1">Overdue</p>
            <p className="text-[26px] font-black text-rose-700 leading-none">14</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 shadow-sm">
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Completed Today</p>
            <p className="text-[26px] font-black text-emerald-700 leading-none">38</p>
          </div>
        </div>
        </CollapsibleSection>
      </div>

      {/* SECTION 10: Clients */}
      <div>
        <CollapsibleSection section="Section 10" title="Client Management">

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Clients</p>
            <p className="text-[26px] font-black text-foreground leading-none">78</p>
          </div>
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Active Clients</p>
            <p className="text-[26px] font-black text-primary leading-none">64</p>
          </div>
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">New This Month</p>
            <p className="text-[26px] font-black text-blue-500 leading-none">6</p>
          </div>
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Satisfaction</p>
            <p className="text-[26px] font-black text-amber-500 leading-none">4.6<span className="text-[14px] text-muted-foreground">/5</span></p>
          </div>
        </div>

        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="font-bold text-foreground">Key Accounts</h3>
            <p className="text-[11px] text-muted-foreground">Top revenue generating clients</p>
          </div>
          <div className="space-y-4">
            {KEY_ACCOUNTS.map((account, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-indigo-100 flex items-center justify-center text-[14px] font-bold text-primary">
                    {account.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-foreground leading-tight">{account.name}</p>
                    <p className="text-[11px] text-muted-foreground">Client since {account.since}</p>
                  </div>
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", 
                  account.health === "Good" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                  "bg-amber-50 text-amber-600 border-amber-100"
                )}>
                  {account.health}
                </span>
              </div>
            ))}
          </div>
        </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
