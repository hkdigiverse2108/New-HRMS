import { useState, useMemo, useEffect, useCallback } from "react";
import { Check, X, Calendar, Clock, ChevronDown, CalendarDays, Activity, Plus, AlertCircle, RefreshCw } from "lucide-react";
import { DialogClose, Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/ui/select";
import { useSettingsContext } from "../payroll/SettingsContext";
import { useAuth } from "@/components/auth/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchInput } from "@/components/common/SearchInput";
import { formatISTDate, formatAppliedOnIST } from "@/lib/timeUtils";
import { api } from "@/lib/api";

const toLocalYMD = (d: Date | null | undefined): string => {
  if (!d || isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseYMDToDate = (str: string | null | undefined): Date | undefined => {
  if (!str) return undefined;
  const match = str.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match || !match[1] || !match[2] || !match[3]) return undefined;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  return new Date(year, month, day);
};

type LeaveStatus = "Pending" | "Approved" | "Rejected";
type DayType = "Full Day" | "First Half" | "Second Half";

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  avatar: string;
  role: string;
  department: string;
  type: string;
  dayType?: DayType | undefined;
  startDate: string;
  endDate: string;
  durationDays: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  createdAt?: string | undefined;
  isConditional?: boolean | undefined;
  rejectionReason?: string | undefined;
}

const FALLBACK_REQUESTS: LeaveRequest[] = [
  {
    id: "LR-001",
    employeeId: "EMP-012",
    employeeName: "Sneha Rao",
    avatar: "https://i.pravatar.cc/150?u=sneha",
    role: "UX Designer",
    department: "Design",
    type: "Sick Leave",
    dayType: "Full Day",
    startDate: "2026-08-14",
    endDate: "2026-08-15",
    durationDays: 2,
    reason: "Fever and cold, doctor advised rest.",
    status: "Pending",
    appliedOn: "2026-08-10",
  },
  {
    id: "LR-002",
    employeeId: "EMP-004",
    employeeName: "David Chen",
    avatar: "https://i.pravatar.cc/150?u=david",
    role: "Product Manager",
    department: "Product",
    type: "Annual Leave",
    dayType: "Full Day",
    startDate: "2026-09-01",
    endDate: "2026-09-07",
    durationDays: 5,
    reason: "Family vacation to Hawaii.",
    status: "Pending",
    appliedOn: "2026-08-09",
  },
  {
    id: "LR-003",
    employeeId: "EMP-028",
    employeeName: "Amit Patel",
    avatar: "https://i.pravatar.cc/150?u=amit",
    role: "Frontend Developer",
    department: "Engineering",
    type: "Casual Leave",
    dayType: "First Half",
    startDate: "2026-08-18",
    endDate: "2026-08-18",
    durationDays: 0.5,
    reason: "Personal errands in the morning.",
    status: "Pending",
    appliedOn: "2026-08-08",
  },
  {
    id: "LR-005",
    employeeId: "EMP-005",
    employeeName: "Elena Rodriguez",
    avatar: "https://i.pravatar.cc/150?u=elena",
    role: "HR Manager",
    department: "Human Resources",
    type: "Annual Leave",
    dayType: "Full Day",
    startDate: "2026-07-20",
    endDate: "2026-07-24",
    durationDays: 5,
    reason: "Summer vacation.",
    status: "Approved",
    appliedOn: "2026-07-01",
  },
  {
    id: "LR-006",
    employeeId: "EMP-019",
    employeeName: "Vikram Singh",
    avatar: "https://i.pravatar.cc/150?u=vikram",
    role: "Backend Engineer",
    department: "Engineering",
    type: "Monthly Leave",
    dayType: "Full Day",
    startDate: "2026-08-01",
    endDate: "2026-08-02",
    durationDays: 2,
    reason: "Extended travel delay.",
    status: "Rejected",
    appliedOn: "2026-07-28",
    rejectionReason: "Critical project deadline during this window.",
  },
];

const LEAVE_TYPE_OPTIONS = ["Annual Leave", "Sick Leave", "Casual Leave", "Monthly Leave"];

const getLeaveTypeColor = (type: string) => {
  switch (type) {
    case "Sick Leave":
      return "text-rose-600 bg-rose-50 border-rose-100";
    case "Casual Leave":
      return "text-amber-600 bg-amber-50 border-amber-100";
    case "Annual Leave":
      return "text-primary bg-primary/10 border-indigo-100";
    case "Monthly Leave":
      return "text-blue-600 bg-blue-50 border-blue-100";
    default:
      return "text-teal-600 bg-teal-50 border-teal-100";
  }
};

const getLeaveTypeIcon = (type: string) => {
  switch (type) {
    case "Sick Leave":
      return <Activity className="w-3.5 h-3.5" />;
    case "Casual Leave":
      return <Clock className="w-3.5 h-3.5" />;
    case "Annual Leave":
      return <CalendarDays className="w-3.5 h-3.5" />;
    case "Monthly Leave":
      return <Calendar className="w-3.5 h-3.5" />;
    default:
      return <Calendar className="w-3.5 h-3.5" />;
  }
};

export function LeaveRequests({ isNew }: { isNew?: boolean }) {
  const { leaveTypes } = useSettingsContext();
  const { user } = useAuth();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<LeaveStatus>("Pending");
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(isNew || false);

  // Rejection dialog state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState("");

  // New leave form state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employeeOptions, setEmployeeOptions] = useState<
    Array<{ id: string; name: string; role: string; department: string; email: string }>
  >([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [newLeaveType, setNewLeaveType] = useState<string>("Sick Leave");
  const [newDayType, setNewDayType] = useState<DayType>("Full Day");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newIsConditional, setNewIsConditional] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdminOrHR = user?.role === "Admin" || user?.role === "HR";

  // Fetch employees excluding Admin
  const fetchEmployeeOptions = useCallback(async () => {
    try {
      setIsLoadingEmployees(true);
      const res = await api.get<{ data?: any[] } | any[]>("/employees?exclude_role=Admin", {
        showLoader: false,
        showErrorToast: false,
      });
      const rawList = Array.isArray(res) ? res : (res?.data || []);
      const mapped = rawList.map((emp: any) => {
        const personal = emp.personal_info || {};
        const work = emp.work_details || {};
        const name = `${personal.first_name || ""} ${personal.last_name || ""}`.trim() || emp.name || "Employee";
        return {
          id: String(emp.id || emp._id || ""),
          name,
          role: work.designation || work.system_role || emp.role || "Employee",
          department: work.department || emp.department || "General",
          email: personal.email_address || emp.email || "",
        };
      });
      setEmployeeOptions(mapped);
      if (mapped.length > 0) {
        setSelectedEmployeeId((prev) => {
          if (prev && mapped.some((m) => m.id === prev)) return prev;
          const self = mapped.find((m) => m.id === user?.id || m.email === user?.email);
          return self ? self.id : (mapped[0]?.id || "");
        });
      }
    } catch (err) {
      console.error("Failed to load employees for leave request", err);
    } finally {
      setIsLoadingEmployees(false);
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (isAddOpen) {
      fetchEmployeeOptions();
    }
  }, [isAddOpen, fetchEmployeeOptions]);

  // Fetch leaves from backend filtered by status directly
  const fetchLeaves = useCallback(
    async (tabStatus: LeaveStatus = activeTab) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        params.append("status", tabStatus);
        if (!isAdminOrHR && user?.id) {
          params.append("employee_id", user.id);
        }

        const data = await api.get<any[]>(`/leaves?${params.toString()}`, {
          showLoader: false,
          showErrorToast: false,
        });

        if (Array.isArray(data)) {
          const mapped: LeaveRequest[] = data.map((item) => ({
            id: item.id || `LR-${Math.random()}`,
            employeeId: item.employee_id || "",
            employeeName: item.employee_name || "Employee",
            avatar: item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.employee_name || "E")}&background=random`,
            role: item.role || "Staff",
            department: item.department || "General",
            type: item.leave_type || "Sick Leave",
            dayType: (item.day_type as DayType) || "Full Day",
            startDate: item.start_date || "",
            endDate: item.end_date || "",
            durationDays: item.duration_days ?? 1,
            reason: item.reason || "",
            status: (item.status as LeaveStatus) || tabStatus,
            appliedOn: item.applied_on ? item.applied_on.split("T")[0] : "",
            createdAt: item.created_at || item.applied_on || "",
            isConditional: item.day_type === "First Half" || item.day_type === "Second Half",
            rejectionReason: item.rejection_reason || undefined,
          }));
          setRequests(mapped);
          if (tabStatus === "Pending") {
            setPendingCount(mapped.length);
          }
        } else {
          const fallback = !isAdminOrHR && user
            ? FALLBACK_REQUESTS.filter((r) => r.status === tabStatus && (r.employeeName.toLowerCase().includes("current") || r.employeeId === user.id))
            : FALLBACK_REQUESTS.filter((r) => r.status === tabStatus);
          setRequests(fallback);
        }
      } catch {
        const fallback = FALLBACK_REQUESTS.filter((r) => r.status === tabStatus);
        setRequests(fallback);
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, isAdminOrHR, activeTab]
  );

  const fetchPendingCount = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: "Pending" });
      if (!isAdminOrHR && user?.id) {
        params.append("employee_id", user.id);
      }
      const data = await api.get<any[]>(`/leaves?${params.toString()}`, {
        showLoader: false,
        showErrorToast: false,
      });
      if (Array.isArray(data)) {
        setPendingCount(data.length);
      }
    } catch {
      // ignore
    }
  }, [isAdminOrHR, user?.id]);

  useEffect(() => {
    fetchLeaves(activeTab);
  }, [activeTab, fetchLeaves]);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  // Handle status actions: Approved, Rejected, Pending
  const handleAction = async (id: string, action: "Approved" | "Rejected" | "Pending", isConditional?: boolean, reasonText?: string) => {
    try {
      await api.patch(`/leaves/${id}/status`, {
        status: action,
        rejection_reason: action === "Rejected" ? (reasonText || "Not approved by management") : undefined,
      });

      if (action !== activeTab) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
      } else {
        setRequests((prev) =>
          prev.map((r) => {
            if (r.id !== id) return r;
            return {
              ...r,
              status: action,
              isConditional: isConditional !== undefined ? isConditional : r.isConditional,
              rejectionReason: action === "Rejected" ? reasonText : undefined,
            };
          })
        );
      }

      fetchPendingCount();
      fetchLeaves(activeTab);

      if (action === "Approved") {
        toast.success("Leave approved! Attendance records auto-synced to 'On Leave'.");
      } else if (action === "Rejected") {
        toast.success("Leave request rejected.");
      } else {
        toast.success("Leave request reverted to pending for review.");
      }
    } catch (err: any) {
      // Local optimistic update fallback
      setRequests((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          return {
            ...r,
            status: action,
            isConditional: isConditional !== undefined ? isConditional : r.isConditional,
            rejectionReason: action === "Rejected" ? reasonText : undefined,
          };
        })
      );
      toast.success(`Leave request marked as ${action.toLowerCase()}`);
    }
  };

  const handleConfirmReject = () => {
    if (!rejectingId) return;
    handleAction(rejectingId, "Rejected", false, rejectionReasonText || "Reason unspecified");
    setRejectingId(null);
    setRejectionReasonText("");
  };

  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStartDate || (!newEndDate && newDayType === "Full Day") || !newReason) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!selectedEmployeeId && employeeOptions.length > 0) {
      toast.error("Please select an employee");
      return;
    }

    const effectiveEndDate = newDayType !== "Full Day" ? newStartDate : newEndDate || newStartDate;

    let durationDays = 1;
    if (newDayType === "First Half" || newDayType === "Second Half") {
      durationDays = 0.5;
    } else {
      const start = new Date(newStartDate);
      const end = new Date(effectiveEndDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        employee_id: selectedEmployeeId || user?.id,
        leave_type: newLeaveType,
        day_type: newDayType,
        start_date: newStartDate,
        end_date: effectiveEndDate,
        duration_days: durationDays,
        reason: newReason,
        remarks: newIsConditional ? "Work from home requested" : undefined,
      };

      const res = await api.post<any>("/leaves", payload);

      toast.success("Leave request submitted successfully (Pending review)");
      setIsAddOpen(false);
      fetchLeaves(activeTab);
      fetchPendingCount();
    } catch (err: any) {
      // Fallback optimistic addition
      const targetEmp = employeeOptions.find((e) => e.id === selectedEmployeeId);
      const optimistic: LeaveRequest = {
        id: `LR-${Math.random().toString(36).substr(2, 9)}`,
        employeeId: selectedEmployeeId || user?.id || "EMP-CURRENT",
        employeeName: targetEmp?.name || user?.name || "Current User",
        avatar: user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(targetEmp?.name || "E")}&background=random`,
        role: targetEmp?.role || user?.role || "Software Engineer",
        department: targetEmp?.department || user?.department || "Engineering",
        type: newLeaveType,
        dayType: newDayType,
        startDate: newStartDate,
        endDate: effectiveEndDate,
        durationDays,
        reason: newReason,
        status: "Pending",
        appliedOn: toLocalYMD(new Date()),
        createdAt: new Date().toISOString(),
        isConditional: newIsConditional,
      };
      if (activeTab === "Pending") {
        setRequests((prev) => [optimistic, ...prev]);
      }
      setPendingCount((prev) => prev + 1);
      setIsAddOpen(false);
      toast.success("Leave request submitted successfully (Pending review)");
    } finally {
      setIsSubmitting(false);
      // Reset form
      setNewLeaveType("Sick Leave");
      setNewDayType("Full Day");
      setNewStartDate("");
      setNewEndDate("");
      setNewReason("");
      setNewIsConditional(false);
    }
  };

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(
      (r) =>
        r.employeeName.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
    );
  }, [requests, searchQuery]);

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Leave Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Apply for leaves and track approval status in IST</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search employee, dept or type..."
            containerClassName="w-full sm:w-64"
          />

          <button
            onClick={() => fetchLeaves()}
            title="Refresh leaves"
            className="p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 shadow-sm transition-colors self-center sm:self-auto"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin text-primary")} />
          </button>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <button className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition-all shrink-0">
                <Plus className="w-4 h-4" /> Apply Leave
              </button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-20px)] sm:w-full sm:max-w-[480px] p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card box-border">
              <div className="flex items-center justify-between px-3.5 sm:px-6 py-3.5 sm:py-5 border-b border-border/50 bg-muted/30">
                <div className="min-w-0 pr-2">
                  <h2 className="text-base sm:text-xl font-black tracking-tight truncate">Apply for Leave</h2>
                  <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Requests default to Pending review</p>
                </div>
                <DialogClose asChild>
                  <button className="p-1.5 sm:p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </DialogClose>
              </div>

              <form onSubmit={handleAddLeave} className="flex flex-col max-h-[80vh]">
                <div className="p-3.5 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto max-h-[65vh]">
                  {/* Select Employee */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                      Employee <span className="text-rose-500">*</span>
                    </label>
                    <SearchableSelect
                      value={selectedEmployeeId}
                      onChange={setSelectedEmployeeId}
                      options={employeeOptions.map((emp) => ({
                        label: `${emp.name} (${emp.role}${emp.department ? ` • ${emp.department}` : ""})`,
                        value: emp.id,
                      }))}
                      placeholder={isLoadingEmployees ? "Loading non-admin employees..." : "Select Employee"}
                      className="w-full px-3 sm:px-4 h-[42px] sm:h-[44px] bg-muted/50 border border-border/50 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>

                  {/* Leave Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Leave Type</label>
                    <SearchableSelect
                      value={newLeaveType}
                      onChange={setNewLeaveType}
                      options={LEAVE_TYPE_OPTIONS.map((type) => ({ label: type, value: type }))}
                      className="w-full px-3 sm:px-4 h-[42px] sm:h-[44px] bg-muted/50 border border-border/50 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>

                  {/* Day Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Day Type</label>
                    <div className="grid grid-cols-3 gap-1 sm:gap-2">
                      {(["Full Day", "First Half", "Second Half"] as DayType[]).map((dtype) => (
                        <button
                          key={dtype}
                          type="button"
                          onClick={() => setNewDayType(dtype)}
                          className={cn(
                            "py-2 px-0.5 sm:px-2 text-[10px] sm:text-xs font-bold rounded-xl border transition-all text-center whitespace-nowrap leading-tight",
                            newDayType === dtype
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted/30 text-foreground/80 border-border hover:bg-muted/60"
                          )}
                        >
                          {dtype}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Range or Single Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                      {newDayType === "Full Day" ? "Date Range (IST)" : "Leave Date (IST)"}
                    </label>
                    {newDayType === "Full Day" ? (
                      <DateRangeFilter
                        value={{
                          from: parseYMDToDate(newStartDate),
                          to: parseYMDToDate(newEndDate),
                        }}
                        onChange={(range) => {
                          const fromStr = range?.from ? toLocalYMD(range.from) : "";
                          const toStr = range?.to ? toLocalYMD(range.to) : fromStr;
                          setNewStartDate(fromStr || "");
                          setNewEndDate(toStr || "");
                        }}
                        placeholder="Select start and end date"
                        className="w-full h-[42px] sm:h-[44px] justify-between text-xs sm:text-sm px-3 sm:px-3.5"
                        align="center"
                      />
                    ) : (
                      <DatePicker
                        value={newStartDate}
                        onChange={(dateStr) => {
                          setNewStartDate(dateStr);
                          setNewEndDate(dateStr);
                        }}
                        placeholder="Select leave date"
                        displayFormat="MMM dd, yyyy"
                        className="w-full h-[42px] sm:h-[44px] text-xs sm:text-sm px-3 sm:px-3.5"
                        align="center"
                      />
                    )}
                  </div>

                  {/* Reason */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Reason</label>
                    <textarea
                      required
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      placeholder="Briefly describe the reason for taking leave..."
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-muted/50 border border-border/50 rounded-xl text-xs sm:text-sm min-h-[80px] sm:min-h-[90px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-foreground"
                    />
                  </div>

                  {/* Optional WFH flag */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="conditionalLeave"
                      checked={newIsConditional}
                      onChange={(e) => setNewIsConditional(e.target.checked)}
                      className="w-4 h-4 text-primary rounded border-border/50 focus:ring-primary/20 cursor-pointer shrink-0"
                    />
                    <label htmlFor="conditionalLeave" className="text-[11px] sm:text-xs font-bold text-muted-foreground cursor-pointer uppercase tracking-wider select-none">
                      Work From Home request
                    </label>
                  </div>
                </div>

                <div className="px-3 sm:px-6 py-3 sm:py-4 bg-muted/30 border-t border-border/50 flex items-center justify-end gap-1.5 sm:gap-3 mt-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-muted-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3 sm:px-5 py-2 bg-primary text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all disabled:opacity-50 shrink-0 whitespace-nowrap"
                  >
                    {isSubmitting ? "Submitting..." : (
                      <>
                        <span className="sm:hidden">Submit Request</span>
                        <span className="hidden sm:inline">Submit Leave Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["Pending", "Approved", "Rejected"] as LeaveStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setActiveTab(status)}
            className={cn(
              "px-6 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors relative",
              activeTab === status
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground/80 hover:border-border"
            )}
          >
            {status}
            {status === "Pending" && pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Request Grid */}
      <div className="flex-1 overflow-auto pb-6">
        {filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-3xl border border-dashed border-border p-6 text-center">
            <div className="w-14 h-14 bg-card rounded-full flex items-center justify-center shadow-sm mb-3 border border-border">
              <CalendarDays className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-foreground font-bold text-base">No {activeTab.toLowerCase()} requests</h3>
            <p className="text-muted-foreground text-xs mt-1">There are currently no leaves in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRequests.map((request) => (
              <div
                key={request.id}
                className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden flex flex-col justify-between"
              >
                {/* Top header */}
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={request.avatar}
                        alt={request.employeeName}
                        className="w-11 h-11 rounded-full object-cover border border-border shadow-sm shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground leading-tight truncate">{request.employeeName}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {request.role} • {request.department}
                        </p>
                      </div>
                    </div>
                    <div className={cn("px-2.5 py-1 rounded-full border text-[11px] font-bold flex items-center gap-1 shrink-0", getLeaveTypeColor(request.type))}>
                      {getLeaveTypeIcon(request.type)}
                      <span>{request.type}</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2.5 bg-muted/30 rounded-xl p-3.5 border border-border/50 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-foreground/80 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>
                          {formatISTDate(request.startDate, "DD MMM YYYY")}
                          {request.startDate !== request.endDate && ` - ${formatISTDate(request.endDate, "DD MMM YYYY")}`}
                        </span>
                      </div>
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-black">
                        {request.durationDays} {request.durationDays === 1 ? "Day" : "Days"}
                        {request.dayType && request.dayType !== "Full Day" && ` (${request.dayType})`}
                      </span>
                    </div>

                    <div className="flex items-start gap-2 pt-1 border-t border-border/40">
                      <p className="text-xs text-foreground/85 italic line-clamp-2 leading-relaxed">
                        "{request.reason}"
                      </p>
                    </div>

                    {request.rejectionReason && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200/60 text-[11px] text-rose-700 font-medium">
                        <span className="font-bold block text-[10px] uppercase">Rejection Reason:</span>
                        {request.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Applied on {formatAppliedOnIST(request.createdAt || request.appliedOn)}
                  </p>

                  {/* Role-based action buttons: Admin / HR can Approve or Reject */}
                  {isAdminOrHR ? (
                    request.status === "Pending" ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setRejectingId(request.id)}
                          className="px-2.5 py-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          title="Reject Leave"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          onClick={() => handleAction(request.id, "Approved")}
                          className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                          title="Approve Leave"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-1 hover:bg-muted/50 px-2 py-1 rounded-lg transition-colors text-xs font-bold">
                            <span
                              className={cn(
                                "px-2.5 py-0.5 rounded text-[11px] font-black",
                                request.status === "Approved" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                              )}
                            >
                              {request.status}
                            </span>
                            <ChevronDown className="w-3 h-3 opacity-50" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[190px] rounded-xl p-1.5 shadow-xl border-border/60">
                          <DropdownMenuItem
                            onClick={() => handleAction(request.id, "Approved")}
                            className="text-emerald-600 font-medium cursor-pointer rounded-lg mb-1"
                          >
                            <Check className="w-4 h-4 mr-2" /> Mark Approved
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setRejectingId(request.id)}
                            className="text-rose-600 font-medium cursor-pointer rounded-lg mb-1"
                          >
                            <X className="w-4 h-4 mr-2" /> Mark Rejected
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleAction(request.id, "Pending")}
                            className="text-amber-600 font-medium cursor-pointer rounded-lg"
                          >
                            <Activity className="w-4 h-4 mr-2" /> Revert to Pending
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  ) : (
                    /* Regular employee view-only badge */
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded text-[11px] font-black",
                        request.status === "Approved"
                          ? "bg-emerald-50 text-emerald-600"
                          : request.status === "Rejected"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-amber-50 text-amber-600"
                      )}
                    >
                      {request.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      <Dialog open={!!rejectingId} onOpenChange={(open) => !open && setRejectingId(null)}>
        <DialogContent className="w-full max-w-[calc(100vw-24px)] sm:max-w-[420px] p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-rose-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Reject Leave Request</h3>
                <p className="text-xs text-muted-foreground">Provide feedback to employee</p>
              </div>
            </div>
            <DialogClose asChild>
              <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Reason for Rejection</label>
              <textarea
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                placeholder="e.g. Critical deployment window, please reschedule..."
                className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm min-h-[90px] resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-foreground font-medium"
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-2.5">
            <button
              onClick={() => setRejectingId(null)}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReject}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all"
            >
              Confirm Rejection
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

