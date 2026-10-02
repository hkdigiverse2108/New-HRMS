import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, ExternalLink, ArrowRight } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";

export function TasksAndClients({ setActive }: { setActive?: ((url: string) => void) | undefined }) {
  // Sections 09-10 LIVE (overview.tasks_clients + today) — koi mock nahi.
  const { data } = useDashboardOverview();
  const tc = data?.tasks_clients || {};
  const health = data?.health || {};
  const myTasks: any[] = tc.my_tasks?.length
    ? tc.my_tasks
    : ((data?.today?.today || []).slice(0, 6).map((t: any) => ({
        title: t.title || "Task",
        status: String(t.status || "todo"),
        assignee: t.task_category || "General",
        due: String(t.due_date || "").slice(0, 10) || "—",
      })));
  const accounts: any[] = tc.key_accounts || [];
  const satisfaction = Number(tc.satisfaction || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
      {/* SECTION 09: Tasks */}
      <div>
        <CollapsibleSection section="Section 09" title="Tasks & Deadlines">

        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm mb-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">My Tasks & Team Tasks</h3>
              <p className="text-[11px] text-muted-foreground">Today's live tasks</p>
            </div>
            {setActive && (
              <button
                type="button"
                onClick={() => setActive("/tasks")}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          {myTasks.length === 0 ? (
            <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-6 text-center">No tasks for today. 🎉</p>
          ) : (
          <div className="space-y-3">
            {myTasks.map((task: any, i: number) => {
              const done = ["completed", "done"].includes(String(task.status || "").toLowerCase());
              return (
              <div 
                key={i} 
                onClick={() => setActive?.("/tasks")}
                className="flex items-start gap-3 p-3 rounded-2xl bg-muted/50 border border-border/50 hover:bg-muted hover:border-primary/40 transition-colors cursor-pointer"
              >
                <div className="mt-0.5">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-border" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[13px] font-bold leading-tight mb-1", done ? "text-muted-foreground line-through" : "text-foreground")}>
                    {task.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{task.assignee} · due {task.due}</p>
                </div>
              </div>
              );
            })}
          </div>
          )}
        </div>

        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4">
          <div 
            onClick={() => setActive?.("/tasks")}
            className="bg-rose-50 border border-rose-100 rounded-3xl p-5 shadow-sm min-w-0 cursor-pointer hover:border-rose-300 transition-colors"
          >
            <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1">Overdue</p>
            <p className="text-[26px] font-black text-rose-700 leading-none">{tc.overdue ?? 0}</p>
          </div>
          <div 
            onClick={() => setActive?.("/tasks")}
            className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 shadow-sm min-w-0 cursor-pointer hover:border-emerald-300 transition-colors"
          >
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Completed Today</p>
            <p className="text-[26px] font-black text-emerald-700 leading-none">{tc.completed_today ?? 0}</p>
          </div>
        </div>
        </CollapsibleSection>
      </div>

      {/* SECTION 10: Clients */}
      <div>
        <CollapsibleSection section="Section 10" title="Client Management">

        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4 mb-6">
          <div 
            onClick={() => setActive?.("/work/projects")}
            className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm min-w-0 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">Total Clients</p>
              <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[26px] font-black text-foreground leading-none">{health.total_clients ?? 0}</p>
          </div>
          <div 
            onClick={() => setActive?.("/work/projects")}
            className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm min-w-0 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">Active Clients</p>
              <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[26px] font-black text-primary leading-none">{health.active_clients ?? 0}</p>
          </div>
          <div 
            onClick={() => setActive?.("/work/projects")}
            className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm min-w-0 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-blue-500 transition-colors">New This Month</p>
              <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[26px] font-black text-blue-500 leading-none">{tc.new_this_month ?? 0}</p>
          </div>
          <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Satisfaction</p>
            <p className="text-[26px] font-black text-amber-500 leading-none">
              {satisfaction > 0 ? satisfaction.toFixed(1) : "—"}
              {satisfaction > 0 && <span className="text-[14px] text-muted-foreground">/5</span>}
            </p>
          </div>
        </div>

        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">Key Accounts</h3>
              <p className="text-[11px] text-muted-foreground">Top budget clients — live</p>
            </div>
            {setActive && (
              <button
                type="button"
                onClick={() => setActive("/work/projects")}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          {accounts.length === 0 ? (
            <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-6 text-center">No client data.</p>
          ) : (
          <div className="space-y-4">
            {accounts.map((account: any, i: number) => (
              <div 
                key={i} 
                onClick={() => setActive?.("/work/projects")}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-muted/50 border border-transparent hover:border-border/60 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-indigo-100 flex items-center justify-center text-[14px] font-bold text-primary shrink-0 group-hover:scale-105 transition-transform">
                    {String(account.name || "C").charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-foreground leading-tight truncate group-hover:text-primary transition-colors">{account.name}</p>
                    <p className="text-[11px] text-muted-foreground">Client since {account.since} · {account.value}</p>
                  </div>
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0",
                  account.health === "Good" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                  "bg-amber-50 text-amber-600 border-amber-100"
                )}>
                  {account.health}
                </span>
              </div>
            ))}
          </div>
          )}
        </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
