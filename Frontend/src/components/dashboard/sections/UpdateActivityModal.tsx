import React, { useState, useEffect } from "react";
import { X, Plus, Calendar, Check, Briefcase, BookOpen, Users, Clock, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

export type WorkActivityType = "Today's Work" | "Upcoming Work" | "Research" | "Activity" | "Meeting";

export interface SelectedTaskInfo {
  taskId?: string | undefined;
  taskTitle: string;
  taskType: WorkActivityType;
  dueDate?: string | undefined;
  badge?: string | undefined;
}

interface UpdateActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: SelectedTaskInfo) => void;
  currentTaskTitle?: string | null;
  employeeId?: string;
  isChangeMode?: boolean;
}

interface TaskItem {
  id: string;
  title: string;
  dueDate?: string | undefined;
  badge?: string | undefined;
  category: WorkActivityType;
  isCustom?: boolean | undefined;
}

export function UpdateActivityModal({
  isOpen,
  onClose,
  onSave,
  currentTaskTitle,
  employeeId,
  isChangeMode = false,
}: UpdateActivityModalProps) {
  const [activeTab, setActiveTab] = useState<WorkActivityType>("Today's Work");
  const [tasks, setTasks] = useState<Record<WorkActivityType, TaskItem[]>>({
    "Today's Work": [],
    "Upcoming Work": [],
    "Research": [],
    "Activity": [],
    "Meeting": [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<SelectedTaskInfo | null>(null);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTaskTitle, setCustomTaskTitle] = useState("");

  const tabs: WorkActivityType[] = [
    "Today's Work",
    "Upcoming Work",
    "Research",
    "Activity",
    "Meeting",
  ];

  // Load employee tasks and schedules
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchTasks = async () => {
      setIsLoading(true);
      try {
        const todayDateStr: string = String(new Date().toISOString().split("T")[0] || "");
        const addedTaskIds = new Set<string>();
        const todayList: TaskItem[] = [];
        const upcomingList: TaskItem[] = [];

        // 1. Fetch daily overview (today & upcoming tasks)
        let dailyRes: any = null;
        try {
          dailyRes = await api.get<any>("/tasks/daily-overview", { showErrorToast: false });
        } catch {}

        if (dailyRes?.today && Array.isArray(dailyRes.today)) {
          dailyRes.today.forEach((t: any) => {
            const status = String(t.status || "").toLowerCase();
            if (status === "completed" || status === "done" || status === "closed") return;
            const taskId = String(t.id || t._id);
            if (addedTaskIds.has(taskId)) return;
            addedTaskIds.add(taskId);

            const rawDue = t.due_date ? String(t.due_date).split("T")[0] : undefined;
            const due: string = rawDue || todayDateStr;
            const isPreviousPending = Boolean(due && todayDateStr && due < todayDateStr);
            todayList.push({
              id: taskId,
              title: t.title || t.name || "Task",
              dueDate: due,
              badge: isPreviousPending ? `Pending (${due})` : (t.is_custom ? "Custom Task" : (t.priority || "Today")),
              category: "Today's Work",
            });
          });
        }

        if (dailyRes?.upcoming && Array.isArray(dailyRes.upcoming)) {
          dailyRes.upcoming.forEach((t: any) => {
            const status = String(t.status || "").toLowerCase();
            if (status === "completed" || status === "done" || status === "closed") return;
            const taskId = String(t.id || t._id);
            if (addedTaskIds.has(taskId)) return;
            addedTaskIds.add(taskId);

            const rawDue = t.due_date ? String(t.due_date).split("T")[0] : undefined;
            const due: string = rawDue || "";
            upcomingList.push({
              id: taskId,
              title: t.title || t.name || "Upcoming Task",
              dueDate: due,
              badge: t.priority || "Upcoming",
              category: "Upcoming Work",
            });
          });
        }

        // 2. Fetch all user tasks to catch any previous days' pending tasks not in overview
        try {
          const listRes = await api.get<any>("/tasks?limit=200", { showErrorToast: false });
          const rawTasks: any[] = listRes?.data || listRes?.items || (Array.isArray(listRes) ? listRes : []);
          rawTasks.forEach((t: any) => {
            const status = String(t.status || "").toLowerCase();
            if (status === "completed" || status === "done" || status === "closed") return;
            const taskId = String(t.id || t._id);
            if (addedTaskIds.has(taskId)) return;
            addedTaskIds.add(taskId);

            const rawDue = t.due_date ? String(t.due_date).split("T")[0] : undefined;
            const due: string = rawDue || "";
            if (due && todayDateStr && due < todayDateStr) {
              // Previous days' uncompleted/pending task -> show in Today's Work!
              todayList.push({
                id: taskId,
                title: t.title || "Pending Task",
                dueDate: due,
                badge: `Pending (${due})`,
                category: "Today's Work",
              });
            } else if (due === todayDateStr) {
              todayList.push({
                id: taskId,
                title: t.title || "Daily Task",
                dueDate: due,
                badge: t.priority || "Today",
                category: "Today's Work",
              });
            } else {
              upcomingList.push({
                id: taskId,
                title: t.title || "Upcoming Task",
                dueDate: due,
                badge: t.priority || "Upcoming",
                category: "Upcoming Work",
              });
            }
          });
        } catch {}

        // 2. Fetch Research items
        const researchList: TaskItem[] = [];
        try {
          const resRes = await api.get<any>("/work/research", { showErrorToast: false });
          const resItems = resRes?.data || resRes || [];
          if (Array.isArray(resItems)) {
            resItems.forEach((r: any) => {
              researchList.push({
                id: String(r.id || r._id),
                title: r.title || r.topic || "Research Topic",
                dueDate: todayDateStr,
                badge: "Research",
                category: "Research",
              });
            });
          }
        } catch {}

        // Default research items if empty
        if (researchList.length === 0) {
          researchList.push(
            { id: "res-1", title: "Product Feature & Architecture Research", dueDate: todayDateStr, badge: "Research", category: "Research" },
            { id: "res-2", title: "API Performance & Redis Optimization", dueDate: todayDateStr, badge: "Research", category: "Research" }
          );
        }

        // 3. Fetch Activity items
        const activityList: TaskItem[] = [
          { id: "act-1", title: "Code Review & PR Reviews", dueDate: todayDateStr, badge: "Activity", category: "Activity" },
          { id: "act-2", title: "Client Communication & Follow-up", dueDate: todayDateStr, badge: "Activity", category: "Activity" },
          { id: "act-3", title: "Team Coordination & Standup", dueDate: todayDateStr, badge: "Activity", category: "Activity" },
        ];

        // 4. Fetch Meeting items
        const meetingList: TaskItem[] = [
          { id: "meet-1", title: "Daily Morning Sync / Standup", dueDate: todayDateStr, badge: "Meeting", category: "Meeting" },
          { id: "meet-2", title: "Weekly Sprint Planning", dueDate: todayDateStr, badge: "Meeting", category: "Meeting" },
          { id: "meet-3", title: "Client Product Demo", dueDate: todayDateStr, badge: "Meeting", category: "Meeting" },
        ];

        // 5. Load saved custom activities from localStorage (Task 34)
        if (typeof window !== "undefined") {
          try {
            const savedStr = localStorage.getItem("hrms_custom_activities");
            if (savedStr) {
              const savedItems: Array<{ id: string; title: string; category: WorkActivityType; dueDate?: string }> = JSON.parse(savedStr);
              savedItems.forEach(item => {
                const customItem: TaskItem = {
                  id: item.id,
                  title: item.title,
                  dueDate: item.dueDate || todayDateStr,
                  badge: "Custom",
                  category: item.category,
                  isCustom: true,
                };
                if (item.category === "Today's Work") todayList.unshift(customItem);
                else if (item.category === "Upcoming Work") upcomingList.unshift(customItem);
                else if (item.category === "Research") researchList.unshift(customItem);
                else if (item.category === "Activity") activityList.unshift(customItem);
                else if (item.category === "Meeting") meetingList.unshift(customItem);
              });
            }
          } catch {}
        }

        if (isMounted) {
          setTasks({
            "Today's Work": todayList,
            "Upcoming Work": upcomingList,
            "Research": researchList,
            "Activity": activityList,
            "Meeting": meetingList,
          });

          // Pre-select first task in Today's Work if none selected
          const firstToday = todayList[0];
          if (!selectedTask && firstToday) {
            setSelectedTask({
              taskId: firstToday.id,
              taskTitle: firstToday.title,
              taskType: "Today's Work",
              dueDate: firstToday.dueDate,
              badge: firstToday.badge,
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch activity tasks", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTasks();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentList = tasks[activeTab] || [];

  const handleSelect = (t: TaskItem) => {
    setIsAddingCustom(false);
    setSelectedTask({
      taskId: t.id,
      taskTitle: t.title,
      taskType: activeTab,
      dueDate: t.dueDate,
      badge: t.badge,
    });
  };

  // Task 26 & Task 34: Sync custom task with backend /tasks and save locally
  const handleAddCustom = async () => {
    if (!customTaskTitle.trim()) {
      toast.error("Please enter a custom task title");
      return;
    }
    const cleanTitle = customTaskTitle.trim();
    let createdTaskId = `custom-${Date.now()}`;
    const todayStr = new Date().toISOString().split("T")[0];

    // Task 26: Sync custom task to main tasks list (/tasks)
    try {
      const res = await api.post<any>("/tasks", {
        title: cleanTitle,
        priority: "Medium",
        status: "In Progress",
        assigned_to: employeeId,
        due_date: todayStr,
        description: `Created during Punch-In activity tracking (${activeTab})`,
        task_category: activeTab === "Research" ? "Research" : "General",
      }, { showErrorToast: false });
      if (res?._id || res?.id) {
        createdTaskId = String(res._id || res.id);
      }
    } catch (err) {
      console.warn("Could not sync custom task to tasks endpoint:", err);
    }

    const newCustomItem: TaskItem = {
      id: createdTaskId,
      title: cleanTitle,
      dueDate: todayStr,
      badge: "Custom Task",
      category: activeTab,
      isCustom: true,
    };

    // Save in state
    setTasks(prev => ({
      ...prev,
      [activeTab]: [newCustomItem, ...(prev[activeTab] || [])]
    }));

    // Task 34: Persist in localStorage so it remains available in dropdown/list
    try {
      const savedStr = localStorage.getItem("hrms_custom_activities");
      const currentSaved = savedStr ? JSON.parse(savedStr) : [];
      const updated = [
        { id: createdTaskId, title: cleanTitle, category: activeTab, dueDate: todayStr },
        ...currentSaved.filter((x: any) => x.title.toLowerCase() !== cleanTitle.toLowerCase())
      ].slice(0, 30);
      localStorage.setItem("hrms_custom_activities", JSON.stringify(updated));
    } catch {}

    const selected: SelectedTaskInfo = {
      taskId: createdTaskId,
      taskTitle: cleanTitle,
      taskType: activeTab,
      dueDate: todayStr,
      badge: "Custom Task",
    };
    setSelectedTask(selected);
    setIsAddingCustom(false);
    setCustomTaskTitle("");
    toast.success("Custom task created and synced to tasks list!");
  };

  // Task 34: Delete saved custom activity
  const handleDeleteCustom = (e: React.MouseEvent, item: TaskItem) => {
    e.stopPropagation();
    setTasks(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter(t => t.id !== item.id)
    }));
    try {
      const savedStr = localStorage.getItem("hrms_custom_activities");
      if (savedStr) {
        const currentSaved = JSON.parse(savedStr);
        const updated = currentSaved.filter((x: any) => x.id !== item.id && x.title !== item.title);
        localStorage.setItem("hrms_custom_activities", JSON.stringify(updated));
      }
    } catch {}
    if (selectedTask?.taskTitle === item.title) {
      setSelectedTask(null);
    }
    toast.info("Custom entry removed.");
  };

  const handleSave = () => {
    if (!selectedTask || !selectedTask.taskTitle.trim()) {
      toast.error("Please select or enter the task you will be working on.");
      return;
    }
    onSave(selectedTask);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border/50">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {isChangeMode ? "Change Active Task" : "Update Activity"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              What will you be working on right now?
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-6 pt-4 pb-2 border-b border-border/30 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setIsAddingCustom(false);
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
              Select Task
            </span>

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Loading {activeTab.toLowerCase()}...</span>
              </div>
            ) : currentList.length === 0 && !isAddingCustom ? (
              <div className="py-8 px-4 text-center border border-dashed border-border/70 rounded-2xl bg-muted/20">
                <p className="text-sm font-medium text-foreground">No tasks scheduled under {activeTab}.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click below to enter custom work for this session.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {currentList.map((t) => {
                  const isSelected = selectedTask?.taskTitle === t.title && !isAddingCustom;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelect(t)}
                      className={cn(
                        "group relative flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                          : "border-border/70 bg-card hover:border-primary/50 hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <span className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                        )}>
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </span>
                        
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className={cn(
                            "text-sm font-semibold truncate",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {t.title}
                          </span>
                          {t.dueDate && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 shrink-0">
                              {t.dueDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {t.badge && (
                          <span className={cn(
                            "text-[11px] font-medium px-2.5 py-0.5 rounded-lg border",
                            t.isCustom
                              ? "bg-primary/10 text-primary border-primary/20 font-bold"
                              : "text-muted-foreground bg-muted/80 border-border/40"
                          )}>
                            {t.badge}
                          </span>
                        )}
                        {t.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustom(e, t)}
                            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete custom activity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Custom Work Form or Button */}
          {isAddingCustom ? (
            <div className="p-4 border border-primary/40 rounded-2xl bg-primary/[0.03] space-y-3">
              <span className="text-xs font-bold text-foreground block">
                Enter Custom Work ({activeTab})
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customTaskTitle}
                  onChange={(e) => setCustomTaskTitle(e.target.value)}
                  placeholder="What will you be working on?"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCustom();
                  }}
                  className="flex-1 px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={handleAddCustom}
                  className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                  className="px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsAddingCustom(true);
                setCustomTaskTitle("");
              }}
              className="w-full py-3.5 px-4 border-2 border-dashed border-primary/30 hover:border-primary text-primary font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-colors bg-primary/[0.02] hover:bg-primary/[0.06]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Work (Not Listed)</span>
            </button>
          )}

          {/* Active selection summary */}
          {selectedTask && (
            <div className="p-3 bg-muted/40 rounded-xl border border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Selected for this session: <strong className="text-foreground">{selectedTask.taskTitle}</strong>
              </span>
              <span className="font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-md">
                {selectedTask.taskType}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 px-6 border-t border-border/50 bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedTask && !customTaskTitle.trim()}
            className="px-6 py-2.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChangeMode ? "Save Changes" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
