import { useState, useEffect, useMemo, useCallback } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  X, Plus, Filter, LayoutGrid, List as ListIcon, MoreHorizontal, Calendar, Clock,
  CheckCircle2, AlertCircle, Hourglass, ArrowRightLeft, RefreshCw, Zap, Trash2,
  Search, ShieldAlert, Check, ChevronDown, UserCheck, Flame, Repeat, Info, History, ExternalLink,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { SearchInput } from "@/components/common/SearchInput";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { cn, formatDate, formatPersonName } from "@/lib/utils";
import { DialogClose, Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { format, isToday, isBefore, isAfter, startOfDay } from "date-fns";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useAuth } from "@/components/auth/AuthContext";
import { api } from "@/lib/api";
import { hasModulePermission, isUserAdmin } from "@/lib/permissions";

type TaskStatus = "Todo" | "In Progress" | "In Review" | "Done";
type Priority = "High" | "Medium" | "Low";
type ScopeFilter = "all" | "my_tasks" | "assigned_by_me" | "transfers";
type TimeframeFilter = "all" | "today" | "overdue" | "client_issue" | "pending" | "upcoming";

interface BackendTask {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  assigned_to: string;
  assigned_by: string;
  created_by?: string;
  created_at?: string;
  recurrence?: string;
  approved_by?: string;
  approved_at?: string;
  review_rejected_reason?: string;
  assigned_to_details?: { employee_name: string };
  assigned_by_details?: { employee_name: string };
  created_by_details?: { employee_name: string };
  approved_by_details?: { employee_name: string };
  transfer_request?: {
    requested_to: string;
    requested_by: string;
    requested_at: string;
    reason?: string;
    status: string;
    requested_to_details?: { employee_name: string };
    requested_by_details?: { employee_name: string };
  };
  transfer_history?: Array<{
    from_employee: string;
    to_employee: string;
    transferred_at: string;
    reason?: string;
    status: string;
    from_employee_details?: { employee_name: string };
    to_employee_details?: { employee_name: string };
  }>;
  activity_history?: Array<{
    action: string;
    performed_by?: string;
    performed_by_name?: string;
    timestamp: string;
    details?: string;
  }>;
  project_details?: any;
  project_id?: string;
  content_item_details?: any;
  content_item_id?: string;
  task_category?: string;
  sub_category?: string;
  creative_details?: any;
  reason_for_pending?: string;
  module_id?: string;
  phase?: string;
  department?: string;
  is_deleted?: boolean;
}

interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  rawDueDate?: string | undefined;
  assignedToId: string;
  assignedToName: string;
  assignedToAvatar: string;
  assignedById: string;
  assignedByName: string;
  assignedByAvatar: string;
  recurrence: string;
  approvedBy?: string | undefined;
  approvedByName?: string | undefined;
  approvedAt?: string | undefined;
  reviewRejectedReason?: string | undefined;
  transferRequest?: BackendTask["transfer_request"] | undefined;
  transferHistory?: BackendTask["transfer_history"] | undefined;
  activityHistory?: BackendTask["activity_history"] | undefined;
  projectDetails?: any;
  isProjectTask?: boolean | undefined;
  // K15: category + auto/manual (auto = content-synced, delete nai thay)
  taskCategory: string;
  subCategory?: string | undefined;
  creativeDetails?: any;
  reasonForPending?: string | undefined;
  moduleId?: string | undefined;
  phase?: string | undefined;
  contentItemId: string;
  isAuto: boolean;
  isTransferred: boolean;
  department?: string;
  createdAt?: string | undefined;
  rawBackend: BackendTask;
}

interface TaskFormErrors {
  title?: string | undefined;
  dueDate?: string | undefined;
  assignee?: string | undefined;
}

const formatDateDMY = (dateVal?: string | Date | null): string => {
  if (!dateVal) return "";
  try {
    if (typeof dateVal === "string") {
      const trimmed = dateVal.trim();
      if (!trimmed) return "";
      if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return formatDate(`${trimmed.slice(6)}-${trimmed.slice(3, 5)}-${trimmed.slice(0, 2)}`);
      const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (match && match[1] && match[2] && match[3]) {
        const year = match[1];
        const month = match[2].padStart(2, "0");
        const day = match[3].padStart(2, "0");
        return formatDate(`${year}-${month}-${day}`);
      }
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return formatDate(d);
    }
    return String(dateVal);
  } catch {
    return String(dateVal);
  }
};

