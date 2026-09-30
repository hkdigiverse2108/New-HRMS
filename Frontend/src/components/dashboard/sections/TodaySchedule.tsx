import { useState, useEffect, useCallback } from "react";
import { CalendarDays, CheckCircle2, Circle, ListTodo, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { CollapsibleSection } from "./CollapsibleSection";

interface TodayTask {
  id: string;
  title: string;
  status: string;
  due_date?: string;
  task_category?: string;
}

// K19: dashboard par j aajno schedule + today's tasks (andar javani wait nai).
export function TodaySchedule({ setActive }: { setActive?: ((url: string) => void) | undefined }) {
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [meeting, setMeeting] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchToday = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<any>("/tasks/daily-overview", { showLoader: false, showErrorToast: false });
      const today = Array.isArray(res?.today) ? res.today : [];
      const upcoming = Array.isArray(res?.upcoming) ? res.upcoming : [];
      setTasks(today.map((t: any) => ({
        id: String(t._id || t.id),
        title: t.title || "Untitled Task",
        status: String(t.status || "todo"),
        due_date: t.due_date ? String(t.due_date).split("T")[0] : "",
        task_category: t.task_category || "General",
      })));
      setUpcomingCount(upcoming.length);
    } catch {
      setTasks([]);
      setUpcomingCount(0);
    } finally {
      setIsLoading(false);
    }
    try {
      const plan = await api.get<any>("/tasks/daily-planner", { showLoader: false, showErrorToast: false });
      setMeeting(plan?.meeting || plan?.activity || "");
    } catch {
      setMeeting("");
    }
  }, []);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const toggleTask = async (task: TodayTask) => {
    const done = task.status.toLowerCase() === "completed" || task.status.toLowerCase() === "done";
    const next = done ? "todo" : "completed";
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await api.put(`/tasks/${task.id}`, { status: next }, { showLoader: false, showErrorToast: false });
    } catch {
      fetchToday();
    }
  };

  const doneCount = tasks.filter(t => ["completed", "done"].includes(t.status.toLowerCase())).length;

  return (
    <div className="mb-12">
      <CollapsibleSection section="Today" title="Today's Schedule">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Schedule / meetings */}
          <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Today's Schedule</h3>
                <p className="text-[11px] text-muted-foreground">Meetings & plan</p>
              </div>
            </div>
            {meeting ? (
              <p className="text-[13px] font-semibold text-foreground bg-muted/50 border border-border/50 rounded-2xl px-4 py-3">{meeting}</p>
            ) : (
              <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-3 text-center">No schedule for today.</p>
            )}
            <div className="flex gap-3 mt-4">
              <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Completed</p>
                <p className="text-2xl font-black text-emerald-700">{doneCount}/{tasks.length}</p>
              </div>
              <div className="flex-1 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Upcoming</p>
                <p className="text-2xl font-black text-blue-700">{upcomingCount}</p>
              </div>
            </div>
          </div>

          {/* Today's tasks */}
          <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <ListTodo className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Today's Tasks</h3>
                  <p className="text-[11px] text-muted-foreground">View without opening • click = complete</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActive?.("/tasks")}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                Open Tasks <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {isLoading ? (
              <p className="text-xs text-muted-foreground font-semibold text-center py-6">Loading...</p>
            ) : tasks.length === 0 ? (
              <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-3 text-center">No tasks for today. 🎉</p>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {tasks.map(task => {
                  const done = ["completed", "done"].includes(task.status.toLowerCase());
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task)}
                      className="w-full flex items-start gap-3 p-3 rounded-2xl bg-muted/50 border border-border/50 hover:bg-muted transition-colors text-left"
                    >
                      <span className="mt-0.5">
                        {done ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : (
                          <Circle className="h-5 w-5 text-border" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={cn("block text-[13px] font-bold leading-tight mb-0.5", done ? "text-muted-foreground line-through" : "text-foreground")}>
                          {task.title}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {task.task_category}{task.due_date ? ` · due ${task.due_date}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
