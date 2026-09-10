import { useState, useEffect, useMemo } from "react";
import { X, Search, Plus, Filter, LayoutGrid, List as ListIcon, MoreHorizontal, Calendar, Clock, CheckCircle2, MessageSquare, Paperclip, FileText, ChevronDown, Zap, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DialogClose, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useSales } from "@/components/sales/SalesContext";

type TaskStatus = "Todo" | "In Progress" | "In Review" | "Done";
type Priority = "High" | "Medium" | "Low";

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  assignees: { name: string; avatar: string }[];
  assignedBy?: { name: string; avatar: string };
  commentsCount: number;
  attachmentsCount: number;
  isProjectTask?: boolean;
  projectId?: string;
  moduleId?: string;
  clientId?: string;
  originalStatus?: string;
  isSalesTask?: boolean;
}

export function Tasks({ setActive, isNew }: { setActive?: (route: string) => void, isNew?: boolean }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [independentTasks, setIndependentTasks] = useState<Task[]>([]);
  const { tasks: salesTasks, setTasks: setSalesTasks } = useSales();

  const handleRedirectToProject = (e: React.MouseEvent, projectId: string, clientId?: string, moduleId?: string) => {
    e.stopPropagation();
    if (typeof window !== "undefined") {
      localStorage.setItem("hrms_selected_project_id", projectId);
      if (clientId) {
        localStorage.setItem("hrms_selected_client_id", clientId);
      }
      if (moduleId) {
        localStorage.setItem("hrms_selected_module_id", moduleId);
      }
      if (setActive) {
        setActive("/work/projects");
      }
    }
  };
  const [view, setView] = useState<"board" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | TaskStatus>("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | Priority>("All");
  const [projectFilter, setProjectFilter] = useState<"All" | string>("All");

  const [isNewTaskOpen, setIsNewTaskOpen] = useState(isNew || false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>("Medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState("");
  const [inlineAssigneeSearchQuery, setInlineAssigneeSearchQuery] = useState("");

  // Quick Assign state
  const [showQuickAssign, setShowQuickAssign] = useState(false);
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);
  const [quickTasks, setQuickTasks] = useState<Array<{ title: string; assignee: string; dueDate: string }>>([{ title: "", assignee: "", dueDate: "" }]);

  const addQuickRow = () => {
    setQuickTasks(prev => {
      const last = prev[prev.length - 1];
      return [...prev, { title: "", assignee: last?.assignee ?? "", dueDate: last?.dueDate ?? "" }];
    });
  };

  const updateQuickField = (idx: number, field: "title" | "assignee" | "dueDate", value: string) => {
    setQuickTasks(prev => {
      const updated = prev.map(t => ({ ...t }));
      if (field === "title") {
        updated[idx]!.title = value;
      } else {
        // propagate assignee/dueDate downwards
        for (let i = idx; i < updated.length; i++) {
          updated[i]![field] = value;
        }
      }
      return updated;
    });
  };

  const removeQuickRow = (idx: number) => {
    setQuickTasks(prev => prev.length <= 1 ? [{ title: "", assignee: "", dueDate: "" }] : prev.filter((_, i) => i !== idx));
  };

  const handleQuickTitleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (idx === quickTasks.length - 1) addQuickRow();
      setTimeout(() => {
        const next = document.getElementById(`qt-title-${idx + 1}`);
        if (next) next.focus();
      }, 50);
    }
  };

  const handleBulkQuickAssign = () => {
    const valid = quickTasks.filter(t => t.title.trim());
    if (valid.length === 0) {
      toast.error("Please add at least one task title.");
      return;
    }
    setIsQuickSubmitting(true);
    const newTasks: Task[] = valid.map(t => ({
      id: `task-qa-${Date.now()}-${Math.random()}`,
      title: t.title.trim(),
      description: "",
      status: "Todo",
      priority: "Medium",
      dueDate: t.dueDate,
      assignees: t.assignee
        ? [{ name: t.assignee, avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(t.assignee)}&background=random` }]
        : [],
      commentsCount: 0,
      attachmentsCount: 0,
    }));
    setTimeout(() => {
      setIndependentTasks(prev => [...newTasks, ...prev]);
      setIsQuickSubmitting(false);
      setShowQuickAssign(false);
      setQuickTasks([{ title: "", assignee: "", dueDate: "" }]);
      toast.success(`${valid.length} task(s) created successfully!`);
    }, 600);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_employees') : null);
      if (saved) {
        try {
          setEmployees(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, []);

  const [inlineEditingTaskId, setInlineEditingTaskId] = useState<string | null>(null);
  const [inlineTaskTitle, setInlineTaskTitle] = useState("");
  const [inlineTaskDesc, setInlineTaskDesc] = useState("");
  const [inlineTaskStatus, setInlineTaskStatus] = useState<TaskStatus>("Todo");
  const [inlineTaskPriority, setInlineTaskPriority] = useState<Priority>("Medium");
  const [inlineTaskDueDate, setInlineTaskDueDate] = useState("");
  const [inlineTaskAssignees, setInlineTaskAssignees] = useState<string[]>([]);

  // Load from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const localProjects = (typeof window !== 'undefined' ? localStorage.getItem("hrms_projects") : null);
      let currentProjects = [];
      if (localProjects) {
        try {
          currentProjects = JSON.parse(localProjects);
        } catch (e) {}
      }

      // Auto-generate daily tasks for Digital Marketing projects
      let updated = false;
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const prevDate = format(d, "yyyy-MM-dd");

      const processedProjects = currentProjects.map((project: any) => {
        if (project.category === "Digital Marketing") {
          const modules = [...(project.modules || [])];
          let dailyModule = modules.find((m: any) => m.id === "daily-data-entry");
          if (!dailyModule) {
            dailyModule = {
              id: "daily-data-entry",
              name: "Daily Data Entry",
              status: "todo",
              priority: "medium",
              tasks: []
            };
            modules.push(dailyModule);
            updated = true;
          }

          const tasks = dailyModule.tasks || [];
          const taskExists = tasks.some((t: any) => t.id === `daily-task-${project.id}-${prevDate}` || t.dueDate === prevDate);
          if (!taskExists) {
            const newTask = {
              id: `daily-task-${project.id}-${prevDate}`,
              title: `Add previous day data (${prevDate})`,
              status: "todo",
              dueDate: prevDate,
              assignedToName: project.team[0]?.name || "Emma",
              assignedToAvatar: project.team[0]?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${project.team[0]?.name || "Emma"}`
            };
            const updatedTasks = [...tasks, newTask];
            const updatedModules = modules.map((m: any) => m.id === "daily-data-entry" ? { ...m, tasks: updatedTasks } : m);
            updated = true;
            return { ...project, modules: updatedModules };
          }
        }
        return project;
      });

      if (updated) {
        localStorage.setItem("hrms_projects", JSON.stringify(processedProjects));
        setProjects(processedProjects);
        window.dispatchEvent(new Event("storage"));
      } else {
        setProjects(currentProjects);
      }

      const localTasks = (typeof window !== 'undefined' ? localStorage.getItem("hrms_tasks") : null);
      if (localTasks) {
        setIndependentTasks(JSON.parse(localTasks));
      } else {
        const initialTasks: Task[] = [
          { id: "ind-1", title: "Review brand guideline guidelines", description: "Audit color tokens for dark mode alignment.", status: "In Progress", priority: "High", dueDate: "2026-08-15", assignees: [{ name: "Alex", avatar: "https://i.pravatar.cc/150?u=alex" }], commentsCount: 0, attachmentsCount: 0 }
        ];
        setIndependentTasks(initialTasks);
        localStorage.setItem("hrms_tasks", JSON.stringify(initialTasks));
      }
    }
  }, []);

  // Listen to external localstorage changes (like Projects.tsx updating tasks)
  useEffect(() => {
    const handleStorageChange = () => {
      const localProjects = (typeof window !== 'undefined' ? localStorage.getItem("hrms_projects") : null);
      if (localProjects) {
        setProjects(JSON.parse(localProjects));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Sync independent tasks
  const saveIndependentTasks = (newTasks: Task[]) => {
    setIndependentTasks(newTasks);
    localStorage.setItem("hrms_tasks", JSON.stringify(newTasks));
  };

  // Sync projects state
  const saveProjects = (newProjects: any[]) => {
    setProjects(newProjects);
    localStorage.setItem("hrms_projects", JSON.stringify(newProjects));
    // Dispatch storage event locally so other components are aware
    window.dispatchEvent(new Event("storage"));
  };

  // Aggregate independent tasks + project module tasks
  const allTasks = useMemo(() => {
    const projectTasksList: Task[] = [];
    projects.forEach(project => {
      const modules = project.modules || [];
      modules.forEach((mod: any) => {
        const mTasks = mod.tasks || [];
        mTasks.forEach((t: any) => {
          // Map project status to Tasks status
          let mappedStatus: TaskStatus = "Todo";
          if (t.status === "completed") mappedStatus = "Done";
          else if (t.status === "in-progress" || t.status === "bugs") mappedStatus = "In Progress";
          else if (t.status === "pending") mappedStatus = "In Review";

          let mappedPriority: Priority = "Medium";
          if (mod.priority === "high" || mod.priority === "urgent") mappedPriority = "High";
          else if (mod.priority === "low") mappedPriority = "Low";

          projectTasksList.push({
            id: t.id,
            title: t.title,
            description: `Project: ${project.name} | Module: ${mod.name}`,
            status: mappedStatus,
            priority: mappedPriority,
            dueDate: t.dueDate || mod.dueDate || format(new Date(), "yyyy-MM-dd"),
            assignees: t.assignedToName 
              ? t.assignedToName.split(", ").map((name: string) => ({ name, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}` }))
              : (mod.assignedToName 
                  ? mod.assignedToName.split(", ").map((name: string) => ({ name, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}` }))
                  : []),
            commentsCount: 0,
            attachmentsCount: 0,
            isProjectTask: true,
            projectId: project.id,
            moduleId: mod.id,
            clientId: project.clientId,
            originalStatus: t.status
          });
        });
      });
    });

    const mappedSalesTasks: Task[] = salesTasks.map(t => {
      let mappedStatus: TaskStatus = "Todo";
      if (t.status === "completed") mappedStatus = "Done";
      else if (t.status === "today" || t.status === "overdue") mappedStatus = "In Progress";
      
      return {
        id: t.id,
        title: `${t.type} — ${t.company}`,
        description: "Sales Task",
        status: mappedStatus,
        priority: t.priority,
        dueDate: t.dueDate,
        assignees: t.assignee ? [{ name: t.assignee, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${t.assignee}` }] : [],
        commentsCount: 0,
        attachmentsCount: 0,
        isSalesTask: true,
        originalStatus: t.status
      };
    });

    return [...independentTasks, ...projectTasksList, ...mappedSalesTasks];
  }, [projects, independentTasks, salesTasks]);

  const stats = useMemo(() => {
    const total = allTasks.length;
    const todo = allTasks.filter(t => t.status === "Todo").length;
    const inProgress = allTasks.filter(t => t.status === "In Progress").length;
    const inReview = allTasks.filter(t => t.status === "In Review").length;
    const done = allTasks.filter(t => t.status === "Done").length;
    return { total, todo, inProgress, inReview, done };
  }, [allTasks]);

  const filteredTasks = useMemo(() => {
    let result = allTasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (statusFilter !== "All") {
      result = result.filter(t => t.status === statusFilter);
    }
    if (priorityFilter !== "All") {
      result = result.filter(t => t.priority === priorityFilter);
    }
    if (projectFilter !== "All") {
      if (projectFilter === "Independent") {
        result = result.filter(t => !t.isProjectTask);
      } else {
        result = result.filter(t => t.projectId === projectFilter);
      }
    }
    return result;
  }, [allTasks, searchQuery, statusFilter, priorityFilter, projectFilter]);

  const { items: sortedTasks, requestSort, sortConfig } = useSortableData(filteredTasks);

  const updateTaskStatus = (taskId: string, nextStatus: TaskStatus) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.isProjectTask && task.projectId && task.moduleId) {
      // Map TaskStatus back to Module status
      let originalStatus = "todo";
      if (nextStatus === "Done") originalStatus = "completed";
      else if (nextStatus === "In Progress") originalStatus = "in-progress";
      else if (nextStatus === "In Review") originalStatus = "pending";

      const newProjects = projects.map(p => {
        if (p.id === task.projectId) {
          const modules = p.modules || [];
          const updatedModules = modules.map((m: any) => {
            if (m.id === task.moduleId) {
              const updatedTasks = m.tasks.map((t: any) => {
                if (t.id === taskId) {
                  return { ...t, status: originalStatus };
                }
                return t;
              });
              return { ...m, tasks: updatedTasks };
            }
            return m;
          });
          return { ...p, modules: updatedModules };
        }
        return p;
      });
      saveProjects(newProjects);
      toast.success("Project task status synced!");
    } else if (task.isSalesTask) {
      let originalStatus = "upcoming";
      if (nextStatus === "Done") originalStatus = "completed";
      else if (nextStatus === "In Progress") originalStatus = "today";
      
      const updated = salesTasks.map(st => st.id === taskId ? { ...st, status: originalStatus as any } : st);
      setSalesTasks(updated);
      toast.success("Sales task status synced!");
    } else {
      const updated = independentTasks.map(t => t.id === taskId ? { ...t, status: nextStatus } : t);
      saveIndependentTasks(updated);
      toast.success("Task status updated!");
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) {
      toast.error("Task title is required");
      return;
    }

    if (editingTaskId) {
      const task = allTasks.find(t => t.id === editingTaskId);
      const assigneesList = newTaskAssignees.map(name => {
        const emp = employees.find(e => e.name === name);
        return { name, avatar: emp?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}` };
      });

      if (task?.isProjectTask && task.projectId && task.moduleId) {
        const newProjects = projects.map(p => {
          if (p.id === task.projectId) {
            const modules = p.modules || [];
            const updatedModules = modules.map((m: any) => {
              if (m.id === task.moduleId) {
                const updatedTasks = m.tasks.map((t: any) => {
                  if (t.id === editingTaskId) {
                    return { ...t, title: newTaskTitle, dueDate: newTaskDueDate || t.dueDate, assignedToName: newTaskAssignees.join(", ") || undefined };
                  }
                  return t;
                });
                return { ...m, tasks: updatedTasks };
              }
              return m;
            });
            return { ...p, modules: updatedModules };
          }
          return p;
        });
        saveProjects(newProjects);
      } else if (task?.isSalesTask) {
        const updated = salesTasks.map(st => st.id === editingTaskId ? { ...st, type: newTaskTitle, company: newTaskDesc, dueDate: newTaskDueDate || st.dueDate, assignee: newTaskAssignees[0] || st.assignee } : st);
        setSalesTasks(updated);
      } else {
        const updated = independentTasks.map(t => t.id === editingTaskId ? {
          ...t,
          title: newTaskTitle,
          description: newTaskDesc,
          priority: newTaskPriority,
          dueDate: newTaskDueDate || t.dueDate,
          assignees: assigneesList
        } : t);
        saveIndependentTasks(updated);
      }
      toast.success("Task updated successfully!");
    } else {
      const assigneesList = newTaskAssignees.length > 0 
        ? newTaskAssignees.map(name => {
            const emp = employees.find(e => e.name === name);
            return { name, avatar: emp?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}` };
          })
        : [{ name: "Alex (You)", avatar: "https://i.pravatar.cc/150?u=alex" }];

      const newTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        title: newTaskTitle,
        description: newTaskDesc,
        status: "Todo",
        priority: newTaskPriority,
        dueDate: newTaskDueDate || format(new Date(), "yyyy-MM-dd"),
        assignees: assigneesList,
        commentsCount: 0,
        attachmentsCount: 0,
      };
      saveIndependentTasks([newTask, ...independentTasks]);
      toast.success("Task created successfully!");
    }

    setIsNewTaskOpen(false);
    setEditingTaskId(null);
    setNewTaskTitle("");
    setNewTaskDesc("");
    setNewTaskPriority("Medium");
    setNewTaskDueDate("");
    setNewTaskAssignees([]);
  };

  const openEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskDesc(task.description);
    setNewTaskPriority(task.priority);
    setNewTaskDueDate(task.dueDate);
    setNewTaskAssignees(task.assignees.map(a => a.name));
    setIsNewTaskOpen(true);
  };

  const startInlineEdit = (task: Task) => {
    setInlineEditingTaskId(task.id);
    setInlineTaskTitle(task.title);
    setInlineTaskDesc(task.description);
    setInlineTaskStatus(task.status);
    setInlineTaskPriority(task.priority);
    setInlineTaskDueDate(task.dueDate);
    setInlineTaskAssignees(task.assignees.map(a => a.name));
  };

  const saveInlineEdit = () => {
    if (!inlineEditingTaskId) return;

    const task = allTasks.find(t => t.id === inlineEditingTaskId);
    const assigneesList = inlineTaskAssignees.map(name => {
      const emp = employees.find(e => e.name === name);
      return { name, avatar: emp?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}` };
    });

    if (task?.isProjectTask && task.projectId && task.moduleId) {
      let originalStatus = "todo";
      if (inlineTaskStatus === "Done") originalStatus = "completed";
      else if (inlineTaskStatus === "In Progress") originalStatus = "in-progress";
      else if (inlineTaskStatus === "In Review") originalStatus = "pending";

      const newProjects = projects.map(p => {
        if (p.id === task.projectId) {
          const modules = p.modules || [];
          const updatedModules = modules.map((m: any) => {
            if (m.id === task.moduleId) {
              const updatedTasks = m.tasks.map((t: any) => {
                if (t.id === inlineEditingTaskId) {
                  return { ...t, title: inlineTaskTitle, status: originalStatus, assignedToName: inlineTaskAssignees.join(", ") || undefined };
                }
                return t;
              });
              return { ...m, tasks: updatedTasks };
            }
            return m;
          });
          return { ...p, modules: updatedModules };
        }
        return p;
      });
      saveProjects(newProjects);
    } else if (task?.isSalesTask) {
      let originalStatus = "upcoming";
      if (inlineTaskStatus === "Done") originalStatus = "completed";
      else if (inlineTaskStatus === "In Progress") originalStatus = "today";

      const updated = salesTasks.map(st => st.id === inlineEditingTaskId ? { ...st, type: inlineTaskTitle, status: originalStatus as any, assignee: inlineTaskAssignees[0] || st.assignee } : st);
      setSalesTasks(updated);
    } else {
      const updated = independentTasks.map(t => t.id === inlineEditingTaskId ? {
        ...t,
        title: inlineTaskTitle,
        description: inlineTaskDesc,
        status: inlineTaskStatus,
        priority: inlineTaskPriority,
        dueDate: inlineTaskDueDate,
        assignees: assigneesList
      } : t);
      saveIndependentTasks(updated);
    }

    setInlineEditingTaskId(null);
    toast.success("Task updated!");
  };

  const columns: { title: string; status: TaskStatus }[] = [
    { title: "To Do", status: "Todo" },
    { title: "In Progress", status: "In Progress" },
    { title: "In Review", status: "In Review" },
    { title: "Done", status: "Done" },
  ];

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case "High": return "bg-rose-100 text-rose-700";
      case "Medium": return "bg-amber-100 text-amber-700";
      case "Low": return "bg-emerald-100 text-emerald-700";
    }
  };

  return (
    <div className="space-y-5 h-[calc(100vh-4rem)] flex flex-col pb-0 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Tasks</h1>
          <p className="text-xs text-muted-foreground mt-1 font-semibold">Unified dashboard mapping direct tasks and client project tasks</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs font-semibold hover:bg-muted transition-colors text-foreground">
                <Filter className="w-4 h-4" />
                Filter
                {(priorityFilter !== "All" || projectFilter !== "All") && (
                  <span className="w-2 h-2 rounded-full bg-primary ml-1" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm">Filters</h4>
                  {(priorityFilter !== "All" || projectFilter !== "All") && (
                    <button 
                      onClick={() => { setPriorityFilter("All"); setProjectFilter("All"); }}
                      className="text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</label>
                  <select 
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as any)}
                    className="w-full p-2 bg-muted/50 border border-border rounded-lg text-xs focus:outline-none"
                  >
                    <option value="All">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project</label>
                  <select 
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="w-full p-2 bg-muted/50 border border-border rounded-lg text-xs focus:outline-none"
                  >
                    <option value="All">All Projects</option>
                    <option value="Independent">Independent Tasks</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center bg-muted/40 border border-border/50 rounded-xl p-1 shrink-0">
            <button 
              onClick={() => setView("board")}
              className={cn("p-1.5 rounded-lg transition-colors", view === "board" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground/80")}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setView("list")}
              className={cn("p-1.5 rounded-lg transition-colors", view === "list" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground/80")}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Assign Button + Dialog */}
          <Dialog open={showQuickAssign} onOpenChange={(open) => {
            setShowQuickAssign(open);
            if (!open) setQuickTasks([{ title: "", assignee: "", dueDate: "" }]);
          }}>
            <DialogTrigger asChild>
              <button className="px-4 py-2 bg-muted/60 border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-sm shrink-0">
                <Zap className="w-4 h-4" />
                <span>Quick Assign</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[820px] w-[95vw] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
              <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/50 bg-muted/30">
                <div>
                  <h2 className="text-lg font-black tracking-tight">Quick Assign Tasks</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Press <kbd className="bg-muted px-1 py-0.5 rounded border text-[10px] font-bold">Enter</kbd> in a title field to add a new row. Assignee &amp; date propagate down.
                  </p>
                </div>
                <DialogClose asChild>
                  <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </DialogClose>
              </div>

              <div className="flex flex-col max-h-[65vh] overflow-hidden">
                {/* Column Headers */}
                <div className="grid grid-cols-12 gap-3 px-6 md:px-8 py-3 border-b border-border/40 bg-muted/10">
                  <div className="col-span-5 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Task Title *</div>
                  <div className="col-span-4 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Assignee</div>
                  <div className="col-span-2 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Due Date</div>
                  <div className="col-span-1 text-center text-[10px] font-black text-muted-foreground uppercase tracking-wider">Del</div>
                </div>

                {/* Task Rows */}
                <div className="p-4 md:px-8 space-y-2 overflow-y-auto flex-1">
                  {quickTasks.map((task, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center p-1.5 rounded-xl hover:bg-muted/30 border border-transparent hover:border-border/40 transition-all">
                      <div className="col-span-5">
                        <input
                          id={`qt-title-${idx}`}
                          type="text"
                          placeholder="Enter task name..."
                          value={task.title}
                          onChange={e => updateQuickField(idx, "title", e.target.value)}
                          onKeyDown={e => handleQuickTitleKeyDown(e, idx)}
                          className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary/50 transition-all"
                        />
                      </div>
                      <div className="col-span-4">
                        <SearchableSelect
                          value={task.assignee}
                          onChange={val => updateQuickField(idx, "assignee", val)}
                          options={[
                            { label: "Unassigned", value: "" },
                            ...(employees.length > 0
                              ? employees.map((e: any) => ({ label: e.name || `${e.firstName} ${e.lastName}`.trim(), value: e.name || `${e.firstName} ${e.lastName}`.trim() }))
                              : [{label: "Alex Johnson", value: "Alex Johnson"}, {label: "Sarah Connor", value: "Sarah Connor"}, {label: "Mike Peters", value: "Mike Peters"}]
                            )
                          ]}
                          placeholder="Select assignee"
                          className="w-full h-[34px] px-3 bg-muted/40 border border-border/60 rounded-xl text-xs font-semibold focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="date"
                          value={task.dueDate}
                          onChange={e => updateQuickField(idx, "dueDate", e.target.value)}
                          className="w-full px-2 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => removeQuickRow(idx)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add Row Button */}
                  <button
                    type="button"
                    onClick={addQuickRow}
                    className="w-full border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Row
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 md:px-8 py-4 border-t border-border/50 bg-muted/30 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground font-semibold">
                  {quickTasks.filter(t => t.title.trim()).length} task(s) ready to create
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowQuickAssign(false); setQuickTasks([{ title: "", assignee: "", dueDate: "" }]); }}
                    className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-xs rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkQuickAssign}
                    disabled={isQuickSubmitting || quickTasks.filter(t => t.title.trim()).length === 0}
                    className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {isQuickSubmitting ? "Creating..." : `Assign ${quickTasks.filter(t => t.title.trim()).length} Task(s)`}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isNewTaskOpen} onOpenChange={(open) => {
            setIsNewTaskOpen(open);
            if (!open) {
              setEditingTaskId(null);
              setNewTaskTitle("");
              setNewTaskDesc("");
              setNewTaskPriority("Medium");
              setNewTaskDueDate("");
            }
          }}>
            <DialogTrigger asChild>
              <button className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-sm shrink-0">
                <Plus className="w-4 h-4" />
                <span>New Task</span>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] md:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
              <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
                <div>
                  <h2 className="text-lg font-black tracking-tight">{editingTaskId ? "Edit Task" : "Create New Task"}</h2>
                </div>
                <DialogClose asChild>
                  <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </DialogClose>
              </div>
              <form onSubmit={handleCreateTask} className="flex flex-col max-h-[70vh]">
                <div className="p-6 md:p-8 space-y-4 overflow-y-auto">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Task Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Design Logo"
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Description</label>
                    <textarea 
                      rows={3}
                      placeholder="Task details..."
                      value={newTaskDesc}
                      onChange={e => setNewTaskDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Priority</label>
                      <SearchableSelect
                        value={newTaskPriority}
                        onChange={(val) => setNewTaskPriority(val as Priority)}
                        options={[
                          { label: "High", value: "High" },
                          { label: "Medium", value: "Medium" },
                          { label: "Low", value: "Low" }
                        ]}
                        className="w-full h-[38px] px-3 bg-muted/50 border border-border/50 rounded-xl text-xs font-bold focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Due Date</label>
                      <input 
                        type="date" 
                        value={newTaskDueDate}
                        onChange={e => setNewTaskDueDate(e.target.value)}
                        className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Assignee</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-[38px] w-full items-center justify-between whitespace-nowrap rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-xs font-bold focus:outline-none"
                        >
                          <span className="truncate">
                            {newTaskAssignees.length > 0 ? newTaskAssignees.join(", ") : "Select Assignees..."}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-2 bg-card border border-border rounded-xl shadow-xl z-[250]" align="start">
                        <div className="px-1 py-1 border-b border-border/40 mb-1">
                          <input
                            type="text"
                            placeholder="Search employee..."
                            value={assigneeSearchQuery}
                            onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-border rounded-lg bg-muted/30 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                          {employees.filter(emp => emp.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase())).map((emp) => {
                            const isChecked = newTaskAssignees.includes(emp.name);
                            return (
                              <label key={emp.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-lg cursor-pointer text-xs font-bold select-none text-foreground">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setNewTaskAssignees(newTaskAssignees.filter(n => n !== emp.name));
                                    } else {
                                      setNewTaskAssignees([...newTaskAssignees, emp.name]);
                                    }
                                  }}
                                  className="rounded border-border text-primary focus:ring-primary/20 w-3.5 h-3.5"
                                />
                                {emp.name}
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsNewTaskOpen(false)}
                    className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-xs rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl transition-colors"
                  >
                    {editingTaskId ? "Save Changes" : "Create Task"}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards / Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0 text-left">
        {[
          { label: "Total Tasks", count: stats.total, filterVal: "All" as const, color: "bg-muted/10 border-border/80 text-foreground" },
          { label: "To Do", count: stats.todo, filterVal: "Todo" as const, color: "bg-blue-500/10 border-blue-500/20 text-blue-700" },
          { label: "In Progress", count: stats.inProgress, filterVal: "In Progress" as const, color: "bg-amber-500/10 border-amber-500/20 text-amber-700" },
          { label: "In Review", count: stats.inReview, filterVal: "In Review" as const, color: "bg-purple-500/10 border-purple-500/20 text-purple-700" },
          { label: "Completed", count: stats.done, filterVal: "Done" as const, color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" },
        ].map(kpi => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => setStatusFilter(kpi.filterVal)}
            className={cn(
              "p-3 rounded-2xl border flex flex-col text-left transition-all duration-200 shadow-sm",
              kpi.color,
              statusFilter === kpi.filterVal 
                ? "ring-2 ring-primary/40 border-transparent scale-[1.02] shadow-md font-black" 
                : "opacity-75 hover:opacity-100 hover:scale-[1.01]"
            )}
          >
            <span className="text-[10px] font-black uppercase tracking-wider opacity-85">{kpi.label}</span>
            <span className="text-lg font-black mt-1 leading-none">{kpi.count}</span>
          </button>
        ))}
      </div>

      {view === "board" ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <div className="flex gap-6 h-full min-w-max">
            {columns.map(col => {
              const colTasks = filteredTasks.filter(t => t.status === col.status);
              return (
                <div 
                  key={col.status} 
                  className="w-80 flex flex-col bg-muted/20 rounded-[2.5rem] border border-border/40 shrink-0 overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('taskId');
                    updateTaskStatus(taskId, col.status);
                  }}
                >
                  <div className="p-5 border-b border-border/40 flex items-center justify-between bg-muted/10">
                    <h3 className="font-bold text-xs text-foreground/80 uppercase tracking-wider">{col.title}</h3>
                    <span className="bg-card text-foreground text-xs font-bold px-2 py-0.5 rounded-lg border border-border/55">{colTasks.length}</span>
                  </div>
                  
                  <div className="flex-1 p-4 overflow-y-auto space-y-3">
                    {colTasks.map(task => (
                      <div 
                        key={task.id} 
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                        onClick={() => openEditTask(task)}
                        className="bg-card p-4 rounded-2xl border border-border/40 shadow-sm hover:border-primary/20 transition-all group cursor-pointer space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border", getPriorityColor(task.priority))}>
                            {task.priority}
                          </span>
                          {task.isProjectTask && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-black bg-primary/10 text-primary border border-primary/25 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                Project Task
                              </span>
                              <button
                                onClick={(e) => handleRedirectToProject(e, task.projectId!, task.clientId, task.moduleId)}
                                className="text-[9px] font-bold bg-muted hover:bg-muted/80 text-muted-foreground border border-border/50 px-2 py-0.5 rounded-md flex items-center gap-0.5 transition-colors"
                                title="View project workspace"
                              >
                                🔗 Go to Project
                              </button>
                            </div>
                          )}
                          {task.isSalesTask && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/25 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                Sales Task
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); if(setActive) setActive("/work/sales/tasks"); }}
                                className="text-[9px] font-bold bg-muted hover:bg-muted/80 text-muted-foreground border border-border/50 px-2 py-0.5 rounded-md flex items-center gap-0.5 transition-colors"
                                title="View sales tasks"
                              >
                                🔗 Go to Sales
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <h4 className="font-bold text-foreground text-xs leading-tight">{task.title}</h4>
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                        </div>
                        
                        <div className="flex items-center justify-between border-t border-border/20 pt-2 mt-2">
                          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(task.dueDate), "dd/MM/yyyy")}
                          </div>
                          
                          <div className="text-[10px] font-bold text-muted-foreground truncate max-w-[120px]" title={task.assignees.map(a => a.name).join(", ")}>
                            {task.assignees.map(a => a.name).join(", ") || "Unassigned"}
                          </div>
                        </div>
                      </div>
                    ))}

                    {colTasks.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground/30 text-xs font-bold">
                        Drag tasks here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-card rounded-[2.5rem] border border-border/50 overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted/30 border-b border-border sticky top-0">
                <tr>
                  <SortableHeader label="Task Details" sortKey="title" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Priority" sortKey="priority" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Due Date" sortKey="dueDate" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Assigned To</th>
                  <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Assigned By</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedTasks.map(task => (
                  <tr key={task.id} className="hover:bg-muted/20 transition-colors group cursor-pointer" onClick={() => !inlineEditingTaskId && startInlineEdit(task)}>
                    {inlineEditingTaskId === task.id ? (
                      <>
                        <td className="px-6 py-4">
                          <input 
                            value={inlineTaskTitle} 
                            onChange={(e) => setInlineTaskTitle(e.target.value)} 
                            className="w-full px-2.5 py-1.5 text-xs font-bold border border-border rounded-xl mb-1.5 focus:outline-none font-semibold" 
                          />
                          <input 
                            value={inlineTaskDesc} 
                            onChange={(e) => setInlineTaskDesc(e.target.value)} 
                            className="w-full px-2.5 py-1 text-[10px] text-muted-foreground border border-border rounded-lg focus:outline-none font-medium" 
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <SearchableSelect 
                            value={inlineTaskStatus}
                            onChange={(val) => setInlineTaskStatus(val as TaskStatus)}
                            options={[
                              { label: "Todo", value: "Todo" },
                              { label: "In Progress", value: "In Progress" },
                              { label: "In Review", value: "In Review" },
                              { label: "Done", value: "Done" }
                            ]}
                            className="w-[120px] h-[30px] px-2 text-xs font-semibold bg-card border border-border rounded-xl focus:outline-none"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <SearchableSelect 
                            value={inlineTaskPriority}
                            onChange={(val) => setInlineTaskPriority(val as Priority)}
                            options={[
                              { label: "High", value: "High" },
                              { label: "Medium", value: "Medium" },
                              { label: "Low", value: "Low" }
                            ]}
                            className="w-[100px] h-[30px] px-2 text-xs font-bold border border-border rounded-xl bg-card focus:outline-none"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input 
                            type="date"
                            value={inlineTaskDueDate} 
                            onChange={(e) => setInlineTaskDueDate(e.target.value)} 
                            className="px-2 py-1 text-xs text-foreground/80 border border-border rounded-xl bg-card focus:outline-none font-bold" 
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {inlineEditingTaskId === task.id ? (
                            <div className="relative">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="flex items-center gap-2 px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs font-semibold w-full">
                                    {inlineTaskAssignees.length > 0 ? inlineTaskAssignees.join(", ") : "Unassigned"}
                                    <ChevronDown className="w-3 h-3 ml-auto opacity-50" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3" align="start">
                                  <div className="space-y-3">
                                    <div className="relative">
                                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                      <input 
                                        type="text" 
                                        placeholder="Search employees..." 
                                        value={inlineAssigneeSearchQuery}
                                        onChange={(e) => setInlineAssigneeSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 bg-muted/50 border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
                                      />
                                    </div>
                                    <div className="space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                                      {employees.filter(emp => emp.name.toLowerCase().includes(inlineAssigneeSearchQuery.toLowerCase())).map((emp) => {
                                        const isChecked = inlineTaskAssignees.includes(emp.name);
                                        return (
                                          <label key={emp.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer transition-colors">
                                            <input 
                                              type="checkbox" 
                                              checked={isChecked}
                                              onChange={() => {
                                                if (isChecked) {
                                                  setInlineTaskAssignees(inlineTaskAssignees.filter(n => n !== emp.name));
                                                } else {
                                                  setInlineTaskAssignees([...inlineTaskAssignees, emp.name]);
                                                }
                                              }}
                                              className="rounded border-border text-primary focus:ring-primary"
                                            />
                                            <div className="flex items-center gap-2">
                                              <img src={emp.avatar} alt={emp.name} className="w-5 h-5 rounded-full" />
                                              <span className="text-xs font-semibold">{emp.name}</span>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {task.assignees.length > 0 ? (
                                <div className="flex -space-x-2">
                                  {task.assignees.slice(0, 3).map((a, i) => (
                                    <TooltipProvider key={i}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <img src={a.avatar} alt={a.name} className="w-7 h-7 rounded-full border-2 border-card relative hover:z-10 hover:scale-110 transition-transform cursor-pointer" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p className="text-xs font-semibold">{a.name}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ))}
                                  {task.assignees.length > 3 && (
                                    <div className="w-7 h-7 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold relative z-0">
                                      +{task.assignees.length - 3}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground font-medium italic">Unassigned</span>
                              )}
                            </div>
                          )}
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          {task.assignedBy ? (
                             <div className="flex items-center gap-2">
                               <img src={task.assignedBy.avatar} alt={task.assignedBy.name} className="w-6 h-6 rounded-full border border-border" />
                               <span className="text-xs font-medium text-foreground">{task.assignedBy.name}</span>
                             </div>
                          ) : (
                             <span className="text-xs text-muted-foreground">Self</span>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setInlineEditingTaskId(null)} className="px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancel</button>
                            <button onClick={saveInlineEdit} className="px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all">Save</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground text-xs">{task.title}</span>
                            {task.isProjectTask && (
                              <div className="flex items-center gap-1 inline-flex">
                                <span className="text-[9px] font-black bg-primary/10 text-primary border border-primary/25 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                  Project Task
                                </span>
                                <button
                                  onClick={(e) => handleRedirectToProject(e, task.projectId!, task.clientId, task.moduleId)}
                                  className="text-[9px] font-bold bg-muted hover:bg-muted/80 text-muted-foreground border border-border/50 px-2 py-0.5 rounded-lg flex items-center gap-0.5 transition-colors"
                                  title="View project workspace"
                                >
                                  🔗 Go to Project
                                </button>
                              </div>
                            )}
                            {task.isSalesTask && (
                              <div className="flex items-center gap-1 inline-flex">
                                <span className="text-[9px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/25 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                  Sales Task
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); if(setActive) setActive("/work/sales/tasks"); }}
                                  className="text-[9px] font-bold bg-muted hover:bg-muted/80 text-muted-foreground border border-border/50 px-2 py-0.5 rounded-lg flex items-center gap-0.5 transition-colors"
                                  title="View sales tasks"
                                >
                                  🔗 Go to Sales
                                </button>
                              </div>
                            )}
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-[10px] text-muted-foreground truncate max-w-[250px] sm:max-w-md mt-0.5 font-medium">{task.description}</div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs text-xs font-bold leading-normal">{task.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-[10px] font-black text-foreground/80 bg-muted px-2.5 py-1 rounded-xl border border-border/40">{task.status}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider inline-block border", getPriorityColor(task.priority))}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" /> 
                            {format(new Date(task.dueDate), "dd/MM/yyyy")}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs font-bold text-foreground">
                            {task.assignees.map(a => a.name).join(", ") || "Unassigned"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-[10px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Click row to edit</span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                        <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">No tasks found</h3>
                      <p className="text-xs text-muted-foreground mt-1">Try adjusting your search query.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