export function Tasks({ setActive, isNew }: { setActive?: (route: string) => void; isNew?: boolean }) {
  const { user } = useAuth();
  const anyUser = user as any;
  const currentUserId = String(anyUser?._id || anyUser?.id || "");
  const userRole = String(anyUser?.role || anyUser?.work_details?.system_role || "Employee").toLowerCase();
  const userDepartment = String(anyUser?.work_details?.department || anyUser?.department || "").trim();
  // Role-only: decides who gets the My Tasks / All Tasks views
  const isAdminOrHRRole = isUserAdmin(user) || userRole === "admin" || userRole === "superadmin" || userRole === "hr" || userRole === "subadmin" || (userDepartment && userDepartment.toLowerCase() === "hr");
  // Role OR "/tasks update" permission: still drives edit / delete powers
  const isAdminOrHR = isAdminOrHRRole || hasModulePermission(user, "/tasks", "update");
  const userDesignation = String(anyUser?.work_details?.designation || anyUser?.designation || "").trim().toLowerCase();

  // Role checks requested by user:
  // 1. Team Leader (only if not Admin/HR):
  const isTeamLeader = !isAdminOrHRRole && (userDesignation.includes("team leader") || userRole.includes("team leader"));
  // 2. Head / Admin / HR:
  const isHead = isAdminOrHRRole || (!isTeamLeader && (userDesignation.includes("head") || userRole.includes("head")));
  // 3. Neither Head nor Team Leader (Other employees):
  const isOther = !isTeamLeader && !isHead;

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    todo: 0,
    inprogress: 0,
    inreview: 0,
    completed: 0,
    today: 0,
    overdue: 0,
    upcoming: 0,
    client_issue: 0,
    pending: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; avatar: string; role?: string; department?: string }>>([]);

  // Server-side pagination & filter state (25 items per page by default)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalServerTasks, setTotalServerTasks] = useState(0);
  const [columnVisibleCounts, setColumnVisibleCounts] = useState<Record<string, number>>({});

  // Employees filtered for Team Leader (only employees in Team Leader's department):
  const teamLeaderEmployees = useMemo(() => {
    if (!isTeamLeader || !userDepartment) return employees;
    return employees.filter(
      (e) => (e.department || "").trim().toLowerCase() === userDepartment.trim().toLowerCase()
    );
  }, [isTeamLeader, userDepartment, employees]);

  const [view, setView] = useState<"board" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  // Debounced search query to prevent frequent API queries while typing
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [statusFilter, setStatusFilter] = useState<"All" | TaskStatus>("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | Priority>("All");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>("today");
  // K15: category filter (transcript — category field)
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("All");
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [allProjects, setAllProjects] = useState<{ label: string; value: string; depts: string[] }[]>([]);

  const CREATIVE_SUBCATEGORIES = useMemo(() => [
    "Script",
    "Shoot",
    "Caption",
    "Thumbnail",
    "Editing",
    "Approval",
    "Posting"
  ], []);

  // Strict My Tasks vs All Tasks Access: Regular staff (Senior, Junior, Intern) are locked to My Tasks
  // Only Admin, HR, Head and Team Leader get My Tasks / All Tasks; everyone else sees just their own tasks
  const canViewAllTasks = isAdminOrHRRole || isHead || isTeamLeader;
  const [savedViewMode, setSavedViewMode] = usePersistentState<"my_tasks" | "all_tasks">("tasks.view", canViewAllTasks ? "all_tasks" : "my_tasks");
  const mainViewMode = canViewAllTasks ? savedViewMode : "my_tasks";
  const setMainViewMode = (mode: "my_tasks" | "all_tasks") => {
    if (canViewAllTasks) {
      setSavedViewMode(mode);
    }
  };

  const [departmentFilter, setDepartmentFilter] = useState<string>("All");
  const [assignedToFilter, setAssignedToFilter] = useState<string>("All");
  const [assignedByFilter, setAssignedByFilter] = useState<string>("All");

  const isCreativeScope = useMemo(() => {
    const dLower = (userDepartment || "").toLowerCase();
    const desigLower = (userDesignation || "").toLowerCase();
    return dLower.includes("creative") || desigLower.includes("creative") || categoryFilter === "Creative" || tasks.some(t => t.taskCategory === "Creative" || t.subCategory);
  }, [userDepartment, userDesignation, categoryFilter, tasks]);

  // Stage / Project filters show only when the Creative department (or category) is selected
  const showCreativeFilters = departmentFilter.toLowerCase().includes("creative") || categoryFilter === "Creative";

  const STAGE_OPTIONS = useMemo(() => {
    const base = [
      "Script", "Shoot", "Brand Person", "Caption", "Thumbnail", "Editing",
      "Post/Graphics", "Approval", "Posting", "Follow-up", "WhatsApp Group",
    ];
    const seen = new Set(base.map((x) => x.toLowerCase()));
    const extra: string[] = [];
    tasks.forEach((t) => {
      const sc = (t.subCategory || "").trim();
      if (sc && !seen.has(sc.toLowerCase())) {
        seen.add(sc.toLowerCase());
        extra.push(sc);
      }
    });
    return [{ label: "All Stages", value: "All" }, ...[...base, ...extra].map((x) => ({ label: x, value: x }))];
  }, [tasks]);

  // Project filter shows whenever a department is picked (or Creative category); it lists that department's projects
  const showProjectFilter = showCreativeFilters || departmentFilter !== "All";

  const projectOptions = useMemo(() => {
    const dept = departmentFilter !== "All" ? departmentFilter.toLowerCase() : categoryFilter === "Creative" ? "creative" : "";
    const list = dept ? allProjects.filter((p) => p.depts.some((d) => d.includes(dept) || dept.includes(d))) : allProjects;
    return list.map(({ label, value }) => ({ label, value }));
  }, [allProjects, departmentFilter, categoryFilter]);

  // Stage / Project selections don't carry over when the department changes
  useEffect(() => {
    setProjectFilter("All");
    if (!showCreativeFilters) setSubCategoryFilter("All");
  }, [departmentFilter, showCreativeFilters]);

  useEffect(() => {
    if (!showProjectFilter || allProjects.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data?: any[] } | any[]>("/projects", { showLoader: false, showErrorToast: false });
        const raw: any[] = Array.isArray(res) ? res : (res?.data || []);
        const mapped = raw.map((p: any) => {
          const g = p.general || p.general_details || {};
          const name = String(g.project_name || p.project_name || p.name || p.title || "").trim() || "Untitled Project";
          const client = String(p.client?.company_name || p.client?.contact_person_name || "").trim();
          const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
          return {
            label: client && !norm(name).includes(norm(client)) ? `${client} • ${name}` : name,
            value: String(p._id || p.id),
            depts: String(g.category || p.category || "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean),
          };
        });
        mapped.sort((a, b) => a.label.localeCompare(b.label));
        if (!cancelled) setAllProjects(mapped);
      } catch {
        // project filter is optional
      }
    })();
    return () => { cancelled = true; };
  }, [showProjectFilter, allProjects.length]);

  // Reset page to 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearch,
    mainViewMode,
    scopeFilter,
    departmentFilter,
    assignedToFilter,
    assignedByFilter,
    statusFilter,
    priorityFilter,
    timeframeFilter,
    categoryFilter,
    subCategoryFilter,
    projectFilter,
  ]);

  const taskCategories = useMemo(() => {
    const defaultCategories = ["All", "General", "Development", "Design", "Marketing", "SMM", "Content Calendar", "Client Issue", "Pending", "Sales", "Operations"];
    const s = new Set<string>(defaultCategories);
    tasks.forEach(t => { if (t.taskCategory) s.add(t.taskCategory); });
    return Array.from(s);
  }, [tasks]);

  // Create/Edit modal state
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(isNew || false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskFormTitle, setTaskFormTitle] = useState("");
  const [taskFormDesc, setTaskFormDesc] = useState("");
  const [taskFormCategory, setTaskFormCategory] = useState("General");
  const [taskFormSubCategory, setTaskFormSubCategory] = useState("Script");
  const [taskFormCreativeRef, setTaskFormCreativeRef] = useState("");
  const [taskFormCreativeDrive, setTaskFormCreativeDrive] = useState("");
  const [taskFormCreativeType, setTaskFormCreativeType] = useState("Reel");
  const [taskFormCreativeScript, setTaskFormCreativeScript] = useState("");
  const [taskFormPriority, setTaskFormPriority] = useState<Priority>("Medium");
  const [taskFormDueDate, setTaskFormDueDate] = useState("");
  const [taskFormAssignee, setTaskFormAssignee] = useState("");
  const [taskFormRecurrence, setTaskFormRecurrence] = useState("none");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<TaskFormErrors>({});

  // Delete modal state
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  useEffect(() => {
    if (isNew) {
      setEditingTaskId(null);
      setTaskFormTitle("");
      setTaskFormDesc("");
      setTaskFormCategory("General");
      setTaskFormSubCategory("Script");
      setTaskFormCreativeRef("");
      setTaskFormCreativeDrive("");
      setTaskFormCreativeType("Reel");
      setTaskFormCreativeScript("");
      setTaskFormPriority("Medium");
      setTaskFormDueDate(format(new Date(), "yyyy-MM-dd"));
      setTaskFormAssignee(currentUserId || employees[0]?.id || "");
      setTaskFormRecurrence("none");
      setFormErrors({});
      setIsNewTaskOpen(true);
    }
  }, [isNew, employees, currentUserId]);

  useEffect(() => {
    const handleOpenNewTask = () => {
      setEditingTaskId(null);
      setTaskFormTitle("");
      setTaskFormDesc("");
      setTaskFormCategory("General");
      setTaskFormSubCategory("Script");
      setTaskFormCreativeRef("");
      setTaskFormCreativeDrive("");
      setTaskFormCreativeType("Reel");
      setTaskFormCreativeScript("");
      setTaskFormPriority("Medium");
      setTaskFormDueDate(format(new Date(), "yyyy-MM-dd"));
      setTaskFormAssignee(currentUserId || employees[0]?.id || "");
      setTaskFormRecurrence("none");
      setFormErrors({});
      setIsNewTaskOpen(true);
    };
    window.addEventListener("hrms:open-new-task", handleOpenNewTask);
    return () => window.removeEventListener("hrms:open-new-task", handleOpenNewTask);
  }, [employees, currentUserId]);

  // Quick Assign state
  const [showQuickAssign, setShowQuickAssign] = useState(false);
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);
  const [quickTasks, setQuickTasks] = useState<Array<{ title: string; assignee: string; dueDate: string }>>([
    { title: "", assignee: "", dueDate: "" },
  ]);
  // F9: brand default — title auto "Brand - work" (transcript: HK jevu)
  const [quickBrand, setQuickBrand] = useState("");
  const [brandClients, setBrandClients] = useState<Array<{ id: string; name: string }>>([]);
  const fetchBrandClients = async () => {
    try {
      const res = await api.get<any>("/clients", { showLoader: false, showErrorToast: false });
      const list = Array.isArray(res) ? res : (res?.data || []);
      setBrandClients(list.map((c: any) => ({ id: String(c._id || c.id), name: c.company_name || c.name || "Client" })));
    } catch {
      // silent — brand optional
    }
  };

  // Transfer Modal State
  const [transferringTask, setTransferringTask] = useState<TaskItem | null>(null);
  const [transferTargetEmp, setTransferTargetEmp] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [isTransferSubmitting, setIsTransferSubmitting] = useState(false);

  // Reject Review Modal State
  const [rejectingTask, setRejectingTask] = useState<TaskItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("Needs revision");
  const [isRejectSubmitting, setIsRejectSubmitting] = useState(false);

  // View Detail Modal State
  const [inspectingTask, setInspectingTask] = useState<TaskItem | null>(null);

  // Task History Modal State
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<TaskItem | null>(null);

  // Fetch Employees (include admins and all staff)
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get<{ data?: any[] } | any[]>("/employees", { showLoader: false });
      const rawList = Array.isArray(res) ? res : res?.data || [];
      if (rawList.length > 0) {
        const mapped = rawList.map((emp: any) => {
          const personal = emp.personal_info || {};
          const name = personal.first_name ? formatPersonName(personal) : emp.name || "Employee";
          return {
            id: String(emp._id || emp.id),
            name,
            avatar: emp.profile_picture || emp.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
            role: emp.work_details?.designation || emp.role || "Employee",
            department: emp.work_details?.department || emp.department || "General",
          };
        });
        setEmployees(mapped);
        return;
      }
    } catch (e) {
      console.warn("Failed to fetch employees from API, falling back to local storage:", e);
    }

    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hrms_employees");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const mapped = parsed.map((e: any) => ({
            id: String(e.id || e._id),
            name: e.name || `${e.firstName || ""} ${e.lastName || ""}`.trim() || "Employee",
            avatar: e.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(e.name || "User")}`,
            role: e.designation || e.role || "Employee",
            department: e.department || e.work_details?.department || "General",
          }));
          setEmployees(mapped);
        } catch { }
      }
    }
  }, []);

  const currentUserName = useMemo(() => {
    const personal = anyUser?.personal_info || {};
    const fullName = formatPersonName(personal);
    return fullName || anyUser?.name || anyUser?.username || "Management";
  }, [anyUser]);


  // Fetch Tasks & Stats dynamically with target_date and server pagination (25 per page)
  const fetchTasksData = useCallback(async () => {
    setIsLoading(true);
    try {
      const todayDateStr = format(new Date(), "yyyy-MM-dd");
      const params = new URLSearchParams();
      params.append("page", String(currentPage));
      params.append("limit", String(pageSize));
      params.append("target_date", todayDateStr);

      if (timeframeFilter && timeframeFilter !== "all") {
        params.append("timeline_filter", timeframeFilter);
      }

      if (statusFilter && statusFilter !== "All") {
        params.append("status", statusFilter);
      }

      if (priorityFilter && priorityFilter !== "All") {
        params.append("priority", priorityFilter.toLowerCase());
      }

      if (categoryFilter && categoryFilter !== "All") {
        params.append("task_category", categoryFilter);
      }

      if (departmentFilter && departmentFilter !== "All") {
        params.append("department", departmentFilter);
      }

      if (assignedToFilter && assignedToFilter !== "All") {
        params.append("assigned_to", assignedToFilter);
      }

      if (assignedByFilter && assignedByFilter !== "All") {
        params.append("assigned_by", assignedByFilter);
      }

      if (subCategoryFilter && subCategoryFilter !== "All") {
        params.append("sub_category", subCategoryFilter);
      }

      if (projectFilter && projectFilter !== "All") {
        params.append("project_id", projectFilter);
      }

      if (debouncedSearch.trim()) {
        params.append("search", debouncedSearch.trim());
      }

      if (mainViewMode === "my_tasks" || scopeFilter === "my_tasks") {
        params.append("view", "me");
      } else if (scopeFilter === "assigned_by_me") {
        params.append("assigned_by", currentUserId || "");
      } else {
        params.append("view", "all");
      }

      const queryString = params.toString();

      // Dynamic Filter-Wise Stats Calculation
      const statsParams = new URLSearchParams();
      statsParams.append("target_date", todayDateStr);
      if (mainViewMode === "my_tasks" || scopeFilter === "my_tasks") {
        statsParams.append("view", "me");
      } else if (scopeFilter === "assigned_by_me") {
        statsParams.append("assigned_by", currentUserId || "");
      } else {
        statsParams.append("view", "all");
      }
      if (departmentFilter && departmentFilter !== "All") {
        statsParams.append("department", departmentFilter);
      }
      if (assignedToFilter && assignedToFilter !== "All") {
        statsParams.append("assigned_to", assignedToFilter);
      }
      if (assignedByFilter && assignedByFilter !== "All") {
        statsParams.append("assigned_by", assignedByFilter);
      }
      if (categoryFilter && categoryFilter !== "All") {
        statsParams.append("task_category", categoryFilter);
      }
      if (priorityFilter && priorityFilter !== "All") {
        statsParams.append("priority", priorityFilter.toLowerCase());
      }
      if (debouncedSearch.trim()) {
        statsParams.append("search", debouncedSearch.trim());
      }

      const [tasksRes, statsRes] = await Promise.allSettled([
        api.get<{ data?: BackendTask[]; total?: number }>(`/tasks?${queryString}`, { showLoader: false }),
        api.get<any>(`/tasks/stats?${statsParams.toString()}`, { showLoader: false }),
      ]);

      if (tasksRes.status === "fulfilled" && tasksRes.value) {
        const rawTasks: BackendTask[] = tasksRes.value.data || (Array.isArray(tasksRes.value) ? tasksRes.value : []);
        setTotalServerTasks(tasksRes.value.total ?? rawTasks.length);
        const mapped: TaskItem[] = rawTasks.map((t) => {
          let statusMapped: TaskStatus = "Todo";
          const rawStatus = (t.status || "").toLowerCase().replace(/[\s_]/g, "");
          if (rawStatus === "inprogress") statusMapped = "In Progress";
          else if (rawStatus === "inreview" || rawStatus === "review") statusMapped = "In Review";
          else if (rawStatus === "completed" || rawStatus === "done") statusMapped = "Done";

          let priorityMapped: Priority = "Medium";
          const rawPri = (t.priority || "").toLowerCase();
          if (rawPri === "high" || rawPri === "urgent") priorityMapped = "High";
          else if (rawPri === "low") priorityMapped = "Low";

          let formattedDate = "";
          if (t.due_date) {
            try {
              formattedDate = format(new Date(t.due_date), "yyyy-MM-dd");
            } catch {
              formattedDate = String(t.due_date);
            }
          }

          const assignedToName = t.assigned_to_details?.employee_name || "Unassigned";
          const assignedByName = t.assigned_by_details?.employee_name || "Management";

          return {
            id: String(t._id || t.id),
            title: t.title || "Untitled Task",
            description: t.description || "",
            status: statusMapped,
            priority: priorityMapped,
            dueDate: formattedDate,
            rawDueDate: t.due_date,
            assignedToId: String(t.assigned_to || ""),
            assignedToName,
            assignedToAvatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(assignedToName)}`,
            assignedById: String(t.assigned_by || ""),
            assignedByName,
            assignedByAvatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(assignedByName)}`,
            recurrence: t.recurrence || "none",
            approvedBy: t.approved_by,
            approvedByName: t.approved_by_details?.employee_name,
            approvedAt: t.approved_at,
            reviewRejectedReason: t.review_rejected_reason,
            transferRequest: t.transfer_request,
            transferHistory: t.transfer_history || [],
            activityHistory: t.activity_history || [],
            projectDetails: t.project_details,
            isProjectTask: !!t.project_details || t.task_category === "SMM",
            // K15
            taskCategory: t.task_category || "General",
            subCategory: t.sub_category,
            creativeDetails: t.creative_details,
            reasonForPending: t.reason_for_pending,
            moduleId: t.module_id,
            phase: t.phase,
            contentItemId: String(t.content_item_id || t.content_item_details?._id || t.content_item_details?.id || ""),
            isAuto: Boolean(t.content_item_id || t.content_item_details?._id) || t.task_category === "Content Calendar" || t.task_category === "SMM" || Boolean((t as any).is_auto),
            isTransferred: Boolean(t.transfer_history && t.transfer_history.length > 0) || Boolean(t.transfer_request?.status === "transferred" || t.transfer_request?.status === "accepted"),
            department: t.department || "",
            createdAt: t.created_at || (t as any).createdAt || "",
            rawBackend: t,
          };
        });
        setTasks(mapped);
      }

      if (statsRes.status === "fulfilled" && statsRes.value) {
        setStats({
          total: statsRes.value.total || 0,
          todo: statsRes.value.todo || 0,
          inprogress: statsRes.value.inprogress || 0,
          inreview: statsRes.value.inreview || 0,
          completed: statsRes.value.completed || 0,
          today: statsRes.value.today || 0,
          overdue: statsRes.value.overdue || 0,
          upcoming: statsRes.value.upcoming || 0,
          client_issue: statsRes.value.client_issue || 0,
          pending: statsRes.value.pending || 0,
        });
      }
    } catch (e) {
      console.error("Failed to load tasks data:", e);
      toast.error("Failed to load tasks from server.");
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    timeframeFilter,
    statusFilter,
    priorityFilter,
    categoryFilter,
    departmentFilter,
    assignedToFilter,
    assignedByFilter,
    debouncedSearch,
    mainViewMode,
    scopeFilter,
    currentUserId,
    subCategoryFilter,
    projectFilter,
  ]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchTasksData();
  }, [fetchTasksData]);

  // Employee Map by ID
  const empMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar: string; role?: string; department?: string }>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  // All Unique Departments
  const departmentList = useMemo(() => {
    const deptSet = new Set<string>();
    employees.forEach((e) => {
      if (e.department && e.department.trim()) {
        deptSet.add(e.department.trim());
      }
    });
    tasks.forEach((t) => {
      if (t.department && t.department.trim()) deptSet.add(t.department.trim());
      if (t.rawBackend?.department && t.rawBackend.department.trim()) deptSet.add(t.rawBackend.department.trim());
    });
    ["Creative", "Development", "SMM", "Video Editing", "Sales", "HR"].forEach((d) => deptSet.add(d));
    return ["All", ...Array.from(deptSet).sort()];
  }, [employees, tasks]);

  // Pending transfers incoming count
  const pendingIncomingTransfersCount = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.transferRequest &&
        t.transferRequest.status === "pending" &&
        String(t.transferRequest.requested_to) === currentUserId
    ).length;
  }, [tasks, currentUserId]);

  // Dynamically compute stats directly from backend
  const displayStats = stats;
  const clientIssuesCount = stats.client_issue || 0;

  // Tasks are dynamically queried, filtered, and paginated (25 per page) from the backend directly
  const filteredTasks = useMemo(() => {
    // Stage filter is applied on the server (matches sub_category and Content-Calendar creative_role)
    return tasks;
  }, [tasks]);
  const { items: sortedTasks, requestSort, sortConfig } = useSortableData(filteredTasks);

  const totalPages = Math.max(1, Math.ceil(totalServerTasks / pageSize));
  const paginatedTasks = sortedTasks;

  // Quick Row management
  const addQuickRow = () => {
    setQuickTasks((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, { title: "", assignee: last?.assignee ?? "", dueDate: last?.dueDate ?? "" }];
    });
  };

  const updateQuickField = (idx: number, field: "title" | "assignee" | "dueDate", value: string) => {
    setQuickTasks((prev) => {
      const updated = prev.map((t) => ({ ...t }));
      if (field === "title") {
        updated[idx]!.title = value;
      } else {
        for (let i = idx; i < updated.length; i++) {
          updated[i]![field] = value;
        }
      }
      return updated;
    });
  };

  const removeQuickRow = (idx: number) => {
    setQuickTasks((prev) => (prev.length <= 1 ? [{ title: "", assignee: "", dueDate: "" }] : prev.filter((_, i) => i !== idx)));
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

  // Bulk Quick Assign Action
  const handleBulkQuickAssign = async () => {
    const nonEmptyRows = quickTasks.filter((t) => t.title.trim() || t.assignee || t.dueDate);
    if (nonEmptyRows.length === 0) {
      toast.error("Please add at least one task.");
      return;
    }

    for (const [i, row] of nonEmptyRows.entries()) {
      if (!row) continue;
      if (!row.title.trim()) {
        toast.error(`Row ${i + 1}: Task title is required.`);
        return;
      }
      if (!row.assignee) {
        toast.error(`Row ${i + 1}: Please select an assignee for "${row.title.trim()}".`);
        return;
      }
      if (!row.dueDate) {
        toast.error(`Row ${i + 1}: Please select a due date for "${row.title.trim()}".`);
        return;
      }
    }

    setIsQuickSubmitting(true);
    try {
      const brandPrefix = quickBrand.trim();
      const payload = nonEmptyRows.map((t) => {
        let assigneeId = t.assignee;
        const matchedEmp = employees.find((e) => e.name === t.assignee || e.id === t.assignee);
        if (matchedEmp) assigneeId = matchedEmp.id;

        // F9: Brand - work (already prefixed hoy to double nai)
        let title = t.title.trim();
        if (brandPrefix && !title.toLowerCase().startsWith(brandPrefix.toLowerCase() + " -") && !title.toLowerCase().startsWith(brandPrefix.toLowerCase() + " ")) {
          title = `${brandPrefix} - ${title}`;
        }
        return {
          title,
          due_date: t.dueDate,
          assigned_to: [assigneeId],
        };
      });

      await api.post("/tasks/quick-assign", payload);
      toast.success(`${nonEmptyRows.length} task(s) created and assigned successfully!`);
      setShowQuickAssign(false);
      setQuickTasks([{ title: "", assignee: "", dueDate: "" }]);
      fetchTasksData();
    } catch (e: any) {
      console.error("Bulk quick assign failed:", e);
      toast.error(e?.message || "Failed to create quick assign tasks.");
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  // Create or Update Single Task
  const handleCreateOrUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { title?: string; dueDate?: string; assignee?: string } = {};
    if (!taskFormTitle.trim()) {
      errors.title = "Task title is required.";
    }
    if (!taskFormDueDate) {
      errors.dueDate = "Please select a due date.";
    }
    if (!taskFormAssignee) {
      errors.assignee = "Please select an assignee.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Please fill in all required fields.");
      return;
    }
    setFormErrors({});

    setIsSubmitting(true);
    try {
      const payload: any = {
        title: taskFormTitle.trim(),
        description: taskFormDesc.trim() || undefined,
        priority: taskFormPriority.toLowerCase(),
        due_date: taskFormDueDate,
        assigned_to: taskFormAssignee,
        recurrence: taskFormRecurrence,
        task_category: taskFormCategory,
      };

      if (taskFormCategory === "Creative") {
        payload.sub_category = taskFormSubCategory;
        payload.creative_details = {
          reference_link: taskFormCreativeRef.trim() || undefined,
          drive_link: taskFormCreativeDrive.trim() || undefined,
          content_type: taskFormCreativeType,
          script: taskFormCreativeScript.trim() || undefined,
        };
      }

      const isSelf = taskFormAssignee === currentUserId;

      if (editingTaskId) {
        const existingTask = tasks.find((t) => t.id === editingTaskId);
        if (existingTask?.isAuto) {
          toast.error("Auto-assigned tasks linked to Content Calendar cannot be edited directly from Tasks. Redirecting to Content Calendar...");
          setIsSubmitting(false);
          openEditModal(existingTask);
          return;
        }
        await api.put(`/tasks/${editingTaskId}`, payload);
        toast.success("Task updated successfully!");
        // Punch-in widget shows the current task title; let it refetch
        window.dispatchEvent(new Event("attendance_updated"));
      } else {
        await api.post("/tasks", payload);
        toast.success(isSelf ? "Task added to your personal list!" : "New task created successfully!");
        if (isSelf) {
          setMainViewMode("my_tasks");
          setScopeFilter("my_tasks");
        } else {
          setMainViewMode("all_tasks");
          setScopeFilter("all");
        }
        setTimeframeFilter("all");
        setStatusFilter("All");
        setSearchQuery("");
        setCurrentPage(1);
      }

      setIsNewTaskOpen(false);
      setEditingTaskId(null);
      setTaskFormTitle("");
      setTaskFormDesc("");
      setTaskFormPriority("Medium");
      setTaskFormDueDate("");
      setTaskFormAssignee("");
      setTaskFormRecurrence("none");
      setFormErrors({});
      fetchTasksData();
    } catch (e: any) {
      console.error("Task save failed:", e);
      toast.error(e?.message || "Failed to save task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Status directly (Kanban drag or dropdown)
  const updateTaskStatus = async (taskId: string, nextStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    let backendStatus = "todo";
    if (nextStatus === "In Progress") backendStatus = "inprogress";
    else if (nextStatus === "In Review") backendStatus = "inreview";
    else if (nextStatus === "Done") backendStatus = "completed";

    // In-Review flow restriction:
    // If an assignee (non-admin) tries to set to "Done" directly, suggest In-Review
    const isAssigneeOnly = task.assignedToId === currentUserId && task.assignedById !== currentUserId && !isAdminOrHR;
    if (nextStatus === "Done" && isAssigneeOnly && task.status !== "In Review") {
      backendStatus = "inreview";
      toast.info("Task submitted for review! The assigner will approve it once verified.");
    }

    try {
      await api.put(`/tasks/${taskId}`, { status: backendStatus });
      toast.success(`Task status updated to ${nextStatus}!`);
      fetchTasksData();
      // Starting a task also switches the punch-in widget's current task
      if (backendStatus === "inprogress") window.dispatchEvent(new Event("attendance_updated"));
    } catch (e: any) {
      console.error("Failed to update status:", e);
      toast.error(e?.message || "Failed to update task status.");
    }
  };

  // In-Review Approval Action
  const handleApproveTask = async (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await api.post(`/tasks/${taskId}/approve`);
      toast.success("Task approved and marked as Completed! 🎉");
      fetchTasksData();
    } catch (e: any) {
      console.error("Approval error:", e);
      toast.error(e?.message || "Failed to approve task.");
    }
  };

  // In-Review Rejection Action
  const handleRejectReview = async () => {
    if (!rejectingTask) return;
    setIsRejectSubmitting(true);
    try {
      await api.post(`/tasks/${rejectingTask.id}/reject-review`, { reason: rejectionReason.trim() });
      toast.success("Task returned to 'In Progress' with your feedback.");
      setRejectingTask(null);
      setRejectionReason("Needs revision");
      fetchTasksData();
    } catch (e: any) {
      console.error("Reject review error:", e);
      toast.error(e?.message || "Failed to reject review.");
    } finally {
      setIsRejectSubmitting(false);
    }
  };

  // Task Transfer Request
  const handleRequestTransfer = async () => {
    if (!transferringTask || !transferTargetEmp) {
      toast.error("Please select an employee to transfer this task to.");
      return;
    }
    setIsTransferSubmitting(true);
    try {
      await api.post(`/tasks/${transferringTask.id}/transfer/request`, {
        requested_to: transferTargetEmp,
        reason: transferReason.trim() || undefined,
      });
      toast.success("Task transfer requested! Awaiting colleague's acceptance.");
      setTransferringTask(null);
      setTransferTargetEmp("");
      setTransferReason("");
      fetchTasksData();
    } catch (e: any) {
      console.error("Transfer request error:", e);
      toast.error(e?.message || "Failed to request transfer.");
    } finally {
      setIsTransferSubmitting(false);
    }
  };

  // Accept Transfer
  const handleAcceptTransfer = async (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await api.post(`/tasks/${taskId}/transfer/accept`);
      toast.success("Transfer accepted! Task is now assigned to you.");
      fetchTasksData();
    } catch (e: any) {
      console.error("Accept transfer error:", e);
      toast.error(e?.message || "Failed to accept transfer.");
    }
  };

  // Reject Transfer
  const handleRejectTransfer = async (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await api.post(`/tasks/${taskId}/transfer/reject`);
      toast.info("Transfer request declined.");
      fetchTasksData();
    } catch (e: any) {
      console.error("Reject transfer error:", e);
      toast.error(e?.message || "Failed to decline transfer.");
    }
  };

  // Delete Task Trigger (Task 8: block delete for auto/transferred tasks unless Admin/HR)
  const promptDeleteTask = (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if ((task.isAuto || task.isTransferred) && !isAdminOrHR) {
      toast.error("Auto-assigned or transferred tasks cannot be deleted.");
      return;
    }
    setTaskToDelete(task);
  };

  // Confirmed Delete execution (Design-wise Dialog confirmation)
  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeletingTask(true);
    try {
      await api.delete(`/tasks/${taskToDelete.id}`);
      toast.success(`Task "${taskToDelete.title}" deleted successfully.`);
      setTaskToDelete(null);
      fetchTasksData();
    } catch (e: any) {
      console.error("Delete task error:", e);
      toast.error(e?.message || "Failed to delete task.");
    } finally {
      setIsDeletingTask(false);
    }
  };

  // Open CC Handler (Task 9)
  const handleOpenCC = (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const projId =
      task.rawBackend?.project_id ||
      (typeof task.rawBackend?.project_details === "object"
        ? task.rawBackend.project_details?._id || task.rawBackend.project_details?.id
        : null) ||
      (typeof task.projectDetails === "object"
        ? task.projectDetails?.id || task.projectDetails?._id
        : task.projectDetails);
    if (projId) {
      localStorage.setItem("hrms_selected_project_id", String(projId));
    }
    const cId =
      task.contentItemId ||
      task.rawBackend?.content_item_id ||
      task.rawBackend?.content_item_details?._id ||
      task.rawBackend?.content_item_details?.id;
    if (cId) {
      localStorage.setItem("hrms_cc_highlight_id", String(cId));
    }
    if (setActive) {
      setActive("/work/projects");
    } else {
      window.dispatchEvent(new CustomEvent("navigate_tab", { detail: "/work/projects" }));
    }
  };

  // Open Edit Modal (Task 8: block editing for auto/transferred tasks unless Admin/HR)
  const openEditModal = (task: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (task.isAuto) {
      toast.info("This task is linked to Content Calendar. Opening CC...");
      handleOpenCC(task, e);
      return;
    }
    if (task.isTransferred && !isAdminOrHR) {
      toast.error("Transferred tasks cannot be edited directly.");
      return;
    }
    setEditingTaskId(task.id);
    setTaskFormTitle(task.title);
    setTaskFormDesc(task.description);
    setTaskFormCategory(task.taskCategory || "General");
    setTaskFormSubCategory(task.subCategory || "Script");
    setTaskFormCreativeRef(task.creativeDetails?.reference_link || "");
    setTaskFormCreativeDrive(task.creativeDetails?.drive_link || "");
    setTaskFormCreativeType(task.creativeDetails?.content_type || "Reel");
    setTaskFormCreativeScript(task.creativeDetails?.script || "");
    setTaskFormPriority(task.priority);
    setTaskFormDueDate(task.dueDate);
    setTaskFormAssignee(task.assignedToId);
    setTaskFormRecurrence(task.recurrence || "none");
    setFormErrors({});
    setIsNewTaskOpen(true);
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case "High":
        return "bg-rose-500/10 text-rose-600 border-rose-500/20";
      case "Medium":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Low":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    }
  };

  const columns: { title: string; status: TaskStatus; color: string }[] = [
    { title: "To Do", status: "Todo", color: "border-blue-500/30" },
    { title: "In Progress", status: "In Progress", color: "border-amber-500/30" },
    { title: "In Review", status: "In Review", color: "border-purple-500/30" },
    { title: "Completed", status: "Done", color: "border-emerald-500/30" },
  ];

  return (
    <div className="relative space-y-5 min-h-[calc(100vh-4rem)] flex flex-col pb-12 animate-in fade-in duration-300">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Task Management</h1>
            <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Redis Live
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Unified all-in-one task hub with in-review approvals, transfers, and real-time synchronization
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <SearchInput
            placeholder="Search tasks, assignees..."
            value={searchQuery}
            onChange={setSearchQuery}
            containerClassName="w-full sm:w-60 md:w-64 shrink-0"
          />

          {/* Quick Assign Button */}
          <Dialog
            open={showQuickAssign}
            onOpenChange={(open) => {
              setShowQuickAssign(open);
              if (open) fetchBrandClients();
              if (!open) {
                setQuickTasks([{ title: "", assignee: "", dueDate: "" }]);
                setQuickBrand("");
              }
            }}
          >
            <DialogTrigger asChild>
              <button className="h-[38px] px-3.5 bg-muted/60 border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-sm shrink-0">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Quick Assign</span>
              </button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-16px)] sm:w-full max-w-[820px] p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card flex flex-col max-h-[90dvh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/30 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-black tracking-tight">Quick Bulk Task Assign</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Rapidly assign action items to multiple team members. Press Enter in the title to add another row.
                  </p>
                </div>
                <DialogClose asChild>
                  <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </DialogClose>
              </div>

              <div className="p-6 space-y-3 overflow-y-auto max-h-[55vh]">
                {/* F9: brand default — badha titles "Brand - work" thashe */}
                <div className="flex items-center gap-3 pb-2 border-b border-border/40">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider whitespace-nowrap">Brand:</span>
                  <SearchableSelect
                    value={quickBrand}
                    onChange={(val) => setQuickBrand(val === "__none__" ? "" : val)}
                    options={[
                      { label: "No brand", value: "__none__" },
                      ...brandClients.map(c => ({ label: c.name, value: c.name })),
                    ]}
                    placeholder="Select brand (optional)"
                    className="flex-1 h-[36px] text-xs font-semibold"
                  />
                  {quickBrand && (
                    <span className="text-[10px] font-bold text-primary whitespace-nowrap">→ "{quickBrand} - ..."</span>
                  )}
                </div>
                <div className="grid grid-cols-12 gap-3 pb-2 border-b border-border/40 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-5">Task Title *</div>
                  <div className="col-span-4">Assignee *</div>
                  <div className="col-span-2">Due Date *</div>
                  <div className="col-span-1 text-center">Remove</div>
                </div>

                {quickTasks.map((qt, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <input
                        id={`qt-title-${idx}`}
                        type="text"
                        placeholder="Enter task name..."
                        value={qt.title}
                        onChange={(e) => updateQuickField(idx, "title", e.target.value)}
                        onKeyDown={(e) => handleQuickTitleKeyDown(e, idx)}
                        className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="col-span-4">
                      <SearchableSelect
                        value={qt.assignee}
                        onChange={(val) => updateQuickField(idx, "assignee", val)}
                        options={employees.map((e) => ({ label: e.name, value: e.id }))}
                        placeholder="Select assignee"
                        className="w-full h-[36px] text-xs font-semibold"
                      />
                    </div>
                    <div className="col-span-2">
                      <DatePicker
                        value={qt.dueDate}
                        onChange={(val) => updateQuickField(idx, "dueDate", val)}
                        placeholder="Due date"
                        className="h-[36px] text-xs font-bold"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => removeQuickRow(idx)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addQuickRow}
                  className="w-full border border-dashed border-border/80 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Row
                </button>
              </div>

              <div className="px-6 py-4 border-t border-border/50 bg-muted/30 flex items-center justify-between shrink-0">
                <span className="text-xs text-muted-foreground font-semibold">
                  {quickTasks.filter((t) => t.title.trim()).length} task(s) ready to create
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickAssign(false)}
                    className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-xs rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkQuickAssign}
                    disabled={isQuickSubmitting || quickTasks.filter((t) => t.title.trim()).length === 0}
                    className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{isQuickSubmitting ? "Assigning..." : "Assign Tasks"}</span>
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* New Task Button */}
          <button
            onClick={() => {
              setEditingTaskId(null);
              setTaskFormTitle("");
              setTaskFormDesc("");
              setTaskFormPriority("Medium");
              setTaskFormDueDate(format(new Date(), "yyyy-MM-dd"));
              setTaskFormAssignee(currentUserId || employees[0]?.id || "");
              setTaskFormRecurrence("none");
              setFormErrors({});
              setIsNewTaskOpen(true);
            }}
            className="h-[38px] px-4 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>

          {/* View Toggle */}
          <div className="h-[38px] flex items-center bg-muted/40 border border-border/50 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setView("board")}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                view === "board" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground/80"
              )}
              title="Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                view === "list" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground/80"
              )}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Top KPI Cards (Interactive Filters) */}
      <div className="grid grid-cols-2 min-[460px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3 shrink-0">
        {[
          {
            label: "Total Tasks",
            count: displayStats.total,
            isActive: timeframeFilter === "all" && statusFilter === "All",
            onClick: () => {
              setTimeframeFilter("all");
              setStatusFilter("All");
            },
            color: "border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-400",
            icon: Flame,
          },
          {
            label: "Today's Work",
            count: (displayStats.today || 0) + (displayStats.overdue || 0),
            isActive: timeframeFilter === "today",
            onClick: () => {
              setTimeframeFilter("today");
              setStatusFilter("All");
            },
            color: "border-cyan-500/20 bg-cyan-500/5 text-cyan-700 dark:text-cyan-400",
            icon: Calendar,
          },
          {
            label: "Client Issue",
            count: clientIssuesCount,
            isActive: timeframeFilter === "client_issue",
            onClick: () => {
              setTimeframeFilter("client_issue");
              setStatusFilter("All");
            },
            color: "border-rose-500/20 bg-rose-500/5 text-rose-700 dark:text-rose-400",
            icon: AlertCircle,
          },
          {
            label: "Pending",
            count: displayStats.pending || 0,
            isActive: timeframeFilter === "pending",
            onClick: () => {
              setTimeframeFilter("pending");
              setStatusFilter("All");
            },
            color: "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400",
            icon: Clock,
          },
          {
            label: "Upcoming Work",
            count: displayStats.upcoming,
            isActive: timeframeFilter === "upcoming",
            onClick: () => {
              setTimeframeFilter("upcoming");
              setStatusFilter("All");
            },
            color: "border-indigo-500/20 bg-indigo-500/5 text-indigo-700 dark:text-indigo-400",
            icon: Clock,
          },
          {
            label: "In Review",
            count: displayStats.inreview,
            isActive: statusFilter === "In Review",
            onClick: () => {
              setStatusFilter("In Review");
              setTimeframeFilter("all");
            },
            color: "border-purple-500/20 bg-purple-500/5 text-purple-700 dark:text-purple-400",
            icon: Hourglass,
          },
          {
            label: "Completed",
            count: displayStats.completed,
            isActive: statusFilter === "Done",
            onClick: () => {
              setStatusFilter("Done");
              setTimeframeFilter("all");
            },
            color: "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
            icon: CheckCircle2,
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={kpi.onClick}
              className={cn(
                "p-3.5 rounded-2xl border flex flex-col text-left transition-all duration-200 shadow-sm relative overflow-hidden group",
                kpi.color,
                kpi.isActive ? "ring-2 ring-primary/50 scale-[1.02] shadow-md" : "opacity-80 hover:opacity-100 hover:scale-[1.01]"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-black uppercase tracking-wider">{kpi.label}</span>
                <Icon className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-xl font-black mt-2 leading-none">{kpi.count}</span>
            </button>
          );
        })}
      </div>

      {/* Scope Filter Tabs & Controls (My Tasks vs All Tasks + Dept & Person Filters) */}
      <div className="flex flex-col gap-2.5 bg-muted/20 border border-border/50 rounded-2xl p-2.5 shrink-0">
        {/* Switcher row is only for roles that can see both views; everyone else just sees their own tasks */}
        <div className={cn("flex flex-wrap items-center justify-between gap-3", !canViewAllTasks && "hidden")}>
          {/* Main View Mode Switcher: My Tasks vs All Tasks */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 dark:bg-muted/30 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => {
                setMainViewMode("my_tasks");
                setScopeFilter("my_tasks");
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5",
                mainViewMode === "my_tasks"
                  ? "bg-background text-primary shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>👤 My Tasks</span>
            </button>
            {canViewAllTasks && (
              <button
                type="button"
                onClick={() => {
                  setMainViewMode("all_tasks");
                  setScopeFilter("all");
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5",
                  mainViewMode === "all_tasks"
                    ? "bg-background text-primary shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>👥 All Tasks</span>
              </button>
            )}
          </div>

          {/* Sub-Tabs when in All Tasks Mode */}
          {mainViewMode === "all_tasks" && (
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
              {[
                { id: "all" as const, label: "All Team Tasks" },
                { id: "assigned_by_me" as const, label: "Assigned by Me" },
                {
                  id: "transfers" as const,
                  label: "Transfers",
                  badge: pendingIncomingTransfersCount > 0 ? pendingIncomingTransfersCount : undefined,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setScopeFilter(tab.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap",
                    scopeFilter === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-black animate-pulse">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters Row: Department & Person (in All Tasks mode), Priority, Category, Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-2">
            {/* Department Filter (Visible only for Head / Admin, NOT Team Leader and NOT other employees) */}
            {mainViewMode === "all_tasks" && isHead && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Dept:</span>
                <SearchableSelect
                  value={departmentFilter}
                  onChange={(val) => setDepartmentFilter(val)}
                  options={departmentList.map(d => ({ label: d, value: d }))}
                  placeholder="Department"
                  className="w-[125px] h-[32px] text-xs font-semibold"
                />
              </div>
            )}

            {/* Dual Filters: Assigned To AND Assigned By (Visible for Head / Admin and Team Leader) */}
            {mainViewMode === "all_tasks" && (isHead || isTeamLeader) && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">Assigned To:</span>
                  <SearchableSelect
                    value={assignedToFilter}
                    onChange={(val) => setAssignedToFilter(val)}
                    options={[
                      { label: "All Assignees", value: "All" },
                      ...(isTeamLeader ? teamLeaderEmployees : employees).map(e => ({ label: e.name, value: e.id }))
                    ]}
                    placeholder="Assignee"
                    className="w-[140px] h-[32px] text-xs font-semibold"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">Assigned By:</span>
                  <SearchableSelect
                    value={assignedByFilter}
                    onChange={(val) => setAssignedByFilter(val)}
                    options={[
                      { label: "All Assigners", value: "All" },
                      ...employees.map(e => ({ label: e.name, value: e.id }))
                    ]}
                    placeholder="Assigner"
                    className="w-[140px] h-[32px] text-xs font-semibold"
                  />
                </div>
              </>
            )}

            {/* Priority Filter (Visible to all, including other employees) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Priority:</span>
              <SearchableSelect
                value={priorityFilter}
                onChange={(val) => setPriorityFilter(val as any)}
                options={[
                  { label: "All", value: "All" },
                  { label: "High", value: "High" },
                  { label: "Medium", value: "Medium" },
                  { label: "Low", value: "Low" },
                ]}
                className="w-[100px] h-[32px] text-xs font-semibold"
              />
            </div>

            {/* Category Filter (visible to everyone, including employees on My Tasks) */}
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Category:</span>
                <SearchableSelect
                  value={categoryFilter}
                  onChange={(val) => setCategoryFilter(val)}
                  options={taskCategories.map(c => ({ label: c, value: c }))}
                  className="w-[120px] h-[32px] text-xs font-semibold"
                />
              </div>

            {/* Stage filter: Creative only */}
            {showCreativeFilters && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Stage:</span>
                <SearchableSelect
                  value={subCategoryFilter}
                  onChange={(val) => setSubCategoryFilter(val)}
                  options={STAGE_OPTIONS}
                  placeholder="All Stages"
                  className="w-[150px] h-[32px] text-xs font-semibold"
                />
              </div>
            )}

            {/* Project filter: any selected department, lists that department's projects */}
            {showProjectFilter && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Project:</span>
                <SearchableSelect
                  value={projectFilter}
                  onChange={(val) => setProjectFilter(val)}
                  options={[{ label: "All Projects", value: "All" }, ...projectOptions]}
                  placeholder="All Projects"
                  className="w-[240px] h-[32px] text-xs font-semibold"
                />
              </div>
            )}
          </div>

          {(statusFilter !== "All" || priorityFilter !== "All" || timeframeFilter !== "today" || scopeFilter !== "all" || categoryFilter !== "All" || subCategoryFilter !== "All" || projectFilter !== "All" || departmentFilter !== "All" || assignedToFilter !== "All" || assignedByFilter !== "All" || (canViewAllTasks && mainViewMode !== "all_tasks")) && (
            <button
              onClick={() => {
                setStatusFilter("All");
                setPriorityFilter("All");
                setTimeframeFilter("today");
                setScopeFilter("all");
                setCategoryFilter("All");
                setSubCategoryFilter("All");
                setProjectFilter("All");
                setDepartmentFilter("All");
                setAssignedToFilter("All");
                setAssignedByFilter("All");
                if (canViewAllTasks) setMainViewMode("all_tasks");
                setSearchQuery("");
              }}
              className="text-xs font-bold text-primary hover:underline px-2 ml-auto cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Creative Subcategory Filters (Script, Shoot, Caption, Thumbnail, Editing, Approval, Posting) */}
        {isCreativeScope && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar border-t border-border/40 pt-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-primary shrink-0 mr-1 flex items-center gap-1">
              <span>🎬</span>
              <span>Subcategories:</span>
            </span>
            <button
              type="button"
              onClick={() => setSubCategoryFilter("All")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                subCategoryFilter === "All"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
              )}
            >
              <span>All</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[9px] font-black",
                subCategoryFilter === "All" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {tasks.length}
              </span>
            </button>
            {CREATIVE_SUBCATEGORIES.map((sc) => {
              const count = tasks.filter(t => (t.subCategory || "").toLowerCase() === sc.toLowerCase()).length;
              return (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setSubCategoryFilter(sc)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                    subCategoryFilter.toLowerCase() === sc.toLowerCase()
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
                  )}
                >
                  <span>{sc}</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[9px] font-black",
                    subCategoryFilter.toLowerCase() === sc.toLowerCase()
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Centered loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-40 bg-background/40 backdrop-blur-sm !mt-0">
          <div className="sticky top-0 h-[calc(100vh-4rem)] flex items-center justify-center">
            <div className="h-12 w-12 flex items-center justify-center bg-card border border-border/60 rounded-xl shadow-md">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            </div>
          </div>
        </div>
      )}

      {/* Main View: Board (Kanban) or List (Table) */}
      {view === "board" ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <div className="flex gap-4 h-full min-w-max">
            {columns.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.status);
              const visibleLimit = columnVisibleCounts[col.status] || 25;
              const visibleTasks = colTasks.slice(0, visibleLimit);
              return (
                <div
                  key={col.status}
                  className="w-80 flex flex-col bg-muted/20 rounded-[2rem] border border-border/50 shrink-0 overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData("taskId");
                    updateTaskStatus(taskId, col.status);
                  }}
                >
                  <div className="p-4 border-b border-border/40 flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                      <h3 className="font-black text-xs uppercase tracking-wider">{col.title}</h3>
                    </div>
                    <span className="bg-card text-foreground text-xs font-black px-2.5 py-0.5 rounded-lg border border-border/60">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="flex-1 p-3 overflow-y-auto space-y-3">
                    {visibleTasks.map((task) => {
                      const isPendingTransferToMe =
                        task.transferRequest &&
                        task.transferRequest.status === "pending" &&
                        String(task.transferRequest.requested_to) === currentUserId;
                      const canApprove =
                        task.status === "In Review" &&
                        (isAdminOrHR || task.assignedById === currentUserId);

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
                          onClick={() => setInspectingTask(task)}
                          className={cn(
                            "bg-card p-4 rounded-2xl border shadow-sm transition-all group cursor-pointer space-y-3 relative hover:border-primary/40",
                            isPendingTransferToMe
                              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5"
                              : "border-border/60"
                          )}
                        >
                          {/* Top Badges */}
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-md uppercase border", getPriorityColor(task.priority))}>
                                {task.priority}
                              </span>
                              {(task.taskCategory === "Client Issue" || task.title.toLowerCase().startsWith("[client issue]")) && (
                                <span className="text-[9px] font-black bg-rose-500/10 text-rose-600 border border-rose-500/20 px-1.5 py-0.5 rounded-md">
                                  Client Issue
                                </span>
                              )}
                              {(task.isAuto || task.contentItemId) && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenCC(task, e)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
                                  title="Open in Content Calendar"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" /> Open CC
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {task.recurrence && task.recurrence !== "none" && (
                                <span className="text-[9px] font-bold bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground flex items-center gap-0.5">
                                  <Repeat className="w-2.5 h-2.5" />
                                  {task.recurrence}
                                </span>
                              )}
                              <Popover>
                                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-44 p-1.5" align="end" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => setSelectedHistoryTask(task)}
                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-1.5 text-primary"
                                  >
                                    <History className="w-3.5 h-3.5" /> View History
                                  </button>
                                  {task.isAuto ? (
                                    <button
                                      onClick={() => handleOpenCC(task)}
                                      className="w-full text-left px-2.5 py-1.5 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-1.5 text-primary"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-primary" /> Open CC
                                    </button>
                                  ) : (!task.isTransferred || isAdminOrHR) ? (
                                    <button
                                      onClick={() => openEditModal(task)}
                                      className="w-full text-left px-2.5 py-1.5 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-1.5"
                                    >
                                      Edit Task
                                    </button>
                                  ) : null}
                                  <button
                                    onClick={() => {
                                      setTransferringTask(task);
                                      setTransferTargetEmp("");
                                      setTransferReason("");
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs font-bold hover:bg-muted rounded-lg flex items-center gap-1.5 text-foreground"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer Task
                                  </button>
                                  {(isAdminOrHR || task.assignedById === currentUserId) && !task.isAuto && !task.isTransferred && (
                                    <button
                                      onClick={(e) => promptDeleteTask(task, e)}
                                      className="w-full text-left px-2.5 py-1.5 text-xs font-bold hover:bg-destructive/10 text-destructive rounded-lg flex items-center gap-1.5"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete Task
                                    </button>
                                  )}
                                  {(task.isAuto || task.isTransferred) && !isAdminOrHR && (
                                    <p className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground/60 italic">
                                      {task.isAuto ? "Auto task cannot be modified" : "Transferred task cannot be modified"}
                                    </p>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          {/* Incoming Transfer Request Alert */}
                          {isPendingTransferToMe && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 space-y-2">
                              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                                {task.transferRequest?.requested_by_details?.employee_name || "A colleague"} wants to transfer this to you
                              </p>
                              {task.transferRequest?.reason && (
                                <p className="text-[10px] text-muted-foreground italic">"{task.transferRequest.reason}"</p>
                              )}
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={(e) => handleAcceptTransfer(task.id, e)}
                                  className="px-2.5 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-[10px] font-black transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={(e) => handleRejectTransfer(task.id, e)}
                                  className="px-2.5 py-1 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-[10px] font-bold transition-colors"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Content */}
                          <div>
                            <h4 className="font-bold text-foreground text-xs leading-snug">{task.title}</h4>
                            {task.description && (
                              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* In-Review Actions for Assigner / Admin */}
                          {canApprove && (
                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-2.5 space-y-2">
                              <span className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-wider block">
                                Approval Needed
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => handleApproveTask(task.id, e)}
                                  className="flex-1 py-1 px-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-[10px] font-black flex items-center justify-center gap-1 shadow-sm transition-colors"
                                >
                                  <Check className="w-3 h-3" /> Approve
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRejectingTask(task);
                                  }}
                                  className="py-1 px-2 bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg text-[10px] font-black transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Footer Info */}
                          <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10px]">
                            {(() => {
                              const taskDate = task.dueDate ? new Date(task.dueDate) : null;
                              const isOverdue = Boolean(taskDate && isBefore(taskDate, startOfDay(new Date())) && task.status !== "Done");
                              const isDueToday = Boolean(taskDate && isToday(taskDate) && task.status !== "Done");
                              const formattedDate = formatDateDMY(task.dueDate);
                              if (isOverdue) {
                                return (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold text-[10px]" title="Overdue task!">
                                    <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                    <span>{formattedDate} (Overdue)</span>
                                  </div>
                                );
                              }
                              if (isDueToday) {
                                return (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-[10px]" title="Due today!">
                                    <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span>Due Today</span>
                                  </div>
                                );
                              }
                              return (
                                <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formattedDate || "No due date"}</span>
                                </div>
                              );
                            })()}
                            <div className="flex items-center gap-1.5">
                              <img
                                src={task.assignedToAvatar}
                                alt={task.assignedToName}
                                className="w-5 h-5 rounded-full border border-border"
                              />
                              <span className="font-bold text-foreground truncate max-w-[90px]">
                                {task.assignedToName}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {colTasks.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground/40 text-xs font-bold">
                        Drop tasks here
                      </div>
                    )}

                    {colTasks.length > visibleLimit && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setColumnVisibleCounts(prev => ({
                            ...prev,
                            [col.status]: (prev[col.status] || 25) + 25
                          }))}
                          className="w-full py-2 px-3 text-xs font-bold rounded-xl bg-card hover:bg-muted border border-border/60 text-primary transition-all shadow-2xs cursor-pointer"
                        >
                          Load More (+{Math.min(25, colTasks.length - visibleLimit)} of {colTasks.length - visibleLimit} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View (Table) */
        <div className="flex-1 bg-card rounded-[2rem] border border-border/50 overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto min-w-0 flex-1">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-muted/40 border-b border-border sticky top-0 z-10">
                <tr>
                  <SortableHeader label="Task Details" sortKey="title" currentSort={sortConfig} onSort={requestSort} className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="px-5 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Priority" sortKey="priority" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Due Date" sortKey="dueDate" currentSort={sortConfig} onSort={requestSort} className="px-5 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <th className="px-5 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Assigned To</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Assigned By</th>
                  <th className="px-6 py-3.5 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs font-medium">
                {paginatedTasks.map((task) => {
                  const isPendingTransferToMe =
                    task.transferRequest &&
                    task.transferRequest.status === "pending" &&
                    String(task.transferRequest.requested_to) === currentUserId;
                  const canApprove =
                    task.status === "In Review" &&
                    (isAdminOrHR || task.assignedById === currentUserId);

                  const isTaskOverdue = Boolean(task.dueDate && isBefore(new Date(task.dueDate), startOfDay(new Date())) && task.status !== "Done");

                  return (
                    <tr
                      key={task.id}
                      onClick={() => {
                        if (task.isAuto) {
                          openEditModal(task);
                        } else {
                          setInspectingTask(task);
                        }
                      }}
                      className={cn(
                        "hover:bg-muted/30 transition-colors group cursor-pointer",
                        isPendingTransferToMe && "bg-amber-500/5",
                        isTaskOverdue && "bg-rose-500/[0.04] hover:bg-rose-500/[0.08]"
                      )}
                    >
                      {/* Title & Desc */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{task.title}</span>
                            {task.recurrence && task.recurrence !== "none" && (
                              <span className="text-[9px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground flex items-center gap-0.5">
                                <Repeat className="w-2.5 h-2.5" /> {task.recurrence}
                              </span>
                            )}
                            {task.isProjectTask && (
                              <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">
                                {task.taskCategory === "SMM" ? "SMM 📅" : "Project"}
                              </span>
                            )}
                            {(task.taskCategory === "Client Issue" || task.title.toLowerCase().startsWith("[client issue]")) && (
                              <span className="text-[9px] font-black bg-rose-500/10 text-rose-600 border border-rose-500/20 px-1.5 py-0.5 rounded">
                                Client Issue
                              </span>
                            )}
                            {(task.isAuto || task.contentItemId) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCC(task, e);
                                }}
                                className="inline-flex items-center gap-1 text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors"
                                title="Auto-assigned from Content Calendar — Click to open in CC"
                              >
                                <span>CC Synced</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-sm">
                              {task.description}
                            </p>
                          )}
                          {isPendingTransferToMe && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              <ArrowRightLeft className="w-3 h-3" />
                              Transfer requested from {task.transferRequest?.requested_by_details?.employee_name}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status & Review Approval */}
                      <td className="px-5 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <SearchableSelect
                            value={task.status}
                            onChange={(val) => updateTaskStatus(task.id, val as TaskStatus)}
                            options={[
                              { label: "Todo", value: "Todo" },
                              { label: "In Progress", value: "In Progress" },
                              { label: "In Review", value: "In Review" },
                              { label: "Completed", value: "Done" },
                            ]}
                            className="w-[120px] h-[30px] text-xs font-semibold"
                          />
                          {canApprove && (
                            <button
                              onClick={(e) => handleApproveTask(task.id, e)}
                              className="px-2.5 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-[10px] font-black flex items-center gap-1 shadow-sm transition-colors"
                              title="Approve completed task"
                            >
                              <Check className="w-3 h-3" /> Approve
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-md uppercase border", getPriorityColor(task.priority))}>
                          {task.priority}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-5 py-4 whitespace-nowrap font-semibold">
                        {(() => {
                          const taskDate = task.dueDate ? new Date(task.dueDate) : null;
                          const isOverdue = Boolean(taskDate && isBefore(taskDate, startOfDay(new Date())) && task.status !== "Done");
                          const isDueToday = Boolean(taskDate && isToday(taskDate) && task.status !== "Done");
                          const formattedDate = formatDateDMY(task.dueDate);
                          if (isOverdue) {
                            return (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold text-xs shadow-xs" title="Overdue Task!">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span>{formattedDate} (Overdue)</span>
                              </div>
                            );
                          }
                          if (isDueToday) {
                            return (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs shadow-xs" title="Due Today!">
                                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>Due Today</span>
                              </div>
                            );
                          }
                          return (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Calendar className="w-3.5 h-3.5 opacity-60" />
                              <span>{formattedDate || "No due date"}</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Assigned To */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <img
                            src={task.assignedToAvatar}
                            alt={task.assignedToName}
                            className="w-6 h-6 rounded-full border border-border"
                          />
                          <span className="font-bold text-foreground">{task.assignedToName}</span>
                        </div>
                      </td>

                      {/* Assigned By */}
                      <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={task.assignedByAvatar}
                            alt={task.assignedByName}
                            className="w-5 h-5 rounded-full border border-border"
                          />
                          <span>{task.assignedByName}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isPendingTransferToMe && (
                            <>
                              <button
                                onClick={(e) => handleAcceptTransfer(task.id, e)}
                                className="px-2 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-[10px] font-bold"
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => handleRejectTransfer(task.id, e)}
                                className="px-2 py-1 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-[10px] font-bold"
                              >
                                Decline
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => {
                              setTransferringTask(task);
                              setTransferTargetEmp("");
                              setTransferReason("");
                            }}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                            title="Transfer Task to colleague"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setSelectedHistoryTask(task)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                            title="View Task History & Activity"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {task.isAuto ? (
                            <button
                              onClick={(e) => handleOpenCC(task, e)}
                              className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                              title="Open in Content Calendar"
                            >
                              <ExternalLink className="w-4 h-4 text-primary" />
                              <span className="hidden sm:inline text-[11px]">Open CC</span>
                            </button>
                          ) : (!task.isTransferred || isAdminOrHR) ? (
                            <button
                              onClick={(e) => openEditModal(task, e)}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                              title="Edit task"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          ) : null}

                          {(isAdminOrHR || task.assignedById === currentUserId) && !task.isAuto && !task.isTransferred && (
                            <button
                              onClick={(e) => promptDeleteTask(task, e)}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              title="Delete task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {(task.isAuto || task.isTransferred) && (
                            <span
                              className="p-1.5 text-muted-foreground/30 cursor-not-allowed"
                              title={task.isAuto ? "Auto task cannot be deleted" : "Transferred task cannot be deleted"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                        <CheckCircle2 className="w-6 h-6 text-muted-foreground/60" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">No tasks found</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Try changing your search query or filters.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalServerTasks > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-border/50 bg-muted/20 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Showing</span>
                <span className="font-bold text-foreground">
                  {totalServerTasks === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalServerTasks)}
                </span>
                <span>of</span>
                <span className="font-bold text-foreground">{totalServerTasks}</span>
                <span>tasks</span>
                <div className="hidden sm:flex items-center gap-1.5 ml-3 pl-3 border-l border-border/60">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-card border border-border/60 rounded-lg px-2 py-1 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-border/60 bg-card hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5 && currentPage > 3) {
                        pageNum = Math.min(totalPages - 4, currentPage - 2) + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            "w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer",
                            currentPage === pageNum
                              ? "bg-primary text-primary-foreground shadow-2xs"
                              : "bg-card hover:bg-muted border border-border/60 text-foreground"
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-border/60 bg-card hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Task Modal */}
      <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full max-w-lg p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {editingTaskId ? "Edit Task" : "Create New Task"}
              </h2>
              <p className="text-xs text-muted-foreground">Fill in the task details below.</p>
            </div>
            <DialogClose asChild>
              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <form onSubmit={handleCreateOrUpdateTask} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                  Task Title <span className="text-rose-500">*</span>
                </label>
              </div>
              <input
                type="text"
                placeholder="e.g. Design Marketing Creatives"
                value={taskFormTitle}
                onChange={(e) => {
                  setTaskFormTitle(e.target.value);
                  if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: "" }));
                }}
                className={cn(
                  "w-full px-3 py-2 bg-muted/40 border rounded-xl text-xs font-semibold focus:outline-none transition-all",
                  formErrors.title
                    ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5 text-foreground"
                    : "border-border/60 focus:ring-1 focus:ring-primary"
                )}
              />
              {formErrors.title && (
                <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3" /> {formErrors.title}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Task details and instructions..."
                value={taskFormDesc}
                onChange={(e) => setTaskFormDesc(e.target.value)}
                className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Category & Subcategory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                  Category
                </label>
                <SearchableSelect
                  value={taskFormCategory}
                  onChange={(val) => setTaskFormCategory(val)}
                  options={[
                    { label: "General", value: "General" },
                    { label: "Creative", value: "Creative" },
                    { label: "Development", value: "Development" },
                    { label: "Digital Marketing", value: "Digital Marketing" },
                  ]}
                  className="w-full h-[38px] text-xs font-semibold"
                />
              </div>

              {taskFormCategory === "Creative" ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-pink-600 uppercase tracking-wider block flex items-center justify-between">
                    <span>Subcategory</span>
                    <span className="text-[9px] font-bold text-muted-foreground">(7 Stages)</span>
                  </label>
                  <SearchableSelect
                    value={taskFormSubCategory}
                    onChange={(val) => setTaskFormSubCategory(val)}
                    options={[
                      { label: "1. Script", value: "Script" },
                      { label: "2. Shoot", value: "Shoot" },
                      { label: "3. Caption", value: "Caption" },
                      { label: "4. Thumbnail", value: "Thumbnail" },
                      { label: "5. Editing", value: "Editing" },
                      { label: "6. Approval", value: "Approval" },
                      { label: "7. Posting", value: "Posting" },
                    ]}
                    className="w-full h-[38px] text-xs font-bold border-pink-500/30"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Priority
                  </label>
                  <SearchableSelect
                    value={taskFormPriority}
                    onChange={(val) => setTaskFormPriority(val as Priority)}
                    options={[
                      { label: "High", value: "High" },
                      { label: "Medium", value: "Medium" },
                      { label: "Low", value: "Low" },
                    ]}
                    className="w-full h-[38px] text-xs font-bold"
                  />
                </div>
              )}
            </div>

            {/* Creative Production Details from old-HRMS */}
            {taskFormCategory === "Creative" && (
              <div className="p-3.5 bg-pink-500/5 border border-pink-500/20 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-pink-600 uppercase tracking-wider">
                    🎨 Creative Production Details
                  </span>
                  <div className="flex items-center gap-1">
                    {(["Reel", "Post", "Carousel", "Story"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTaskFormCreativeType(t)}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                          taskFormCreativeType === t
                            ? "bg-pink-600 text-white shadow-xs"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Reference / Benchmark Link</label>
                    <input
                      type="url"
                      placeholder="https://instagram.com/p/... or youtube link"
                      value={taskFormCreativeRef}
                      onChange={(e) => setTaskFormCreativeRef(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-card border border-border/60 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Drive / Assets Link</label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={taskFormCreativeDrive}
                      onChange={(e) => setTaskFormCreativeDrive(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-card border border-border/60 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Script / Caption Draft</label>
                  <textarea
                    rows={2}
                    placeholder="Enter hook, script outline, audio reference, or caption draft..."
                    value={taskFormCreativeScript}
                    onChange={(e) => setTaskFormCreativeScript(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-card border border-border/60 rounded-xl text-xs resize-none"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {taskFormCategory === "Creative" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Priority
                  </label>
                  <SearchableSelect
                    value={taskFormPriority}
                    onChange={(val) => setTaskFormPriority(val as Priority)}
                    options={[
                      { label: "High", value: "High" },
                      { label: "Medium", value: "Medium" },
                      { label: "Low", value: "Low" },
                    ]}
                    className="w-full h-[38px] text-xs font-bold"
                  />
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                    Due Date <span className="text-rose-500">*</span>
                  </label>
                </div>
                <DatePicker
                  value={taskFormDueDate}
                  onChange={(val) => {
                    setTaskFormDueDate(val);
                    if (formErrors.dueDate) setFormErrors((prev) => ({ ...prev, dueDate: "" }));
                  }}
                  placeholder="Select due date"
                  className={cn(
                    "h-[38px] text-xs font-bold",
                    formErrors.dueDate && "border-rose-500 ring-2 ring-rose-500/20"
                  )}
                />
                {formErrors.dueDate && (
                  <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3" /> {formErrors.dueDate}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                      Assign To <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  {currentUserId && (
                    <button
                      type="button"
                      onClick={() => {
                        setTaskFormAssignee(currentUserId);
                        if (formErrors.assignee) setFormErrors((prev) => ({ ...prev, assignee: "" }));
                      }}
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1",
                        taskFormAssignee === currentUserId
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/60 text-primary border-primary/30 hover:bg-primary/10"
                      )}
                      title="Assign this task to yourself"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>{taskFormAssignee === currentUserId ? "Assigned to You" : "Assign to Myself"}</span>
                    </button>
                  )}
                </div>
                <SearchableSelect
                  value={taskFormAssignee}
                  onChange={(val) => {
                    setTaskFormAssignee(val);
                    if (formErrors.assignee) setFormErrors((prev) => ({ ...prev, assignee: "" }));
                  }}
                  options={[
                    ...(currentUserId ? [{
                      label: `${currentUserName}`,
                      value: currentUserId
                    }] : []),
                    ...employees
                      .filter(e => e.id !== currentUserId)
                      .map((e) => ({ label: e.name, value: e.id }))
                  ]}
                  placeholder="Select employee"
                  className={cn(
                    "w-full h-[38px] text-xs font-semibold",
                    formErrors.assignee && "border-rose-500 ring-2 ring-rose-500/20"
                  )}
                />
                {formErrors.assignee && (
                  <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3" /> {formErrors.assignee}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Recurrence
                </label>
                <SearchableSelect
                  value={taskFormRecurrence}
                  onChange={(val) => setTaskFormRecurrence(val)}
                  options={[
                    { label: "One-time Task", value: "none" },
                    { label: "Daily Routine", value: "daily" },
                    { label: "Weekly Task", value: "weekly" },
                    { label: "Monthly Task", value: "monthly" },
                  ]}
                  className="w-full h-[38px] text-xs font-semibold"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewTaskOpen(false)}
                className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : editingTaskId ? "Save Changes" : "Create Task"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal (Design-wise Premium Popup) */}
      <Dialog open={!!taskToDelete} onOpenChange={(open) => !open && !isDeletingTask && setTaskToDelete(null)}>
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-md p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] border-rose-500/20 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-rose-500/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight text-foreground">Delete Task</h2>
                <p className="text-xs text-muted-foreground">Permanent deletion confirmation</p>
              </div>
            </div>
            <DialogClose asChild>
              <button
                disabled={isDeletingTask}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <p className="text-xs text-foreground/80 leading-relaxed">
                Are you sure you want to permanently delete this task?
              </p>
              {taskToDelete && (
                <div className="p-3 bg-muted/40 border border-border/60 rounded-xl space-y-1">
                  <div className="font-bold text-xs text-foreground truncate">
                    {taskToDelete.title}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Assigned to: <strong className="text-foreground">{taskToDelete.assignedToName}</strong></span>
                    {taskToDelete.dueDate && (
                      <>
                        <span>•</span>
                        <span>Due: <strong className="text-foreground">{formatDateDMY(taskToDelete.dueDate)}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                ⚠️ This action cannot be undone and will remove all activity records associated with this task.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/40">
              <button
                type="button"
                disabled={isDeletingTask}
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingTask}
                onClick={confirmDeleteTask}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-rose-600/20"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingTask ? "Deleting..." : "Yes, Delete Task"}</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Task Modal */}
      <Dialog open={!!transferringTask} onOpenChange={(open) => !open && setTransferringTask(null)}>
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-md p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-primary" /> Transfer Task
              </h2>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{transferringTask?.title}</p>
            </div>
            <DialogClose asChild>
              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Transfer To Colleague *
              </label>
              <SearchableSelect
                value={transferTargetEmp}
                onChange={setTransferTargetEmp}
                options={employees
                  .filter((e) => e.id !== transferringTask?.assignedToId)
                  .map((e) => ({ label: e.name, value: e.id }))}
                placeholder="Choose team member"
                className="w-full h-[38px] text-xs font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Reason for Transfer
              </label>
              <textarea
                rows={3}
                placeholder="Why is this task being transferred? (e.g., workload balancing, domain expertise)"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransferringTask(null)}
                className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestTransfer}
                disabled={isTransferSubmitting || !transferTargetEmp}
                className="px-5 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {isTransferSubmitting ? "Transferring..." : "Send Request"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Review Feedback Modal */}
      <Dialog open={!!rejectingTask} onOpenChange={(open) => !open && setRejectingTask(null)}>
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-md p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-base font-black tracking-tight text-rose-600">Send Back for Revision</h2>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{rejectingTask?.title}</p>
            </div>
            <DialogClose asChild>
              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Feedback / Revision Reason *
              </label>
              <textarea
                rows={3}
                placeholder="What needs to be corrected or revised?"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingTask(null)}
                className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectReview}
                disabled={isRejectSubmitting || !rejectionReason.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {isRejectSubmitting ? "Sending..." : "Send for Revision"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Details & Transfer History Modal */}
      <Dialog open={!!inspectingTask} onOpenChange={(open) => !open && setInspectingTask(null)}>
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-lg p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] border-border/60 shadow-2xl [&>button]:hidden bg-card">
          {inspectingTask && (
            <div>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-md uppercase border", getPriorityColor(inspectingTask.priority))}>
                      {inspectingTask.priority}
                    </span>
                    <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-md">
                      {inspectingTask.status}
                    </span>
                    {inspectingTask.recurrence !== "none" && (
                      <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> {inspectingTask.recurrence}
                      </span>
                    )}
                    {inspectingTask.isAuto && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Auto-Assigned (Content Calendar)
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-black tracking-tight text-foreground">{inspectingTask.title}</h2>
                </div>
                <DialogClose asChild>
                  <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </DialogClose>
              </div>

              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Description */}
                <div>
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">Description</h4>
                  <p className="text-xs text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-xl border border-border/40">
                    {inspectingTask.description || "No description provided."}
                  </p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-muted/20 p-3 rounded-xl border border-border/40">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">Assigned To</span>
                    <div className="flex items-center gap-2">
                      <img src={inspectingTask.assignedToAvatar} alt="" className="w-5 h-5 rounded-full border" />
                      <span className="font-bold">{inspectingTask.assignedToName}</span>
                    </div>
                  </div>

                  <div className="bg-muted/20 p-3 rounded-xl border border-border/40">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">Assigned By</span>
                    <div className="flex items-center gap-2">
                      <img src={inspectingTask.assignedByAvatar} alt="" className="w-5 h-5 rounded-full border" />
                      <span className="font-bold">{inspectingTask.assignedByName}</span>
                    </div>
                  </div>

                  <div className="bg-muted/20 p-3 rounded-xl border border-border/40">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">Due Date</span>
                    <span className="font-bold">{formatDateDMY(inspectingTask.dueDate) || "None"}</span>
                  </div>

                  {inspectingTask.approvedByName && (
                    <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase block mb-1">Approved By</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{inspectingTask.approvedByName}</span>
                    </div>
                  )}
                </div>

                {/* Transfer History Timeline */}
                {inspectingTask.transferHistory && inspectingTask.transferHistory.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer History Log
                    </h4>
                    <div className="space-y-2">
                      {inspectingTask.transferHistory.map((hist, i) => (
                        <div key={i} className="p-2.5 bg-muted/30 border border-border/40 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold">
                              {hist.from_employee_details?.employee_name || "Employee"} → {hist.to_employee_details?.employee_name || "Employee"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {hist.transferred_at ? `${formatDate(hist.transferred_at)} ${format(new Date(hist.transferred_at), "HH:mm")}` : ""}
                            </span>
                          </div>
                          {hist.reason && <p className="text-[10px] text-muted-foreground italic">"{hist.reason}"</p>}
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded inline-block", hist.status === "accepted" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
                            {hist.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-3 border-t border-border/50 bg-muted/30 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    const t = inspectingTask;
                    setInspectingTask(null);
                    setSelectedHistoryTask(t);
                  }}
                  className="px-4 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <History className="w-3.5 h-3.5" /> View History
                </button>
                {inspectingTask.isAuto ? (
                  <button
                    onClick={() => {
                      const t = inspectingTask;
                      setInspectingTask(null);
                      handleOpenCC(t);
                    }}
                    className="px-4 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open CC
                  </button>
                ) : (!inspectingTask.isTransferred || isAdminOrHR) ? (
                  <button
                    onClick={() => openEditModal(inspectingTask)}
                    className="px-4 py-1.5 bg-card border border-border hover:bg-muted font-bold text-xs rounded-xl"
                  >
                    Edit Task
                  </button>
                ) : null}
                <button
                  onClick={() => setInspectingTask(null)}
                  className="px-4 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dedicated Task History & Activity Audit Trail Modal */}
      <Dialog open={!!selectedHistoryTask} onOpenChange={(open) => !open && setSelectedHistoryTask(null)}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full max-w-xl p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] border-border/60 shadow-2xl [&>button]:hidden bg-card flex flex-col max-h-[85vh]">
          {selectedHistoryTask && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/30 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    <h2 className="text-base font-black tracking-tight">Task History & Activity Trail</h2>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-sm font-medium">
                    {selectedHistoryTask.title}
                  </p>
                </div>
                <DialogClose asChild>
                  <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </DialogClose>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* Meta summary card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-muted/30 border border-border/40 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider block mb-1">Status</span>
                    <span className="font-bold text-foreground bg-card px-2 py-0.5 rounded-lg border border-border/60 inline-block text-[11px]">
                      {selectedHistoryTask.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider block mb-1">Assigned By</span>
                    <span className="font-bold text-foreground truncate block">{selectedHistoryTask.assignedByName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider block mb-1">Assigned To</span>
                    <span className="font-bold text-foreground truncate block">{selectedHistoryTask.assignedToName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider block mb-1">Recurrence</span>
                    <span className="font-bold text-foreground capitalize truncate block">
                      {selectedHistoryTask.recurrence === "daily" ? "Daily Routine" : selectedHistoryTask.recurrence === "weekly" ? "Weekly Task" : selectedHistoryTask.recurrence === "monthly" ? "Monthly Task" : "One-time"}
                    </span>
                  </div>
                </div>

                {/* Timeline audit trail */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" /> Activity Audit Trail
                  </h4>

                  {(() => {
                    const events: Array<{
                      id: string;
                      timestamp: string;
                      action: string;
                      performedBy: string;
                      details?: string | undefined;
                      type: "create" | "status" | "transfer" | "approve" | "reject" | "update";
                    }> = [];

                    // 1. Add activityHistory
                    (selectedHistoryTask.activityHistory || []).forEach((act, idx) => {
                      let type: "create" | "status" | "transfer" | "approve" | "reject" | "update" = "update";
                      if (act.action === "created") type = "create";
                      else if (act.action === "status_changed") type = "status";
                      else if (act.action.startsWith("transfer")) type = "transfer";
                      else if (act.action === "approved") type = "approve";
                      else if (act.action === "rejected_review") type = "reject";

                      events.push({
                        id: `act-${idx}`,
                        timestamp: act.timestamp,
                        action: act.action,
                        performedBy: act.performed_by_name || "Management",
                        details: act.details,
                        type,
                      });
                    });

                    // 2. Add transferHistory
                    (selectedHistoryTask.transferHistory || []).forEach((trans, idx) => {
                      events.push({
                        id: `trans-${idx}`,
                        timestamp: trans.transferred_at,
                        action: `transfer_${trans.status}`,
                        performedBy: trans.to_employee_details?.employee_name || "Colleague",
                        details: `Transferred from ${trans.from_employee_details?.employee_name || "Colleague"} to ${trans.to_employee_details?.employee_name || "Colleague"}${trans.reason ? `. Reason: "${trans.reason}"` : ""}`,
                        type: "transfer",
                      });
                    });

                    // Fallback if no activity recorded yet (legacy tasks)
                    if (events.length === 0) {
                      events.push({
                        id: "initial-task",
                        timestamp: selectedHistoryTask.rawDueDate || new Date().toISOString(),
                        action: "created",
                        performedBy: selectedHistoryTask.assignedByName,
                        details: `Task created and assigned to ${selectedHistoryTask.assignedToName}`,
                        type: "create",
                      });
                    }

                    // Sort chronologically (most recent first)
                    events.sort((a, b) => {
                      const tA = new Date(a.timestamp).getTime();
                      const tB = new Date(b.timestamp).getTime();
                      return tB - tA;
                    });

                    return (
                      <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-border/60">
                        {events.map((ev) => {
                          const dateObj = new Date(ev.timestamp);
                          const formattedTime = !isNaN(dateObj.getTime())
                            ? `${formatDate(dateObj)}, ${format(dateObj, "hh:mm a")}`
                            : String(ev.timestamp);

                          return (
                            <div key={ev.id} className="relative group">
                              {/* Dot Icon */}
                              <div className={cn(
                                "absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-card flex items-center justify-center text-white",
                                ev.type === "create" && "bg-blue-500 ring-2 ring-blue-500/20",
                                ev.type === "status" && "bg-amber-500 ring-2 ring-amber-500/20",
                                ev.type === "transfer" && "bg-purple-500 ring-2 ring-purple-500/20",
                                ev.type === "approve" && "bg-emerald-500 ring-2 ring-emerald-500/20",
                                ev.type === "reject" && "bg-rose-500 ring-2 ring-rose-500/20",
                                ev.type === "update" && "bg-slate-500 ring-2 ring-slate-500/20"
                              )}>
                                <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                              </div>

                              <div className="bg-muted/20 border border-border/40 hover:border-border/80 rounded-xl p-3 space-y-1 transition-colors">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-xs text-foreground">{ev.performedBy}</span>
                                    <span className={cn(
                                      "text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
                                      ev.type === "create" && "bg-blue-500/10 text-blue-600",
                                      ev.type === "status" && "bg-amber-500/10 text-amber-600",
                                      ev.type === "transfer" && "bg-purple-500/10 text-purple-600",
                                      ev.type === "approve" && "bg-emerald-500/10 text-emerald-600",
                                      ev.type === "reject" && "bg-rose-500/10 text-rose-600",
                                      ev.type === "update" && "bg-muted text-muted-foreground"
                                    )}>
                                      {ev.action.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-semibold">
                                    {formattedTime}
                                  </span>
                                </div>
                                {ev.details && (
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    {ev.details}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="px-6 py-3 border-t border-border/50 bg-muted/30 flex items-center justify-end shrink-0">
                <button
                  onClick={() => setSelectedHistoryTask(null)}
                  className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
