import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Search, 
  User as UserIcon,
  Filter, 
  CheckCircle2, 
  Clock, 
  X, 
  Star, 
  AlertCircle, 
  MessageSquare, 
  Activity, 
  Palmtree, 
  RotateCcw, 
  Loader2, 
  Users, 
  ShieldCheck 
} from "lucide-react";
import { DialogClose, Dialog, DialogContent } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { format as formatDateFns, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/components/auth/AuthContext";
import { hasModulePermission, isUserAdmin } from "@/lib/permissions";

type VerificationStatus = "Pending" | "Verified" | "Rejected";
type GroupTab = "employees" | "leaders_hr";

interface DailyTask {
  task_id?: string;
  id?: string;
  title?: string;
  description?: string;
  status: string;
}

interface DailyRecord {
  id: string;
  employee_id: string;
  employeeName: string;
  department: string;
  designation?: string;
  subDepartment?: string;
  submittedAt: string;
  date: string;
  tasksDone: DailyTask[];
  tasksPending: DailyTask[];
  verificationStatus: VerificationStatus;
  rating?: number;
  managerRemarks?: string;
  verifiedBy?: string | undefined;
  onLeave?: boolean;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function isLeaderOrHr(r: DailyRecord | any): boolean {
  const desig = String(r.designation || r.work_details?.designation || "").toLowerCase().trim();
  const dept = String(r.department || r.work_details?.department || "").toLowerCase().trim();
  const role = String(r.role || r.work_details?.system_role || "").toLowerCase().trim();

  if (desig.includes("head") || role.includes("head")) return true;
  if (desig.includes("team leader") || desig.includes("tl") || role.includes("team leader")) return true;
  if (dept === "hr" || desig.includes("hr") || role === "hr") return true;
  return false;
}

function mapRecord(r: any): DailyRecord {
  const submitted: string = r.submitted_at ? String(r.submitted_at) : "";
  const statusRaw = String(r.status || "Pending").toLowerCase();
  const verificationStatus: VerificationStatus =
    statusRaw.startsWith("verif") ? "Verified" : statusRaw.startsWith("reject") ? "Rejected" : "Pending";
  const done = Array.isArray(r.completed_today_tasks) ? r.completed_today_tasks : [];
  const pending = [
    ...(Array.isArray(r.pending_tasks) ? r.pending_tasks : []),
    ...(Array.isArray(r.assigned_tasks) ? r.assigned_tasks : []),
  ];
  return {
    id: String(r._id || r.id),
    employee_id: String(r.employee_id || ""),
    employeeName: r.employee_name || "Employee",
    department: r.department || "General",
    designation: r.designation || "",
    subDepartment: r.sub_department || "",
    submittedAt: submitted.includes("T") ? (submitted.split("T")[1]?.slice(0, 5) || "") : submitted,
    date: submitted ? submitted.slice(0, 10) : "",
    tasksDone: done,
    tasksPending: pending,
    verificationStatus,
    rating: typeof r.rating === "number" ? r.rating : 0,
    managerRemarks: r.remarks || "",
    verifiedBy: r.verified_by_id ? "Manager" : undefined,
    onLeave: !!r.on_leave,
  };
}

const taskLabel = (t: DailyTask) => t.title || t.description || "Task";

// Render 5 stars with half-star visual representation
function renderStarDisplay(score: number, sizeClass = "w-4 h-4") {
  const safeScore = Math.min(10, Math.max(0, score));
  return (
    <div className="flex items-center gap-1" title={`KRA-KPI ${safeScore}/10`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const valLeft = i * 2 + 1;
          const valRight = i * 2 + 2;
          const isFull = safeScore >= valRight;
          const isHalf = safeScore === valLeft;
          return (
            <div key={i} className={cn("relative inline-block", sizeClass)}>
              <Star className={cn(sizeClass, "text-muted-foreground/25 fill-transparent")} />
              {isFull && (
                <div className="absolute inset-0 pointer-events-none">
                  <Star className={cn(sizeClass, "text-amber-400 fill-amber-400")} />
                </div>
              )}
              {isHalf && (
                <div className="absolute inset-0 w-1/2 overflow-hidden pointer-events-none">
                  <Star className={cn(sizeClass, "text-amber-400 fill-amber-400")} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 ml-1">
        {safeScore}/10
      </span>
    </div>
  );
}

export function DailyProgress() {
  const { user } = useAuth();
  const anyUser = user as any;
  const userDept = String(anyUser?.department || anyUser?.work_details?.department || "").toLowerCase().trim();
  const userRole = String(anyUser?.role || anyUser?.work_details?.system_role || "").toLowerCase().trim();
  const userDesig = String(anyUser?.designation || anyUser?.work_details?.designation || "").toLowerCase().trim();

  const isAdmin = isUserAdmin(user) || userRole === "admin";
  const isHr = userDept === "hr" || userDesig.includes("hr") || userRole === "hr";
  const isHead = userDesig.includes("head") || userRole.includes("head");
  const isTeamLeader = userDesig.includes("team leader") || userDesig.includes("tl") || userRole.includes("team leader");

  const canReadProgress = isAdmin || isHr || isHead || isTeamLeader || hasModulePermission(user, "/approvals/daily-progress", "read") || hasModulePermission(user, "/daily-progress", "read");
  const canManageProgress = isAdmin || isHr || isHead || isTeamLeader || hasModulePermission(user, "/approvals/daily-progress", "update") || hasModulePermission(user, "/daily-progress", "update") || hasModulePermission(user, "/approvals/daily-progress", "all");
  const isReviewer = canReadProgress || canManageProgress;

  // Filter Group Tab: 'leaders_hr' (Team Leaders, Heads, HR - default for Admin) vs 'employees' (Regular Staff)
  const [groupTab, setGroupTab] = useState<GroupTab>("leaders_hr");
  // Team Leader (not Admin/HR/Head): own report vs team members' reports
  const showLeaderTabs = isTeamLeader && !(isAdmin || isHr || isHead);
  const [leaderView, setLeaderView] = useState<"team" | "my">("team");

  const [search, setSearch] = useState("");
  // Default = TODAY
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());

  // Picker works with Date objects; the API and filters use YYYY-MM-DD strings
  const dateRangeValue = useMemo(
    () => (startDate ? { from: parseISO(startDate), to: parseISO(endDate || startDate) } : undefined),
    [startDate, endDate]
  );
  const handleDateRangeChange = (range?: { from?: Date; to?: Date }) => {
    if (!range?.from) {
      setStartDate("");
      setEndDate("");
      return;
    }
    // A single picked day (no end yet) filters just that day
    setStartDate(formatDateFns(range.from, "yyyy-MM-dd"));
    setEndDate(formatDateFns(range.to || range.from, "yyyy-MM-dd"));
  };
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "All">("All");
  const [employeeFilter, setEmployeeFilter] = useState<string>("All");
  const [departmentFilter, setDepartmentFilter] = useState<string>("All");
  const [allEmployeesRaw, setAllEmployeesRaw] = useState<any[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<{ label: string; value: string }[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<{ label: string; value: string }[]>([]);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [avgRating, setAvgRating] = useState<string>("N/A");

  // Load employee & department list for filters (active only)
  useEffect(() => {
    if (!isReviewer) return;
    const loadFilters = async () => {
      try {
        const res = await api.get<any>("/employees?exclude_role=Admin", { showLoader: false, showErrorToast: false });
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const nonAdminActiveList = list.filter((e: any) => {
          const role = String(e.work_details?.system_role || e.role || "").toLowerCase().trim();
          if (role === "admin") return false;
          // Filter out deleted, blocked, and inactive users
          if (e.is_delete || e.work_details?.is_delete) return false;
          if (e.is_block || e.work_details?.is_block) return false;
          const status = String(e.status || e.work_details?.status || "").toLowerCase().trim();
          if (["inactive", "terminated", "resigned", "blocked", "deleted"].includes(status)) return false;
          return true;
        });
        setAllEmployeesRaw(nonAdminActiveList);

        const depts = new Set<string>();
        nonAdminActiveList.forEach((e: any) => {
          const d = e.work_details?.department || e.department;
          if (d && typeof d === "string") depts.add(d.trim());
        });
        const deptOpts = Array.from(depts).filter(Boolean).sort().map(d => ({ label: d, value: d }));
        setDepartmentOptions([{ label: "All Departments / Heads", value: "All" }, ...deptOpts]);
      } catch {}
    };
    loadFilters();
  }, [isReviewer]);

  // Update employee options based on groupTab
  useEffect(() => {
    let pool = allEmployeesRaw;
    if (isAdmin || isHr || isHead) {
      if (groupTab === "leaders_hr") {
        pool = pool.filter(e => isLeaderOrHr(e));
      } else {
        pool = pool.filter(e => !isLeaderOrHr(e));
      }
    }
    const emps = pool.map((e: any) => {
      const p = e.personal_info || {};
      const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || e.name || "Employee";
      const id = String(e._id || e.id || "");
      return { label: name, value: id };
    }).filter((e: any) => e.value);
    setEmployeeOptions([{ label: "All Employees", value: "All" }, ...emps]);
    setEmployeeFilter("All");
  }, [allEmployeesRaw, groupTab, isAdmin, isHr, isHead]);

  // Modal State
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [pendingListModalOpen, setPendingListModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DailyRecord | null>(null);
  const [currentRating, setCurrentRating] = useState<number>(0); // 1 to 10 scale (half-star supported)
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [currentRemarks, setCurrentRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (!isReviewer) {
        params.set("view_type", "my");
      } else {
        if (employeeFilter !== "All") params.set("employee_id", employeeFilter);
        if (departmentFilter !== "All") params.set("department", departmentFilter);
      }
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (startDate && endDate && startDate === endDate) {
        params.set("date", startDate); // single day → backend syncs today's drafts
      } else {
        if (startDate) params.set("from_date", startDate);
        if (endDate) params.set("to_date", endDate);
      }
      const res = await api.get<any[]>(`/daily-progress?${params.toString()}`, {
        showLoader: false,
        showErrorToast: false,
      });
      const list = Array.isArray(res) ? res : [];
      const mapped = list.map(mapRecord);
      // Deduplicate by employee_id + date as UI safeguard
      const uniqueMap = new Map<string, DailyRecord>();
      for (const rec of mapped) {
        const key = `${rec.employee_id}_${rec.date}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, rec);
        } else {
          const ex = uniqueMap.get(key)!;
          if (rec.verificationStatus === "Verified" && ex.verificationStatus !== "Verified") {
            uniqueMap.set(key, rec);
          }
        }
      }
      setRecords(Array.from(uniqueMap.values()));
    } catch (err: any) {
      toast.error(err?.message || "Failed to load daily progress");
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, startDate, endDate, employeeFilter, departmentFilter, isReviewer]);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams({ time_range: "custom" });
      if (startDate) params.set("from_date", startDate);
      if (endDate) params.set("to_date", endDate);
      const res = await api.get<any>(`/daily-progress/average-rating?${params.toString()}`, {
        showLoader: false,
        showErrorToast: false,
      });
      setAvgRating(res && typeof res.average_rating === "number" ? Number(res.average_rating).toFixed(1) : "N/A");
    } catch {
      setAvgRating("N/A");
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [fetchRecords, fetchStats]);

  const myProgressCount = records.filter(r => r.employee_id === user?.id).length;
  const teamProgressCount = records.filter(r => r.employee_id !== user?.id).length;

  const filteredRecords = records.filter(rec => {
    if (!isReviewer && rec.employee_id !== user?.id) return false;
    // Team Leader: "My Progress" = own report, "Team Progress" = team members
    if (showLeaderTabs) {
      if (leaderView === "my" && rec.employee_id !== user?.id) return false;
      if (leaderView === "team" && rec.employee_id === user?.id) return false;
    }

    // Reviewer category tabs (Admin, HR, Head)
    if (isAdmin || isHr || isHead) {
      if (groupTab === "employees" && isLeaderOrHr(rec)) return false;
      if (groupTab === "leaders_hr" && !isLeaderOrHr(rec)) return false;
    }

    const matchesSearch = rec.employeeName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || rec.verificationStatus === statusFilter;
    const matchesEmp = employeeFilter === "All" || rec.employee_id === employeeFilter;
    const matchesDept = departmentFilter === "All" || rec.department.toLowerCase() === departmentFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesEmp && matchesDept;
  });

  const pendingCount = filteredRecords.filter(r => r.verificationStatus === "Pending").length;
  const verifiedCount = filteredRecords.filter(r => r.verificationStatus === "Verified").length;

  const employeesTabCount = records.filter(r => !isLeaderOrHr(r)).length;
  const leadersHrTabCount = records.filter(r => isLeaderOrHr(r)).length;

  const handleOpenVerify = (record: DailyRecord) => {
    setSelectedRecord(record);
    setCurrentRating(Math.round(record.rating || 0));
    setHoverRating(null);
    setCurrentRemarks(record.managerRemarks || "");
    setVerifyModalOpen(true);
  };

  const refreshAfter = async () => {
    await fetchRecords();
    await fetchStats();
  };

  const handleVerifySubmit = async () => {
    if (!selectedRecord) return;
    if (selectedRecord.onLeave) {
      toast.error("Cannot approve: Employee is on leave for this date.");
      return;
    }
    if (selectedRecord.employee_id === user?.id) {
      toast.error("You cannot approve your own daily progress report.");
      return;
    }
    if (currentRating === 0 || !currentRemarks.trim()) {
      toast.error("Both KRA-KPI Rating (1-10) and Manager Remarks are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      // 1 to 10 rating directly
      await api.put(`/daily-progress/${selectedRecord.id}/approve`, {
        rating: currentRating,
        remarks: currentRemarks.trim(),
      });
      toast.success(`Verified with KRA-KPI ${currentRating}/10 rating`);
      setVerifyModalOpen(false);
      setSelectedRecord(null);
      await refreshAfter();
    } catch (err: any) {
      toast.error(err?.message || "Verify failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRecord) return;
    setIsSubmitting(true);
    try {
      await api.put(`/daily-progress/${selectedRecord.id}/reject`, undefined, { showLoader: false });
      toast.success("Report rejected");
      setVerifyModalOpen(false);
      setSelectedRecord(null);
      await refreshAfter();
    } catch (err: any) {
      toast.error(err?.message || "Reject failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!selectedRecord) return;
    setIsSubmitting(true);
    try {
      await api.put(`/daily-progress/${selectedRecord.id}/reset`, undefined, { showLoader: false });
      toast.success("Reset to pending");
      setVerifyModalOpen(false);
      setSelectedRecord(null);
      await refreshAfter();
    } catch (err: any) {
      toast.error(err?.message || "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusStyle = (s: VerificationStatus) =>
    s === "Verified"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : s === "Rejected"
        ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
        : "bg-amber-500/10 text-amber-600 border-amber-500/20";

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
            Daily Progress Hub
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Track daily work, verify completed tasks, and provide KRA-KPI ratings (1-10 Scale).
          </p>
        </div>

        {/* Team Leader Badge indicator */}
        {isTeamLeader && !isAdmin && !isHr && !isHead && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-primary text-xs font-black">
            <Users className="w-4 h-4" />
            <span>Team Leader View: Team Members Only</span>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1">Total Reports</div>
          <div className="text-4xl font-black">{filteredRecords.length}</div>
        </div>
        <div
          className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 shadow-sm cursor-pointer hover:bg-amber-500/10 transition-colors group"
          onClick={() => setPendingListModalOpen(true)}
        >
          <div className="text-amber-600 font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
            Pending Verification
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-md">View All</span>
          </div>
          <div className="text-4xl font-black text-amber-700">{pendingCount}</div>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 shadow-sm">
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Avg Rating</div>
          <div className="text-4xl font-black text-emerald-700 flex items-end gap-2">
            {avgRating} <Star className="w-6 h-6 text-emerald-500 mb-1 fill-emerald-500" />
          </div>
        </div>
      </div>

      {/* Top Category Filter Tabs for Admin, HR & Heads */}
      {(isAdmin || isHr || isHead) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-card/60 border border-border/40 rounded-2xl">
          <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setGroupTab("leaders_hr")}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                groupTab === "leaders_hr"
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
            >
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>Team Leaders & HR</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-black",
                groupTab === "leaders_hr" ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
              )}>
                {leadersHrTabCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setGroupTab("employees")}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                groupTab === "employees"
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
            >
              <Users className="w-4 h-4 text-primary" />
              <span>Employees</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-black",
                groupTab === "employees" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {employeesTabCount}
              </span>
            </button>
          </div>

          <div className="text-xs text-muted-foreground font-medium px-2 hidden sm:block">
            {groupTab === "employees"
              ? "Showing staff (Excludes HR, Heads, Team Leaders)"
              : "Showing Team Leaders, Department Heads & HR"}
          </div>
        </div>
      )}

      {/* My / Team tabs for Team Leaders */}
      {showLeaderTabs && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-card/60 border border-border/40 rounded-2xl">
          <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl w-full sm:w-auto">
            {([
              { key: "my", label: "My Progress", icon: <UserIcon className="w-4 h-4 text-amber-500" />, count: myProgressCount },
              { key: "team", label: "Team Progress", icon: <Users className="w-4 h-4 text-primary" />, count: teamProgressCount },
            ] as const).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setLeaderView(tab.key); setEmployeeFilter("All"); }}
                className={cn(
                  "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                  leaderView === tab.key
                    ? "bg-card text-foreground shadow-sm border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-black",
                  leaderView === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground font-medium px-2 hidden sm:block">
            {leaderView === "my" ? "Showing your own daily progress" : "Showing your team members' daily progress"}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employee names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {isReviewer && (
            <>
              {/* "My Progress" only has the leader's own report, so no employee filter there */}
              {!(showLeaderTabs && leaderView === "my") && (
                <div className="relative w-full sm:w-[170px]">
                  <SearchableSelect
                    value={employeeFilter}
                    onChange={(val) => setEmployeeFilter(val)}
                    options={employeeOptions.length > 0 ? employeeOptions : [{ label: "All Employees", value: "All" }]}
                    className="w-full h-[42px] bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-bold cursor-pointer"
                  />
                </div>
              )}
              {(isAdmin || isHr) && (
                <div className="relative w-full sm:w-[190px]">
                  <SearchableSelect
                    value={departmentFilter}
                    onChange={(val) => setDepartmentFilter(val)}
                    options={departmentOptions.length > 0 ? departmentOptions : [{ label: "All Departments / Heads", value: "All" }]}
                    className="w-full h-[42px] bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-bold cursor-pointer"
                  />
                </div>
              )}
            </>
          )}
          {/* One picker: click a single day, or a start and an end day for a range */}
          <DateRangeFilter
            value={dateRangeValue}
            onChange={handleDateRangeChange}
            placeholder="Select date / range"
            className="w-full sm:w-auto"
          />
          <div className="relative w-full sm:w-auto">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
            <SearchableSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
                { label: "All Statuses", value: "All" },
                { label: "Pending Verification", value: "Pending" },
                { label: "Verified", value: "Verified" },
                { label: "Rejected", value: "Rejected" },
              ]}
              className="w-[180px] h-[42px] pl-9 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Progress Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading reports...</p>
        </div>
      ) : (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredRecords.map((record) => (
          <div key={record.id} className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">

            {/* Header info */}
            <div className="p-5 border-b border-border/50 bg-muted/10">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-lg">
                    {record.employeeName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-foreground leading-tight">{record.employeeName}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">{record.department}</span>
                      {record.designation && (
                        <>
                          <span className="text-[10px] text-muted-foreground/60">•</span>
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.2 rounded border",
                            isLeaderOrHr(record)
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                              : "bg-muted text-muted-foreground border-border/50"
                          )}>
                            {record.designation}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border",
                    statusStyle(record.verificationStatus)
                  )}>
                    {record.verificationStatus}
                  </span>
                  {record.onLeave && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase border bg-sky-500/10 text-sky-600 border-sky-500/20">
                      <Palmtree className="w-3 h-3" /> On Leave
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {record.date}{record.submittedAt ? ` • ${record.submittedAt}` : ""}
              </div>
            </div>

            {/* Task Summary */}
            <div className="p-5 flex-grow space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-bold text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Completed Tasks ({record.tasksDone.length})
                </div>
                <ul className="space-y-1.5">
                  {record.tasksDone.slice(0, 2).map((task, i) => (
                    <li key={task.task_id || task.id || i} className="text-xs text-muted-foreground line-clamp-1 flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      {taskLabel(task)}
                    </li>
                  ))}
                  {record.tasksDone.length > 2 && (
                    <li className="text-xs text-muted-foreground font-medium pl-2.5">
                      +{record.tasksDone.length - 2} more...
                    </li>
                  )}
                  {record.tasksDone.length === 0 && (
                    <li className="text-xs text-muted-foreground">No tasks completed.</li>
                  )}
                </ul>
              </div>

              {record.tasksPending.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm font-bold text-amber-600">
                    <Clock className="w-4 h-4" />
                    Pending Tasks ({record.tasksPending.length})
                  </div>
                  <ul className="space-y-1.5">
                    {record.tasksPending.slice(0, 2).map((task, i) => (
                      <li key={task.task_id || task.id || i} className="text-xs text-muted-foreground line-clamp-1 flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        {taskLabel(task)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Actions / Rating Footer */}
            <div className="p-4 border-t border-border/50 bg-muted/10 flex items-center justify-between">
              {record.verificationStatus === "Verified" ? (
                renderStarDisplay(record.rating || 0)
              ) : record.verificationStatus === "Rejected" ? (
                <div className="text-xs font-bold text-rose-500 uppercase tracking-wider">
                  Rejected
                </div>
              ) : (
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Needs Review
                </div>
              )}

              <button
                onClick={() => handleOpenVerify(record)}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2",
                  record.verificationStatus === "Pending"
                    ? (record.onLeave
                        ? "bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/20"
                        : record.employee_id === user?.id
                          ? "bg-muted text-muted-foreground hover:bg-muted/80"
                          : "bg-primary/10 hover:bg-primary/20 text-primary")
                    : "bg-muted/50 hover:bg-muted text-foreground"
                )}
              >
                {record.verificationStatus === "Pending"
                  ? (record.onLeave
                      ? "On Leave (View)"
                      : record.employee_id === user?.id
                        ? "Self Report"
                        : "Verify & Rate")
                  : "View Details"}
              </button>
            </div>
          </div>
        ))}
        {filteredRecords.length === 0 && (
          <div className="col-span-full p-12 text-center text-muted-foreground bg-card border border-dashed border-border/50 rounded-2xl">
            No daily progress reports match your search criteria.
          </div>
        )}
      </div>
      )}

      {/* Verification Modal */}
      <Dialog open={verifyModalOpen} onOpenChange={(open) => !open && setVerifyModalOpen(false)}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-3xl max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">

          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                {selectedRecord?.employeeName.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold">{selectedRecord?.employeeName}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedRecord?.department}{selectedRecord?.designation ? ` • ${selectedRecord.designation}` : ""} • {selectedRecord?.date}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedRecord?.onLeave && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border bg-sky-500/10 text-sky-600 border-sky-500/20">
                  <Palmtree className="w-3.5 h-3.5" /> On Leave
                </span>
              )}
              <DialogClose asChild>
                <button className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </DialogClose>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            <div className="grid md:grid-cols-2 gap-6">

              {/* Tasks List */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold flex items-center gap-2 text-emerald-600 mb-3 pb-2 border-b border-border/50">
                    <CheckCircle2 className="w-5 h-5" />
                    Completed Today
                  </h3>
                  {selectedRecord && selectedRecord.tasksDone.length > 0 ? (
                    <ul className="space-y-3">
                      {selectedRecord.tasksDone.map((task, i) => (
                        <li key={task.task_id || task.id || i} className="flex items-start gap-3 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-sm font-medium text-foreground">{taskLabel(task)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-xl text-center">No tasks completed today.</div>
                  )}
                </div>

                <div>
                  <h3 className="font-bold flex items-center gap-2 text-amber-600 mb-3 pb-2 border-b border-border/50">
                    <Clock className="w-5 h-5" />
                    Pending / Blocked
                  </h3>
                  {selectedRecord && selectedRecord.tasksPending.length > 0 ? (
                    <ul className="space-y-3">
                      {selectedRecord.tasksPending.map((task, i) => (
                        <li key={task.task_id || task.id || i} className="flex items-start gap-3 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                          <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-sm font-medium text-foreground">{taskLabel(task)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-xl text-center">No pending tasks! 🎉</div>
                  )}
                </div>
              </div>

              {/* Rating & Verification Section */}
              <div className="bg-muted/10 p-6 rounded-2xl border border-border/50 flex flex-col space-y-5">
                {/* Self Report Warning */}
                {selectedRecord && selectedRecord.employee_id === user?.id && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>You cannot approve your own daily progress report. An Admin or another Head must verify it.</span>
                  </div>
                )}

                {/* On Leave Warning */}
                {selectedRecord?.onLeave && (
                  <div className="bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-400 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2">
                    <Palmtree className="w-4 h-4 shrink-0 text-sky-600" />
                    <span>This employee is On Leave today. Verification and approval are blocked while employee is on leave.</span>
                  </div>
                )}

                {/* Star Rating Section (1 to 10 Scale with Half-Star Support) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                      <span>KRA-KPI Rating (1-10 Scale) <span className="text-rose-500 font-black">*</span></span>
                    </h3>
                    {(hoverRating !== null ? hoverRating : currentRating) > 0 && (
                      <span className="text-sm font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg">
                        {(hoverRating !== null ? hoverRating : currentRating)}/10
                      </span>
                    )}
                  </div>

                  {/* 5-Star Interactive Direct Picker (1 to 10 Scale with Half-Star Support) */}
                  <div className="flex items-center gap-2 p-3 bg-card border border-border/60 rounded-2xl w-fit">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const valLeft = i * 2 + 1; // 1, 3, 5, 7, 9
                      const valRight = i * 2 + 2; // 2, 4, 6, 8, 10
                      const activeScore = hoverRating !== null ? hoverRating : currentRating;
                      const isFull = activeScore >= valRight;
                      const isHalf = activeScore === valLeft;
                      const isRatingDisabled = !canManageProgress || (selectedRecord?.employee_id === user?.id) || Boolean(selectedRecord?.onLeave);

                      return (
                        <div
                          key={i}
                          className="relative inline-block w-10 h-10 select-none cursor-pointer group"
                          onMouseLeave={() => setHoverRating(null)}
                        >
                          {/* Base Empty Star */}
                          <Star className="w-10 h-10 text-muted-foreground/25 fill-transparent transition-all group-hover:scale-105" />

                          {/* Full Star Fill */}
                          {isFull && (
                            <div className="absolute inset-0 pointer-events-none">
                              <Star className="w-10 h-10 text-amber-400 fill-amber-400 drop-shadow-sm transition-all group-hover:scale-105" />
                            </div>
                          )}

                          {/* Half Star Fill */}
                          {isHalf && (
                            <div className="absolute inset-0 w-1/2 overflow-hidden pointer-events-none">
                              <Star className="w-10 h-10 text-amber-400 fill-amber-400 drop-shadow-sm transition-all group-hover:scale-105" />
                            </div>
                          )}

                          {/* Left half clickable area (odd rating: 1, 3, 5, 7, 9) */}
                          <button
                            type="button"
                            disabled={isRatingDisabled}
                            onClick={() => setCurrentRating(valLeft)}
                            onMouseEnter={() => setHoverRating(valLeft)}
                            className="absolute inset-y-0 left-0 w-1/2 cursor-pointer z-10 focus:outline-none disabled:cursor-not-allowed"
                            title={`Rate ${valLeft}/10`}
                          />

                          {/* Right half clickable area (even rating: 2, 4, 6, 8, 10) */}
                          <button
                            type="button"
                            disabled={isRatingDisabled}
                            onClick={() => setCurrentRating(valRight)}
                            onMouseEnter={() => setHoverRating(valRight)}
                            className="absolute inset-y-0 right-0 w-1/2 cursor-pointer z-10 focus:outline-none disabled:cursor-not-allowed"
                            title={`Rate ${valRight}/10`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-muted-foreground font-medium mt-1.5">
                    Click directly on the stars (left side for odd, right side for even rating 1 to 10).
                  </p>

                  {currentRating === 0 && (
                    <p className="text-xs text-rose-500 font-semibold mt-2">* Please choose a rating from 1 to 10</p>
                  )}
                </div>

                {/* Remarks textarea */}
                <div className="flex-grow flex flex-col">
                  <h3 className="font-bold flex items-center gap-2 mb-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <span>Manager Remarks <span className="text-rose-500 font-black">*</span></span>
                  </h3>
                  <textarea
                    value={currentRemarks}
                    onChange={(e) => setCurrentRemarks(e.target.value)}
                    disabled={!canManageProgress || (selectedRecord?.employee_id === user?.id) || Boolean(selectedRecord?.onLeave)}
                    placeholder="Add constructive feedback or notes about today's work (required)..."
                    className="w-full flex-grow min-h-[110px] px-4 py-3 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium resize-none disabled:opacity-70"
                  />
                  {!currentRemarks.trim() && (
                    <p className="text-xs text-rose-500 font-semibold mt-1.5">* Manager remarks note is required to verify</p>
                  )}
                </div>

                {selectedRecord?.verificationStatus === "Verified" && (
                  <div className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl text-sm font-medium flex items-center gap-2 border border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5" />
                    Verified{selectedRecord?.verifiedBy ? ` by ${selectedRecord.verifiedBy}` : ""} • KRA-KPI {selectedRecord?.rating || 0}/10
                  </div>
                )}
                {selectedRecord?.verificationStatus === "Rejected" && (
                  <div className="bg-rose-500/10 text-rose-700 dark:text-rose-400 p-4 rounded-xl text-sm font-medium flex items-center gap-2 border border-rose-500/20">
                    <X className="w-5 h-5" />
                    Rejected — reset it to send it back for review.
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Modal Footer */}
          {canManageProgress && (
          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-between gap-3 mt-auto shrink-0">
            <div>
              {selectedRecord && selectedRecord.verificationStatus !== "Pending" && (
                <button
                  onClick={handleReset}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 font-bold text-muted-foreground hover:bg-muted/50 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Pending
                </button>
              )}
            </div>
            <div className="flex gap-3">
              {(!selectedRecord || selectedRecord.verificationStatus === "Pending") && (
                <button
                  onClick={handleReject}
                  disabled={isSubmitting || Boolean(selectedRecord?.onLeave)}
                  className="px-4 py-2.5 font-bold text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Reject
                </button>
              )}
              <button
                onClick={handleVerifySubmit}
                disabled={
                  currentRating === 0 ||
                  !currentRemarks.trim() ||
                  isSubmitting ||
                  (selectedRecord?.employee_id === user?.id) ||
                  Boolean(selectedRecord?.onLeave)
                }
                title={
                  selectedRecord?.onLeave
                    ? "Cannot approve: Employee is on leave for this date"
                    : selectedRecord?.employee_id === user?.id
                      ? "You cannot approve your own report"
                      : currentRating === 0
                        ? "KRA-KPI Rating is required"
                        : !currentRemarks.trim()
                          ? "Manager remarks note is required"
                          : undefined
                }
                className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {selectedRecord?.onLeave
                  ? "Approval Blocked (On Leave)"
                  : selectedRecord?.verificationStatus === "Verified"
                    ? "Update Verification"
                    : "Approve & Verify"}
              </button>
            </div>
          </div>
          )}

        </DialogContent>
      </Dialog>

      {/* Pending List Modal */}
      <Dialog open={pendingListModalOpen} onOpenChange={setPendingListModalOpen}>
        <DialogContent className="w-[calc(100vw-16px)] sm:max-w-md max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-6 border-b border-border/50 bg-muted/10 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Pending Verifications
              </h2>
              <p className="text-sm text-muted-foreground mt-1">All reports waiting for manager review.</p>
            </div>
            <button
              onClick={() => setPendingListModalOpen(false)}
              className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            {filteredRecords.filter(r => r.verificationStatus === "Pending").map(record => (
              <div key={record.id} className="p-4 border border-border/50 rounded-xl bg-card flex justify-between items-center hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold">
                    {record.employeeName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-foreground text-sm">{record.employeeName}</div>
                    <div className="text-xs text-muted-foreground">
                      {record.date}{record.designation ? ` • ${record.designation}` : ""}{record.onLeave ? " • On Leave" : ""}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPendingListModalOpen(false);
                    handleOpenVerify(record);
                  }}
                  className="text-xs font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  {record.onLeave ? "View" : "Review"}
                </button>
              </div>
            ))}
            {filteredRecords.filter(r => r.verificationStatus === "Pending").length === 0 && (
              <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-xl">
                No pending verifications! 🎉
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
