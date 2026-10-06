import { useMemo, useState } from "react";
import {
  CheckCircle2, Clock, AlertTriangle, Calendar, Phone, FileText,
  MessageCircle, Mail, Gift, Video, Users, Filter, Plus
} from "lucide-react";
import { toast } from "@/lib/toast";
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

function TaskRow({
  task,
  onToggleComplete
}: {
  task: SalesTask & { phone?: string; stage?: string; time?: string; leadId?: string };
  onToggleComplete: (task: SalesTask, completed: boolean) => void;
}) {
  const [done, setDone] = useState(task.status === "completed");
  const Icon = typeIcons[task.type] || Phone;

  const handleToggle = () => {
    const next = !done;
    setDone(next);
    onToggleComplete(task, next);
    if (next) {
      toast.success("Task completed!", { description: `${task.type} for ${task.company}` });
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all",
      done ? "border-emerald-200 bg-emerald-50/50 opacity-70" : "border-border bg-card hover:shadow-sm",
    )}>
      <button
        onClick={handleToggle}
        aria-label={done ? "Mark task as not done" : "Mark task as done"}
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:h-5 sm:w-5",
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
        <p className={cn("text-sm font-medium break-words", done && "line-through")} title={`${task.type} — ${task.company}`}>{task.type} — {task.company}</p>
        {task.phone && (
          <a href={`tel:${task.phone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 mt-0.5 font-mono font-black text-[15px] text-emerald-800 hover:text-emerald-600">
            <Phone className="w-3.5 h-3.5" />{task.phone}
          </a>
        )}
        <p className="text-[11px] text-muted-foreground">{task.assignee} · {task.stage || ""} · due {task.dueDate}{task.time ? ` at ${task.time}` : ""}</p>
      </div>

      <span className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0",
        task.priority === "High" ? "bg-rose-100 text-rose-700" : task.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700",
      )}>
        {task.priority}
      </span>
    </div>
  );
}

export function SalesTasks({ onAction }: { onAction?: (action: string) => void }) {
  const { leads, tasks: salesTasks, setTasks, salesSettings } = useSales();
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "upcoming" | "completed">("all");
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());

  // Notification toggles gate derived tasks: OFF hoy to te prakar na reminders na ave
  const isNotifOn = (keyword: string) => {
    const list = salesSettings?.notifications || [];
    const found = list.find((n: any) => String(n.title || "").toLowerCase().includes(keyword));
    return found ? !!found.active : true;
  };
  const newLeadNotifOn = isNotifOn("new lead assigned");
  const followUpNotifOn = isNotifOn("follow-up");

  // Fully dynamic: tasks derived ONLY from live leads (no static fallback)
  const allTasks = useMemo<(SalesTask & { phone?: string; stage?: string; time?: string; leadId?: string })[]>(() => {
    const todayStr = new Date().toISOString().split("T")[0] || "";
    const derived: (SalesTask & { phone?: string; stage?: string; time?: string; leadId?: string })[] = [];

    leads.forEach((l: any) => {
      // "New Lead Assigned" OFF -> new-lead review tasks skip
      // "Follow-up Reminder" OFF -> follow-up due tasks skip
      const lid = l.id || l._id || "";
      const rawNext = l.nextFollowUpDate || l.nextFollowUp || l.next_follow_up_date || "";
      const nextDate = String(rawNext).split("T")[0] || "";
      const nextTime = String(l.nextFollowUpTime || l.next_follow_up_time || (String(rawNext).includes("T") ? String(rawNext).split("T")[1]?.slice(0, 5) : "") || "");
      const createdDate = String(l.date || (l.createdAt ? String(l.createdAt).split("T")[0] : "") || "");
      const isWonOrLost = ["Client Won", "Won", "Client Lost", "Lost"].includes(l.status || l.stage || "");
      // New leads created today with no follow-up => today's task (Audio 7: new lead must be reviewed same evening)
      const isNewTodayNoFollowUp = !nextDate && createdDate === todayStr && !isWonOrLost;
      if (isNewTodayNoFollowUp && !newLeadNotifOn) return;
      if (!isNewTodayNoFollowUp && nextDate && !followUpNotifOn) return;
      const followUpDate = nextDate || (isNewTodayNoFollowUp ? todayStr : "");
      if (!followUpDate) return;

      const isMarkedDone = completedTaskIds.has(`lead-task-${lid}`);
      let status: SalesTask["status"] = "upcoming";
      if (isWonOrLost || isMarkedDone) {
        status = "completed";
      } else if (followUpDate < todayStr) {
        status = "overdue";
      } else if (followUpDate === todayStr) {
        status = "today";
      } else {
        status = "upcoming";
      }

      let taskType = isNewTodayNoFollowUp ? "Call Client (New Lead)" : "Call Client";
      const stageLower = (l.stage || l.status || "").toLowerCase();
      if (stageLower.includes("demo")) taskType = "Demo";
      else if (stageLower.includes("meet")) taskType = "Meeting";
      else if (stageLower.includes("proposal")) taskType = "Proposal";
      else if (stageLower.includes("won") || stageLower.includes("closure")) taskType = "Payment Collection";

      const assignee = Array.isArray(l.assignedTo)
        ? (l.assignedTo[0] || l.owner || "Sales Team")
        : (l.assignedTo || l.owner || "Sales Team");

      derived.push({
        id: `lead-task-${lid}`,
        leadId: lid,
        type: taskType,
        company: l.company || l.contact || "Lead",
        phone: l.phone || "",
        stage: l.stage || l.status || "",
        assignee: String(assignee),
        dueDate: followUpDate,
        time: nextTime,
        status,
        priority: l.priority || "Medium",
      });
    });

    const customTasks = salesTasks.map((t) => {
      if (completedTaskIds.has(t.id)) {
        return { ...t, status: "completed" as const };
      }
      return t;
    });

    return [...customTasks, ...derived];
  }, [leads, salesTasks, completedTaskIds, newLeadNotifOn, followUpNotifOn]);

  const handleToggleComplete = (task: SalesTask, completed: boolean) => {
    setCompletedTaskIds((prev) => {
      const next = new Set(prev);
      if (completed) next.add(task.id);
      else next.delete(task.id);
      return next;
    });
    if (salesTasks.some((t) => t.id === task.id)) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: completed ? "completed" : "today" } : t))
      );
    }
  };

  const counts = useMemo(() => {
    const c = { overdue: 0, today: 0, upcoming: 0, completed: 0 };
    for (const t of allTasks) {
      if (c[t.status] !== undefined) {
        c[t.status]++;
      }
    }
    return c;
  }, [allTasks]);

  const grouped = useMemo(() => {
    const order: SalesTask["status"][] = ["overdue", "today", "upcoming", "completed"];
    if (filter !== "all") {
      return [{ status: filter, tasks: allTasks.filter((t) => t.status === filter) }];
    }
    return order
      .map((s) => ({ status: s, tasks: allTasks.filter((t) => t.status === s) }))
      .filter((g) => g.tasks.length > 0);
  }, [filter, allTasks]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Sales Tasks & Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Auto-created from pipeline activity — nothing slips through</p>
        </div>
        <button
          onClick={() => onAction?.("Create Task")}
          className="flex items-center justify-center gap-1.5 w-full sm:w-auto min-h-[44px] sm:min-h-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 shadow-sm"
        >
          <Plus className="h-4 w-4" /> Create Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: "Due Today", value: counts.today, color: "amber", icon: Clock },
          { label: "Overdue", value: counts.overdue, color: "rose", icon: AlertTriangle },
          { label: "Upcoming (7d)", value: counts.upcoming, color: "blue", icon: Calendar },
          { label: "Completed", value: counts.completed, color: "emerald", icon: CheckCircle2 },
        ] as const).map((stat) => (
          <div key={stat.label} className={cn(
            "flex items-center gap-3 rounded-2xl border p-4 shadow-sm",
            stat.color === "amber" && "border-amber-200 bg-amber-50/70",
            stat.color === "rose" && "border-rose-200 bg-rose-50/70",
            stat.color === "blue" && "border-blue-200 bg-blue-50/70",
            stat.color === "emerald" && "border-emerald-200 bg-emerald-50/70",
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
              "rounded-full px-3.5 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-semibold capitalize transition-colors",
              filter === f ? "bg-emerald-600 text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f === "all" ? "All Tasks" : f}
          </button>
        ))}
      </div>

      {/* Task Groups */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
          <p className="font-semibold">No tasks found for this view</p>
          <p className="text-xs">Follow-ups scheduled on leads will automatically appear here.</p>
        </div>
      ) : (
        grouped.map((group) => {
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
                  <TaskRow key={task.id} task={task} onToggleComplete={handleToggleComplete} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
