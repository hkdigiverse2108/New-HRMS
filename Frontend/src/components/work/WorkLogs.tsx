import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Filter, Clock, CheckCircle2, XCircle, MoreHorizontal, FileText, ScrollText, User, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

type WorkLog = {
  id: string;
  employee: string;
  avatar: string;
  date: string;
  project: string;
  task: string;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "17:30"
  hours: number;
  status: "Approved" | "Pending" | "Rejected";
  description: string;
};

const MOCK_LOGS: WorkLog[] = [
  { id: "1", employee: "Sarah Connor", avatar: "https://i.pravatar.cc/150?u=sarah", date: "2026-08-12", project: "Mobile App Redesign", task: "UI Mockups", startTime: "09:00", endTime: "13:30", hours: 4.5, status: "Approved", description: "Completed initial wireframes for onboarding." },
  { id: "2", employee: "John Doe", avatar: "https://i.pravatar.cc/150?u=john", date: "2026-08-12", project: "Backend API", task: "Database Migration", startTime: "10:00", endTime: "16:00", hours: 6, status: "Pending", description: "Started migration scripts for user table." },
  { id: "3", employee: "Emily Chen", avatar: "https://i.pravatar.cc/150?u=emily", date: "2026-08-11", project: "Marketing Site", task: "SEO Optimization", startTime: "14:00", endTime: "17:00", hours: 3, status: "Approved", description: "Updated meta tags and alt text across all pages." },
  { id: "4", employee: "Michael Brown", avatar: "https://i.pravatar.cc/150?u=michael", date: "2026-08-11", project: "Mobile App Redesign", task: "Bug Fixing", startTime: "09:30", endTime: "12:00", hours: 2.5, status: "Rejected", description: "Fixed login screen crash." },
  { id: "5", employee: "Sarah Connor", avatar: "https://i.pravatar.cc/150?u=sarah", date: "2026-08-11", project: "Mobile App Redesign", task: "User Testing Feedback", startTime: "14:00", endTime: "18:00", hours: 4, status: "Approved", description: "Synthesized feedback from pilot group." },
];

