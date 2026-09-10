import { useMemo, useState } from "react";
import {
  CheckCircle2, Clock, AlertTriangle, Calendar, Phone, FileText,
  MessageCircle, Mail, Gift, Video, Users, Filter, Plus
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type SalesTask } from "./sales-data";
import { useSales } from "./SalesContext";

const typeIcons: Record<string, typeof Phone> = {
  "Call Client": Phone,
  "Payment Collection": FileText,
  "Recurring Follow-up": Clock,
  Proposal: FileText,
  "Birthday Wish": Gift,
  Meeting: Users,
  Demo: Video,
  WhatsApp: MessageCircle,
  Email: Mail,
};

const statusConfig = {
  overdue: { label: "Overdue", color: "text-rose-600", bg: "bg-rose-50 border-rose-200", icon: AlertTriangle, iconColor: "text-rose-500" },
  today: { label: "Due Today", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: Clock, iconColor: "text-amber-500" },
  upcoming: { label: "Upcoming", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: Calendar, iconColor: "text-blue-500" },
  completed: { label: "Completed", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2, iconColor: "text-emerald-500" },
};

function TaskRow({ task }: { task: SalesTask }) {
  const [done, setDone] = useState(task.status === "completed");
  const Icon = typeIcons[task.type] || Phone;

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all",
      done ? "border-emerald-200 bg-emerald-50/50 opacity-70" : "border-border bg-card hover:shadow-sm",
    )}>
      <button
        onClick={() => {
          setDone(!done);
          if (!done) toast.success("Task completed!", { description: task.type + " for " + task.company });
        }}
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors",
          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30 hover:border-emerald-400",
        )}
      >
        {done && <CheckCircle2 className="h-3.5 w-3.5" />}
      </button>

      <div className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
        task.priority === "High" ? "bg-rose-100 text-rose-600" : task.priority === "Medium" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600",
      )}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", done && "line-through")}>{task.type} — {task.company}</p>
        <p className="text-[11px] text-muted-foreground">{task.assignee} · due {task.dueDate}</p>
      </div>

      <span className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        task.priority === "High" ? "bg-rose-100 text-rose-700" : task.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700",
      )}>
        {task.priority}
      </span>
    </div>
  );
}

export function SalesTasks({ onAction }: { onAction?: (action: string) => void }) {
  const { tasks: salesTasks } = useSales();
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "upcoming" | "completed">("all");

  const counts = useMemo(() => {
    const c = { overdue: 0, today: 0, upcoming: 0, completed: 0 };
    for (const t of salesTasks) c[t.status]++;
    return c;
  }, []);

  const grouped = useMemo(() => {
    const order: SalesTask["status"][] = ["overdue", "today", "upcoming", "completed"];
    if (filter !== "all") return [{ status: filter, tasks: salesTasks.filter((t) => t.status === filter) }];
    return order.map((s) => ({ status: s, tasks: salesTasks.filter((t) => t.status === s) })).filter((g) => g.tasks.length > 0);
  }, [filter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Sales Tasks & Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Auto-created from pipeline activity — nothing slips through</p>
        </div>
        <button onClick={() => onAction?.("Create Task")} className="flex items-center gap-1.5 self-start rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
          <Plus className="h-4 w-4" /> Create Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { label: "Due Today", value: counts.today, color: "amber", icon: Clock },
          { label: "Overdue", value: counts.overdue, color: "rose", icon: AlertTriangle },
          { label: "Upcoming (7d)", value: counts.upcoming, color: "blue", icon: Calendar },
          { label: "Completed This Week", value: counts.completed + 126, color: "emerald", icon: CheckCircle2 },
        ] as const).map((stat) => (
          <div key={stat.label} className={cn(
            "flex items-center gap-3 rounded-2xl border p-4",
            stat.color === "amber" && "border-amber-200 bg-amber-50",
            stat.color === "rose" && "border-rose-200 bg-rose-50",
            stat.color === "blue" && "border-blue-200 bg-blue-50",
            stat.color === "emerald" && "border-emerald-200 bg-emerald-50",
          )}>
            <div className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
              stat.color === "amber" && "bg-amber-100 text-amber-600",
              stat.color === "rose" && "bg-rose-100 text-rose-600",
              stat.color === "blue" && "bg-blue-100 text-blue-600",
              stat.color === "emerald" && "bg-emerald-100 text-emerald-600",
            )}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black">{stat.value}</p>
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", "overdue", "today", "upcoming", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors",
              filter === f ? "bg-emerald-600 text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f === "all" ? "All Tasks" : f}
          </button>
        ))}
      </div>

      {/* Task Groups */}
      {grouped.map((group) => {
        const cfg = statusConfig[group.status];
        return (
          <div key={group.status}>
            <div className="mb-3 flex items-center gap-2">
              <cfg.icon className={cn("h-4 w-4", cfg.iconColor)} />
              <h2 className={cn("text-sm font-bold", cfg.color)}>{cfg.label}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{group.tasks.length}</span>
            </div>
            <div className="space-y-2">
              {group.tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
