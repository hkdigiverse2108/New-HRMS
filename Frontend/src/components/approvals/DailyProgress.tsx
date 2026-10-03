import { useState, useEffect, useCallback } from "react";
import { Search, Filter, CheckCircle2, Clock, X, Star, AlertCircle, MessageSquare, Activity, Palmtree, RotateCcw, Loader2 } from "lucide-react";
import { DialogClose, Dialog, DialogContent } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/components/auth/AuthContext";
import { hasModulePermission, isUserAdmin } from "@/lib/permissions";

type VerificationStatus = "Pending" | "Verified" | "Rejected";

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

export function DailyProgress() {
  const { user } = useAuth();
  const anyUser = user as any;
  const userDept = String(anyUser?.department || anyUser?.work_details?.department || "").toLowerCase();
  const userRole = String(anyUser?.role || anyUser?.work_details?.system_role || (userDept === "hr" ? "hr" : "Employee")).toLowerCase();

  const canReadProgress = isUserAdmin(user) || userDept === "hr" || hasModulePermission(user, "/approvals/daily-progress", "read") || hasModulePermission(user, "/daily-progress", "read");
  const canManageProgress = isUserAdmin(user) || userDept === "hr" || hasModulePermission(user, "/approvals/daily-progress", "update") || hasModulePermission(user, "/daily-progress", "update") || hasModulePermission(user, "/approvals/daily-progress", "all");
  const isAdminOrHr = canReadProgress || canManageProgress;

  const [search, setSearch] = useState("");
  // Default = TODAY
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "All">("All");
  const [employeeFilter, setEmployeeFilter] = useState<string>("All");
  const [departmentFilter, setDepartmentFilter] = useState<string>("All");
  const [employeeOptions, setEmployeeOptions] = useState<{ label: string; value: string }[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<{ label: string; value: string }[]>([]);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [avgRating, setAvgRating] = useState<string>("N/A");

  // Load employee & department list for filters
  useEffect(() => {
    if (!isAdminOrHr) return;
    const loadFilters = async () => {
      try {
        const res = await api.get<any>("/employees?exclude_role=Admin", { showLoader: false, showErrorToast: false });
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const nonAdminList = list.filter((e: any) => {
          const role = String(e.work_details?.system_role || e.role || "").toLowerCase().trim();
          return role !== "admin";
        });
        const emps = nonAdminList.map((e: any) => {
          const p = e.personal_info || {};
          const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || e.name || "Employee";
          const id = String(e._id || e.id || "");
          return { label: name, value: id };
        }).filter((e: any) => e.value);
        setEmployeeOptions([{ label: "All Employees", value: "All" }, ...emps]);

        const depts = new Set<string>();
        list.forEach((e: any) => {
          const d = e.work_details?.department || e.department;
          if (d && typeof d === "string") depts.add(d.trim());
        });
        const deptOpts = Array.from(depts).filter(Boolean).sort().map(d => ({ label: d, value: d }));
        setDepartmentOptions([{ label: "All Departments / Heads", value: "All" }, ...deptOpts]);
      } catch {}
    };
    loadFilters();
  }, [isAdminOrHr]);

  // Modal State
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [pendingListModalOpen, setPendingListModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DailyRecord | null>(null);
  const [currentRating, setCurrentRating] = useState<number>(0); // stars 1-5 → KRA-KPI = x*2 /10
  const [currentRemarks, setCurrentRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (!isAdminOrHr) {
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
      setRecords(list.map(mapRecord));
    } catch (err: any) {
      toast.error(err?.message || "Failed to load daily progress");
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, startDate, endDate, employeeFilter, departmentFilter, isAdminOrHr]);

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

  const filteredRecords = records.filter(rec => {
    if (!isAdminOrHr && rec.employee_id !== user?.id) return false;
    const matchesSearch = rec.employeeName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || rec.verificationStatus === statusFilter;
    const matchesEmp = employeeFilter === "All" || rec.employee_id === employeeFilter;
    const matchesDept = departmentFilter === "All" || rec.department.toLowerCase() === departmentFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesEmp && matchesDept;
  });

  const pendingCount = records.filter(r => r.verificationStatus === "Pending").length;
  const verifiedCount = records.filter(r => r.verificationStatus === "Verified").length;

  const handleOpenVerify = (record: DailyRecord) => {
    setSelectedRecord(record);
    setCurrentRating(Math.round((record.rating || 0) / 2));
    setCurrentRemarks(record.managerRemarks || "");
    setVerifyModalOpen(true);
  };

  const refreshAfter = async () => {
    await fetchRecords();
    await fetchStats();
  };

  const handleVerifySubmit = async () => {
    if (!selectedRecord || currentRating === 0 || !currentRemarks.trim()) {
      toast.error("Both KRA-KPI Rating and Manager Remarks are required.");
      return;
    }
    if (selectedRecord.employee_id === user?.id) {
      toast.error("You cannot approve your own daily progress report.");
      return;
    }
    setIsSubmitting(true);
    try {
      // KRA-KPI: stars(1-5) → rating /10
      await api.put(`/daily-progress/${selectedRecord.id}/approve`, {
        rating: currentRating * 2,
        remarks: currentRemarks.trim(),
      });
      toast.success("Verified with KRA-KPI rating");
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
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary" />
            Daily Progress Hub
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Track daily work, verify completed tasks, and provide KRA-KPI ratings.
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1">Total Reports</div>
          <div className="text-4xl font-black">{records.length}</div>
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
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Avg KRA-KPI Rating</div>
          <div className="text-4xl font-black text-emerald-700 flex items-end gap-2">
            {avgRating} <Star className="w-6 h-6 text-emerald-500 mb-1 fill-emerald-500" />
          </div>
        </div>
      </div>

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
          {isAdminOrHr && (
            <>
              <div className="relative w-full sm:w-[170px]">
                <SearchableSelect
                  value={employeeFilter}
                  onChange={(val) => setEmployeeFilter(val)}
                  options={employeeOptions.length > 0 ? employeeOptions : [{ label: "All Employees", value: "All" }]}
                  className="w-full h-[42px] bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-bold cursor-pointer"
                />
              </div>
              <div className="relative w-full sm:w-[190px]">
                <SearchableSelect
                  value={departmentFilter}
                  onChange={(val) => setDepartmentFilter(val)}
                  options={departmentOptions.length > 0 ? departmentOptions : [{ label: "All Departments / Heads", value: "All" }]}
                  className="w-full h-[42px] bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-bold cursor-pointer"
                />
              </div>
            </>
          )}
          <DatePicker
            value={startDate}
            onChange={(val) => setStartDate(val)}
            placeholder="Start date"
            className="w-full sm:w-[135px]"
          />
          <span className="text-muted-foreground text-sm font-bold">to</span>
          <DatePicker
            value={endDate}
            onChange={(val) => setEndDate(val)}
            placeholder="End date"
            className="w-full sm:w-[135px]"
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
                    <div className="text-xs text-muted-foreground">{record.department}</div>
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
                <div className="flex items-center gap-1 text-emerald-500 font-black" title={`KRA-KPI ${record.rating || 0}/10`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn("w-4 h-4", i < Math.round((record.rating || 0) / 2) ? "fill-emerald-500 text-emerald-500" : "fill-transparent text-emerald-500/30")}
                    />
                  ))}
                  <span className="text-[10px] ml-1">{record.rating || 0}/10</span>
                </div>
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
                    ? (record.employee_id === user?.id
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : "bg-primary/10 hover:bg-primary/20 text-primary")
                    : "bg-muted/50 hover:bg-muted text-foreground"
                )}
              >
                {record.verificationStatus === "Pending"
                  ? (record.employee_id === user?.id ? "Self Report" : "Verify & Rate")
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
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">

          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                {selectedRecord?.employeeName.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold">{selectedRecord?.employeeName}</h2>
                <p className="text-sm text-muted-foreground">{selectedRecord?.department} • {selectedRecord?.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedRecord?.onLeave && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase border bg-sky-500/10 text-sky-600 border-sky-500/20">
                  <Palmtree className="w-3 h-3" /> On Leave
                </span>
              )}
              <DialogClose asChild>
                <button className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
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
                {selectedRecord && selectedRecord.employee_id === user?.id && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>You cannot approve or verify your own daily progress report. An Admin or another Head must verify it.</span>
                  </div>
                )}

                <div>
                  <h3 className="font-bold flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-primary" />
                    <span>KRA-KPI Rating <span className="text-rose-500 font-black">*</span></span>
                  </h3>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        disabled={!isAdminOrHr || (selectedRecord?.employee_id === user?.id)}
                        onClick={() => setCurrentRating(i + 1)}
                        className={cn(
                          "p-2 rounded-xl transition-all hover:scale-110 disabled:cursor-default disabled:hover:scale-100",
                          currentRating > i
                            ? "text-emerald-500 bg-emerald-500/10"
                            : "text-muted-foreground bg-muted/50 hover:bg-muted"
                        )}
                      >
                        <Star className={cn("w-8 h-8", currentRating > i ? "fill-emerald-500" : "")} />
                      </button>
                    ))}
                  </div>
                  {currentRating > 0 ? (
                    <p className="text-sm font-bold text-emerald-600 mt-2">
                      KRA-KPI {currentRating * 2}/10
                    </p>
                  ) : (
                    <p className="text-xs text-rose-500 font-semibold mt-2">* Please choose a star rating (1-5 stars)</p>
                  )}
                </div>

                <div className="flex-grow flex flex-col">
                  <h3 className="font-bold flex items-center gap-2 mb-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <span>Manager Remarks <span className="text-rose-500 font-black">*</span></span>
                  </h3>
                  <textarea
                    value={currentRemarks}
                    onChange={(e) => setCurrentRemarks(e.target.value)}
                    disabled={!isAdminOrHr || (selectedRecord?.employee_id === user?.id)}
                    placeholder="Add constructive feedback or notes about today's work (required)..."
                    className="w-full flex-grow min-h-[110px] px-4 py-3 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium resize-none disabled:opacity-70"
                  />
                  {!currentRemarks.trim() && (
                    <p className="text-xs text-rose-500 font-semibold mt-1.5">* Manager remarks note is required to verify</p>
                  )}
                </div>

                {selectedRecord?.verificationStatus === "Verified" && (
                  <div className="bg-emerald-500/10 text-emerald-700 p-4 rounded-xl text-sm font-medium flex items-center gap-2 border border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5" />
                    Verified{selectedRecord?.verifiedBy ? ` by ${selectedRecord.verifiedBy}` : ""} • KRA-KPI {selectedRecord?.rating || 0}/10
                  </div>
                )}
                {selectedRecord?.verificationStatus === "Rejected" && (
                  <div className="bg-rose-500/10 text-rose-700 p-4 rounded-xl text-sm font-medium flex items-center gap-2 border border-rose-500/20">
                    <X className="w-5 h-5" />
                    Rejected — reset it to send it back for review.
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Modal Footer (Governed by Employee-wise & Preset Permissions) */}
          {canManageProgress && (
          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-between gap-3 mt-auto shrink-0">
            <div>
              {selectedRecord && selectedRecord.verificationStatus !== "Pending" && (
                <button
                  onClick={handleReset}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 font-bold text-muted-foreground hover:bg-muted/50 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
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
                  disabled={isSubmitting}
                  className="px-4 py-2.5 font-bold text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              )}
              <button
                onClick={handleVerifySubmit}
                disabled={currentRating === 0 || !currentRemarks.trim() || isSubmitting || (selectedRecord?.employee_id === user?.id)}
                title={
                  selectedRecord?.employee_id === user?.id
                    ? "You cannot approve your own report"
                    : currentRating === 0
                      ? "KRA-KPI Rating is required"
                      : !currentRemarks.trim()
                        ? "Manager remarks note is required"
                        : undefined
                }
                className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {selectedRecord?.verificationStatus === "Verified" ? "Update Verification" : "Approve & Verify"}
              </button>
            </div>
          </div>
          )}

        </DialogContent>
      </Dialog>

      {/* Pending List Modal */}
      <Dialog open={pendingListModalOpen} onOpenChange={setPendingListModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
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
              className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            {records.filter(r => r.verificationStatus === "Pending").map(record => (
              <div key={record.id} className="p-4 border border-border/50 rounded-xl bg-card flex justify-between items-center hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold">
                    {record.employeeName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-foreground text-sm">{record.employeeName}</div>
                    <div className="text-xs text-muted-foreground">{record.date}{record.onLeave ? " • On Leave" : ""}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPendingListModalOpen(false);
                    handleOpenVerify(record);
                  }}
                  className="text-xs font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                >
                  Review
                </button>
              </div>
            ))}
            {records.filter(r => r.verificationStatus === "Pending").length === 0 && (
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
