import { useState, useEffect } from "react";
import { X,  Clock, Coffee, LogIn, LogOut, CheckCircle2, Pencil, Search } from "lucide-react";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle  } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Tasks", "Research", "Activity", "Meeting"];

type Task = { id: string, title: string, date?: string, isCustom?: boolean };
const MOCK_TASKS_DATA: Record<string, Task[]> = {
  "Tasks": [],
  "Research": [
    { id: "7", title: "Competitor Analysis: Acme Corp" }
  ],
  "Activity": [
    { id: "8", title: "Code Review: PR #1042" }
  ],
  "Meeting": [
    { id: "9", title: "Client Sync: TechNova" },
    { id: "10", title: "Daily Standup" }
  ]
};

type PunchStatus = "Punched Out" | "Punched In" | "On Break";

export function TimeTrackerWidget() {
  const [status, setStatus] = useState<PunchStatus>("Punched Out");
  const [workSeconds, setWorkSeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [punchInTime, setPunchInTime] = useState<string | null>(null);
  const [punchOutTime, setPunchOutTime] = useState<string | null>(null);
  const [isPunchInModalOpen, setIsPunchInModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0] || "Tasks");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTask, setCustomTask] = useState("");
  const [activeTasks, setActiveTasks] = useState<string[]>([]);
  const [activeTaskSeconds, setActiveTaskSeconds] = useState(0);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");

  const [taskData, setTaskData] = useState<Record<string, Task[]>>(MOCK_TASKS_DATA);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const fetchTasks = () => {
        const newData = { ...MOCK_TASKS_DATA };
        newData["Tasks"] = []; // Reset dynamic tasks

        try {
          const localProjects = localStorage.getItem("hrms_projects");
          if (localProjects) {
            const parsed = JSON.parse(localProjects);
            parsed.forEach((proj: any) => {
              if (proj.modules) {
                proj.modules.forEach((mod: any) => {
                  if (mod.tasks && mod.tasks.length > 0) {
                    mod.tasks.forEach((t: any) => {
                      if (newData["Tasks"]) {
                        newData["Tasks"].push({ id: t.id, title: t.title });
                      }
                    });
                  }
                });
              }
            });
          }
        } catch (e) {}

        try {
          const localTasks = localStorage.getItem("hrms_tasks");
          if (localTasks) {
            const parsed = JSON.parse(localTasks);
            if (parsed && parsed.length > 0) {
              parsed.forEach((t: any) => {
                if (newData["Tasks"]) {
                  newData["Tasks"].push({ id: t.id, title: t.title });
                }
              });
            }
          }
        } catch (e) {}

        setTaskData(newData);
      };
      
      fetchTasks();
      window.addEventListener("storage", fetchTasks);
      return () => window.removeEventListener("storage", fetchTasks);
    }
    return undefined;
  }, []);

  // Simulated timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status === "Punched In") {
      interval = setInterval(() => {
        setWorkSeconds(s => s + 1);
        setActiveTaskSeconds(s => s + 1);
      }, 1000);
    } else if (status === "On Break") {
      interval = setInterval(() => {
        setBreakSeconds(s => s + 1);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePunch = () => {
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (status === "Punched Out") {
      setIsPunchInModalOpen(true);
    } else {
      // Create work log entry on punch out
      if (activeTasks.length > 0 && workSeconds > 0) {
         try {
           const saved = localStorage.getItem("hrms_work_logs");
           let existingLogs: any[] = [];
           if (saved) { existingLogs = JSON.parse(saved); }
           
           const hoursVal = Math.round((workSeconds / 3600) * 100) / 100;
           const hoursPerTask = hoursVal / activeTasks.length;
           
           const newLogs = activeTasks.map((taskName, idx) => ({
             id: `log-${Date.now()}-${idx}`,
             employee: "Current User",
             avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=CurrentUser`,
             date: new Date().toISOString().split("T")[0],
             project: "Tracked Work",
             task: taskName,
             startTime: punchInTime || "09:00",
             endTime: timeString,
             hours: hoursPerTask,
             status: "Pending",
             description: "Automatically logged via Time Tracker."
           }));
           
           localStorage.setItem("hrms_work_logs", JSON.stringify([...newLogs, ...existingLogs]));
           window.dispatchEvent(new Event("storage"));
         } catch(e) {}
      }

      setStatus("Punched Out");
      setPunchOutTime(timeString);
      setActiveTasks([]);
      setWorkSeconds(0);
      setActiveTaskSeconds(0);
      setBreakSeconds(0);
    }
  };

  const confirmPunchIn = () => {
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Ensure we have a valid task before punching in
    let finalTasks = [...selectedTasks];
    if (customTask.trim()) {
      finalTasks.push(customTask.trim());
    }
    
    if (finalTasks.length === 0) return;

    setIsPunchInModalOpen(false);
    setStatus("Punched In");
    
    // If the active tasks changed, reset active timer
    if (finalTasks.join(",") !== activeTasks.join(",")) {
      setActiveTaskSeconds(0);
    }
    setActiveTasks(finalTasks);
    if (!punchInTime) {
      setPunchInTime(timeString);
    }
  };

  const handleBreak = () => {
    if (status === "Punched In") {
      setStatus("On Break");
    } else if (status === "On Break") {
      setStatus("Punched In");
    }
  };

  return (
    <div className="bg-card rounded-[32px] p-6 border border-border/60 shadow-sm relative overflow-hidden mb-8">
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <Clock className="w-48 h-48 text-foreground" />
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        
        {/* Status Indicator */}
        <div className="flex items-center gap-5 w-full md:w-auto">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-border">
            {status === "Punched Out" && <LogOut className="w-8 h-8 text-muted-foreground" />}
            {status === "Punched In" && <Clock className="w-8 h-8 text-primary" />}
            {status === "On Break" && <Coffee className="w-8 h-8 text-amber-500" />}
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Current Status</p>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {status === "Punched In" && (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </>
                )}
                {status === "On Break" && (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </>
                )}
                {status === "Punched Out" && (
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-muted-foreground"></span>
                )}
              </span>
              <h2 className={cn("text-2xl font-black tracking-tight", 
                status === "Punched In" ? "text-primary" : 
                status === "On Break" ? "text-amber-500" : "text-muted-foreground"
              )}>
                {status}
              </h2>
            </div>
          </div>
        </div>

        {/* Timers & Times */}
        <div className="flex items-center gap-8 px-8 border-x border-border/50">
          <div className="flex-1 flex flex-col justify-center">
            {activeTasks.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
                  Active Tasks <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeTasks.map((t, idx) => (
                    <span key={idx} className="text-sm font-black text-foreground bg-muted/50 px-2 py-0.5 rounded-md truncate max-w-[200px]" title={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
                  Active Task <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
                </p>
                <h3 className="text-sm font-black text-foreground">No active task</h3>
              </div>
            )}
            {status !== "Punched Out" && (
              <button 
                onClick={() => setIsPunchInModalOpen(true)}
                className="flex items-center gap-2 mt-3 pt-2 border-t border-border/40 hover:opacity-80 transition-opacity group text-left"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Task:</span>
                <span className="text-xs font-bold text-foreground truncate max-w-[150px] group-hover:text-primary transition-colors">{activeTasks.join(", ")}</span>
                <Pencil className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors ml-1" />
                <span className="text-xs font-mono font-bold text-primary ml-auto">{formatTime(activeTaskSeconds)}</span>
              </button>
            )}
          </div>
          <div className="hidden lg:flex flex-col gap-2 pl-8 border-l border-border/50">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Punch In</p>
              <p className="text-sm font-bold text-foreground leading-tight mt-1">{punchInTime || "--:--"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Punch Out</p>
              <p className="text-sm font-bold text-foreground leading-tight mt-1">{punchOutTime || "--:--"}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {status !== "Punched Out" && (
            <button 
              onClick={handleBreak}
              className={cn("flex-1 md:flex-none px-6 py-3 rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2",
                status === "On Break" 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200"
              )}
            >
              {status === "On Break" ? (
                <><CheckCircle2 className="w-4 h-4" /> End Break</>
              ) : (
                <><Coffee className="w-4 h-4" /> Take Break</>
              )}
            </button>
          )}

          <button 
            onClick={handlePunch}
            className={cn("flex-1 md:flex-none px-6 py-3 rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2",
              status === "Punched Out" 
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20" 
                : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {status === "Punched Out" ? (
              <><LogIn className="w-4 h-4" /> Punch In</>
            ) : (
              <><LogOut className="w-4 h-4" /> Punch Out</>
            )}
          </button>
        </div>

      </div>

      <Dialog open={isPunchInModalOpen} onOpenChange={setIsPunchInModalOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-6 pb-4 bg-card">
            <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Update Activity</h2>
            <p className="text-sm text-muted-foreground mt-1">What will you be working on right now?</p>
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
          </div>

          {/* Categories */}
          <div className="px-6 border-b border-border bg-card">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-4">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setIsAddingCustom(false);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300",
                    selectedCategory === cat 
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                      : "bg-transparent text-foreground/80 hover:bg-muted/60"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tasks */}
          <div className="p-6 bg-muted/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Select Task</h3>
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {taskData[selectedCategory]
                ?.filter(task => task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()))
                .map((task: Task) => {
                const isSelected = selectedTasks.includes(task.title);
                return (
                  <button
                    key={task.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTasks(prev => prev.filter(t => t !== task.title));
                      } else {
                        setSelectedTasks(prev => [...prev, task.title]);
                      }
                      setIsAddingCustom(false);
                      setCustomTask("");
                    }}
                  className={cn(
                    "w-full flex items-center justify-between text-left px-5 py-4 rounded-2xl border transition-all duration-300 group relative overflow-hidden",
                    isSelected && !isAddingCustom
                      ? "border-primary bg-primary/5 shadow-[0_4px_20px_rgba(0,165,108,0.08)] ring-1 ring-primary/20" 
                      : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors",
                      isSelected && !isAddingCustom ? "bg-primary border-primary text-white" : "border-border/80 bg-white group-hover:border-primary/50"
                    )}>
                      {isSelected && !isAddingCustom && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <span className={cn(
                      "font-bold text-sm",
                      isSelected && !isAddingCustom ? "text-primary" : "text-foreground"
                    )}>
                      {task.title}
                    </span>
                    {task.date && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-rose-50 text-rose-500">
                        {task.date}
                      </span>
                    )}
                  </div>
                  {task.isCustom && (
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      Custom Task
                    </span>
                  )}
                </button>
                );
              })}

              {!isAddingCustom ? (
                <button
                  onClick={() => {
                    setIsAddingCustom(true);
                  }}
                  className="w-full text-left px-5 py-4 rounded-2xl border border-dashed border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 transition-colors font-bold text-sm"
                >
                  + Add Custom Work (Not Listed)
                </button>
              ) : (
                <div className="w-full px-5 py-4 rounded-2xl border border-primary ring-1 ring-primary/20 bg-card shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2">New Custom Task</p>
                  <input
                    type="text"
                    autoFocus
                    placeholder="E.g. Brainstorming new logo ideas..."
                    value={customTask}
                    onChange={(e) => setCustomTask(e.target.value)}
                    className="w-full bg-transparent text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button
              onClick={() => setIsPunchInModalOpen(false)}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-foreground/70 hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmPunchIn}
              disabled={(selectedTasks.length === 0 && !customTask.trim())}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl shadow-md hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "Punched Out" ? "Save & Punch In" : "Update Task"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