export function WorkLogs() {
  const [logs, setLogs] = useState<WorkLog[]>(() => {
    if (typeof window !== "undefined") {
      const saved = (typeof window !== 'undefined' ? localStorage.getItem("hrms_work_logs") : null);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return MOCK_LOGS;
  });
  
  useEffect(() => {
    localStorage.setItem("hrms_work_logs", JSON.stringify(logs));
  }, [logs]);

  const [availableTasks, setAvailableTasks] = useState<{ id: string; title: string; project: string }[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const fetchTasks = () => {
        let tasksList: { id: string; title: string; project: string }[] = [];
        
        // 1. Projects tasks
        try {
          const localProjects = (typeof window !== 'undefined' ? localStorage.getItem("hrms_projects") : null);
          if (localProjects) {
            const parsed = JSON.parse(localProjects);
            parsed.forEach((proj: any) => {
              if (proj.modules) {
                proj.modules.forEach((mod: any) => {
                  if (mod.tasks) {
                    mod.tasks.forEach((t: any) => {
                      tasksList.push({ id: t.id, title: t.title, project: proj.name });
                    });
                  }
                });
              }
            });
          }
        } catch (e) {}

        // 2. Independent tasks
        try {
          const localTasks = (typeof window !== 'undefined' ? localStorage.getItem("hrms_tasks") : null);
          if (localTasks) {
            const parsed = JSON.parse(localTasks);
            parsed.forEach((t: any) => {
              tasksList.push({ id: t.id, title: t.title, project: "Independent Tasks" });
            });
          }
        } catch (e) {}

        setAvailableTasks(tasksList);
      };
      
      fetchTasks();
      window.addEventListener("storage", fetchTasks);
      return () => window.removeEventListener("storage", fetchTasks);
    }
    return undefined;
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "employee">("all");
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  
  // Add Log Dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newLog, setNewLog] = useState({
    employee: "Sarah Connor",
    date: new Date().toISOString().split("T")[0],
    project: "",
    task: "",
    startTime: "09:00",
    endTime: "17:00",
    description: ""
  });

  const calculateHours = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const partsStart = start.split(":");
    const partsEnd = end.split(":");
    const sHour = Number(partsStart[0] || 0);
    const sMin = Number(partsStart[1] || 0);
    const eHour = Number(partsEnd[0] || 0);
    const eMin = Number(partsEnd[1] || 0);
    const diffMinutes = (eHour * 60 + eMin) - (sHour * 60 + sMin);
    if (diffMinutes <= 0) return 0;
    return Math.round((diffMinutes / 60) * 100) / 100;
  };

  const handleCreateLog = (e: React.FormEvent) => {
    e.preventDefault();
    const hoursVal = calculateHours(newLog.startTime, newLog.endTime);
    if (hoursVal <= 0) {
      toast.error("End Time must be after Start Time!");
      return;
    }

    const tasks = newLog.task
      ? newLog.task.split(",").map(t => t.trim()).filter(Boolean)
      : ["Development"];
      
    const hoursPerTask = hoursVal / Math.max(tasks.length, 1);

    const createdLogs: WorkLog[] = tasks.map((taskName, index) => ({
      id: `log-${Date.now()}-${index}`,
      employee: newLog.employee || "",
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${newLog.employee || "Sarah"}`,
      date: newLog.date || "",
      project: newLog.project || "General",
      task: taskName,
      startTime: newLog.startTime || "09:00",
      endTime: newLog.endTime || "17:00",
      hours: hoursPerTask,
      status: "Pending",
      description: newLog.description || ""
    }));

    setLogs([...createdLogs, ...logs]);
    setIsAddOpen(false);
    setNewLog({
      employee: "Sarah Connor",
      date: new Date().toISOString().split("T")[0],
      project: "",
      task: "",
      startTime: "09:00",
      endTime: "17:00",
      description: ""
    });
    toast.success("Work log submitted for approval!");
  };

  const handleUpdateStatus = (id: string, nextStatus: "Approved" | "Rejected") => {
    setLogs(logs.map(l => l.id === id ? { ...l, status: nextStatus } : l));
    toast.success(`Log status marked as ${nextStatus}!`);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => 
      log.employee.toLowerCase().includes(searchQuery.toLowerCase()) || 
      log.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.task.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [logs, searchQuery]);

  const { items: sortedLogs, requestSort, sortConfig } = useSortableData(filteredLogs);

  // Grouped Logs by Employee
  const employeeWiseGroups = useMemo(() => {
    const groups: Record<string, { logs: WorkLog[]; totalHours: number; avatar: string }> = {};
    filteredLogs.forEach(log => {
      if (!groups[log.employee]) {
        groups[log.employee] = { logs: [], totalHours: 0, avatar: log.avatar };
      }
      const g = groups[log.employee];
      if (g) {
        g.logs.push(log);
        g.totalHours += log.hours;
      }
    });
    return groups;
  }, [filteredLogs]);

  const totalHours = useMemo(() => logs.reduce((sum, log) => sum + log.hours, 0), [logs]);
  const pendingCount = useMemo(() => logs.filter(l => l.status === "Pending").length, [logs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Work Logs</h1>
          <p className="text-xs text-muted-foreground mt-1 font-semibold">Track developer hours and timeline activity logs</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by dev, project or task..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button 
            onClick={() => setIsAddOpen(true)}
            className="px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-primary/10 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Log
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card p-5 rounded-3xl border border-border/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wide">Total Hours Logged</p>
            <p className="text-3xl font-black text-foreground">{totalHours}h</p>
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
            <Clock className="w-6 h-6 text-primary" />
          </div>
        </div>
        <div className="bg-card p-5 rounded-3xl border border-border/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wide">Pending Approvals</p>
            <p className="text-3xl font-black text-amber-600">{pendingCount}</p>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
        </div>
        <div className="bg-card p-5 rounded-3xl border border-border/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wide">Approved Logs</p>
            <p className="text-3xl font-black text-emerald-600">{logs.length - pendingCount}</p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl border border-border/30 w-fit">
        <button
          onClick={() => setViewMode("all")}
          className={cn(
            "px-4 py-2 text-xs font-bold rounded-xl transition-all",
            viewMode === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          📋 All Timeline Logs
        </button>
        <button
          onClick={() => setViewMode("employee")}
          className={cn(
            "px-4 py-2 text-xs font-bold rounded-xl transition-all",
            viewMode === "employee" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          👥 Employee-wise Summary
        </button>
      </div>

      {viewMode === "all" ? (
        /* Standard Timeline View */
        <div className="bg-card rounded-[2.5rem] border border-border/50 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted/30 border-b border-border/50">
                <tr>
                  <SortableHeader label="Employee" sortKey="employee" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Date & Timeline" sortKey="date" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Project / Task" sortKey="project" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Description" sortKey="description" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <img src={log.avatar} alt={log.employee} className="w-9 h-9 rounded-full object-cover border-2 border-background shadow-sm" />
                        <div className="font-bold text-foreground text-xs">{log.employee}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-foreground">{format(new Date(log.date), "dd/MM/yyyy")}</div>
                      <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span>🕒 {log.startTime} to {log.endTime}</span>
                        <span className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">({log.hours}h)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-black text-primary">{log.project}</div>
                      <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mt-0.5">
                        <FileText className="w-3 h-3 text-muted-foreground/60" /> {log.task}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-foreground/80 line-clamp-2 max-w-xs leading-normal">{log.description}</div>
                    </td>


                  </tr>
                ))}
                
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                        <ScrollText className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">No logs found</h3>
                      <p className="text-xs text-muted-foreground mt-1">Try adjusting your search query.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Employee Wise Grouped Summary */
        <div className="grid grid-cols-1 gap-4">
          {Object.keys(employeeWiseGroups).map((name) => {
            const group = employeeWiseGroups[name];
            if (!group) return null;
            const isExpanded = expandedEmployee === name;

            return (
              <div 
                key={name}
                className="bg-card border border-border/50 rounded-[2rem] overflow-hidden transition-all shadow-sm"
              >
                {/* Accordion Toggle Header */}
                <div 
                  onClick={() => setExpandedEmployee(isExpanded ? null : name)}
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img src={group.avatar} alt={name} className="w-10 h-10 rounded-full border-2 border-background shadow-md" />
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{name}</h3>
                      <p className="text-xs text-muted-foreground font-semibold mt-0.5">{group.logs.length} logged timeline entries</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary rounded-xl font-bold text-xs">
                      ⏱️ {group.totalHours} hours
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Accordion Body details list */}
                {isExpanded && (
                  <div className="border-t border-border/40 bg-muted/5 p-6 space-y-4">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Logged Activities & Timeline</h4>
                    <div className="space-y-3">
                      {group.logs.map(log => (
                        <div 
                          key={log.id} 
                          className="bg-card p-4 rounded-2xl border border-border/40 shadow-sm flex flex-col md:flex-row justify-between gap-4 hover:border-primary/20 transition-all"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-lg">
                                {log.project}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <FileText className="w-3 h-3" /> {log.task}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {format(new Date(log.date), "dd/MM/yyyy")}
                              </span>
                            </div>
                            <p className="text-xs text-foreground font-semibold leading-relaxed">{log.description}</p>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-border/20">
                            <div className="text-right">
                              <div className="text-xs font-extrabold text-foreground">🕒 {log.startTime} to {log.endTime}</div>
                              <div className="text-[10px] text-muted-foreground font-bold font-mono mt-0.5">{log.hours}h log hours</div>
                            </div>


                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(employeeWiseGroups).length === 0 && (
            <div className="p-12 text-center bg-card border border-border/50 rounded-[2rem]">
              <ScrollText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-foreground">No custom employee groups found</h3>
              <p className="text-xs text-muted-foreground mt-1">Submit a log to see it categorized here.</p>
            </div>
          )}
        </div>
      )}

      {/* Add Work Log Modal - plain overlay */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[450px] bg-card border border-border/60 rounded-[2.5rem] p-0 overflow-hidden shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30 shrink-0">
            <div>
              <DialogTitle className="text-lg font-black tracking-tight">Add Work Log</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">Submit today's completed task timeline hours</p>
            </div>
          </div>

          <form onSubmit={handleCreateLog}>
            <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Employee Name</label>
                <select 
                  value={newLog.employee} 
                  onChange={(e) => setNewLog({ ...newLog, employee: e.target.value })}
                  className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                >
                  {["Sarah Connor", "John Doe", "Emily Chen", "Michael Brown"].map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Date</label>
                  <input 
                    type="date" 
                    required
                    value={newLog.date} 
                    onChange={(e) => setNewLog({ ...newLog, date: e.target.value })} 
                    className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Project Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Backend API"
                    value={newLog.project} 
                    onChange={(e) => setNewLog({ ...newLog, project: e.target.value })} 
                    className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Start Time</label>
                  <input 
                    type="time" 
                    required
                    value={newLog.startTime} 
                    onChange={(e) => setNewLog({ ...newLog, startTime: e.target.value })} 
                    className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">End Time</label>
                  <input 
                    type="time" 
                    required
                    value={newLog.endTime} 
                    onChange={(e) => setNewLog({ ...newLog, endTime: e.target.value })} 
                    className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center" 
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Select Tasks</label>
                <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar border border-border/50 rounded-xl p-2 bg-muted/20">
                  {availableTasks.map((t) => {
                    const currentTasks = newLog.task ? newLog.task.split(",").map(x => x.trim()).filter(Boolean) : [];
                    const isSelected = currentTasks.includes(t.title);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          let nextTasks = [...currentTasks];
                          if (isSelected) {
                            nextTasks = nextTasks.filter(x => x !== t.title);
                          } else {
                            nextTasks.push(t.title);
                          }
                          setNewLog({ ...newLog, task: nextTasks.join(", ") });
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg border transition-all duration-200",
                          isSelected
                            ? "border-primary bg-primary/10" 
                            : "border-transparent hover:bg-muted"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors",
                          isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border/80 bg-white"
                        )}>
                          {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <div className="flex flex-col">
                          <span className={cn(
                            "font-bold text-xs truncate",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {t.title}
                          </span>
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{t.project}</span>
                        </div>
                      </button>
                    );
                  })}
                  {availableTasks.length === 0 && (
                    <div className="text-center py-4 text-xs font-semibold text-muted-foreground">
                      No active tasks found in projects.
                    </div>
                  )}
                </div>
                
                {/* Custom Task Input */}
                <div className="mt-2">
                   <input 
                    type="text" 
                    placeholder="Or type a custom task (comma-separated)..."
                    value={newLog.task} 
                    onChange={(e) => setNewLog({ ...newLog, task: e.target.value })} 
                    className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Activity Notes</label>
                <textarea 
                  required
                  placeholder="Provide brief details on work progress..."
                  value={newLog.description} 
                  onChange={(e) => setNewLog({ ...newLog, description: e.target.value })} 
                  rows={3}
                  className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => setIsAddOpen(false)} 
                className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/95 transition-all text-sm"
              >
                Submit Log
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
