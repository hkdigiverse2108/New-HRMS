import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  X, Search, AlertTriangle, MessageSquareWarning, ShieldAlert, 
  Plus, IndianRupee, Trophy, Trash2, RefreshCw, Loader2, Calendar
} from "lucide-react";
import { DialogClose, Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthContext";

type RecordType = "Penalty" | "Warning";
type RecordStatus = "Active" | "Resolved" | "Waived";

interface PenaltyRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  avatar: string;
  role: string;
  department: string;
  penalty_type_id: string;
  penalty_type_name: string;
  reason: string;
  price: number;
  is_warning: boolean;
  status: RecordStatus;
  resolution_reason?: string | null | undefined;
  impact_payroll: boolean;
  penalty_date?: string | undefined;
  created_at?: string | undefined;
}

interface PenaltyType {
  id: string;
  _id?: string;
  name: string;
  default_price: number;
  warning_limit: number;
  description?: string;
}

interface PenaltySummary {
  active_penalties_count: number;
  total_payroll_deductions: number;
  max_violations_employee: string;
  max_violations_count: number;
  max_penalty_employee: string;
  max_penalty_amount: number;
}

interface LeaderboardItem {
  employee_id: string;
  employee_name: string;
  avatar: string;
  role: string;
  department: string;
  total_violations: number;
  total_penalty_amount: number;
}

interface EmployeeOption {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
}

export function Penalties() {
  const { user } = useAuth();
  const isAdminOrHr = ["Admin", "Subadmin", "HR"].includes(user?.role || "");

  // Main Data States
  const [records, setRecords] = useState<PenaltyRecord[]>([]);
  const [penaltyTypes, setPenaltyTypes] = useState<PenaltyType[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [summary, setSummary] = useState<PenaltySummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<{
    top_by_violations: LeaderboardItem[];
    top_by_amount: LeaderboardItem[];
  }>({ top_by_violations: [], top_by_amount: [] });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [activeTab, setActiveTab] = useState<"All" | RecordType>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | RecordStatus>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("All");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All");
  const [leaderboardSort, setLeaderboardSort] = useState<"violations" | "amount">("violations");
  const [leaderboardMonth, setLeaderboardMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // New Record Modal State
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newType, setNewType] = useState<RecordType>("Penalty");
  const [newEmpId, setNewEmpId] = useState("");
  const [newTypeId, setNewTypeId] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newImpact, setNewImpact] = useState(true);
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Waive / Resolve Dialog State
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<"Waived" | "Resolved">("Resolved");
  const [updateRecordId, setUpdateRecordId] = useState<string | null>(null);
  const [updateReason, setUpdateReason] = useState("");

  // Edit Amount Dialog State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  // Delete Confirm State
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Fetch Penalties, Types, Summary, and Leaderboard
  const fetchPenaltiesData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      // 1. Fetch Penalties List
      const penaltyRes = await api.get<{ data?: any[]; total?: number }>("/penalties?limit=200", {
        showLoader: false,
        showErrorToast: false
      });
      const rawRecords = penaltyRes?.data || [];
      const mappedRecords: PenaltyRecord[] = rawRecords.map((r: any) => ({
        id: r.id || r._id,
        employee_id: r.employee_id,
        employee_name: r.employee_name || "Employee",
        avatar: r.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.employee_name || "Employee")}`,
        role: r.role || "Team Member",
        department: r.department || "General",
        penalty_type_id: r.penalty_type_id,
        penalty_type_name: r.penalty_type_name || "Penalty",
        reason: r.reason || "No details provided",
        price: typeof r.price === "number" ? r.price : 0,
        is_warning: !!r.is_warning,
        status: (r.status as RecordStatus) || "Active",
        resolution_reason: r.resolution_reason || null,
        impact_payroll: r.impact_payroll !== undefined ? !!r.impact_payroll : (!r.is_warning && r.price > 0),
        penalty_date: r.penalty_date ? String(r.penalty_date).split("T")[0] : "",
        created_at: r.created_at
      }));
      setRecords(mappedRecords);

      // 2. Fetch Summary Stats
      try {
        const summaryRes = await api.get<PenaltySummary>("/penalties/summary", {
          showLoader: false,
          showErrorToast: false
        });
        if (summaryRes) {
          setSummary(summaryRes);
        }
      } catch (err) {
        console.warn("Could not load summary stats:", err);
      }

      // 3. Fetch Leaderboard
      try {
        const leaderboardRes = await api.get<{
          top_by_violations?: LeaderboardItem[];
          top_by_amount?: LeaderboardItem[];
        }>("/penalties/leaderboard", {
          showLoader: false,
          showErrorToast: false
        });
        if (leaderboardRes) {
          setLeaderboard({
            top_by_violations: leaderboardRes.top_by_violations || [],
            top_by_amount: leaderboardRes.top_by_amount || []
          });
        }
      } catch (err) {
        console.warn("Could not load leaderboard:", err);
      }
    } catch (error: any) {
      console.error("Failed to load penalties:", error);
      toast.error("Failed to load penalties from server");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch Penalty Types (Templates)
  const fetchPenaltyTypes = useCallback(async () => {
    try {
      const res = await api.get<PenaltyType[]>("/penalties/types", {
        showLoader: false,
        showErrorToast: false
      });
      if (Array.isArray(res)) {
        setPenaltyTypes(res.map(t => ({
          id: t.id || t._id || "",
          name: t.name,
          default_price: t.default_price || 0,
          warning_limit: t.warning_limit || 0,
          description: t.description || ""
        })));
      }
    } catch (err) {
      console.warn("Failed to fetch penalty types:", err);
    }
  }, []);

  // Fetch Employee options for modal
  const fetchEmployeesList = useCallback(async () => {
    try {
      const res = await api.get<{ data?: any[] } | any[]>("/employees?limit=200", {
        showLoader: false,
        showErrorToast: false
      });
      const rawList = Array.isArray(res) ? res : res?.data || [];
      const opts: EmployeeOption[] = rawList.map((emp: any) => {
        const personal = emp.personal_info || {};
        const work = emp.work_details || {};
        const name = `${personal.first_name || ""} ${personal.last_name || ""}`.trim() || emp.name || "Employee";
        return {
          id: emp._id || emp.id,
          name,
          role: work.designation || work.system_role || "Staff",
          department: work.department || "General",
          avatar: personal.profile_photo || personal.avatar || ""
        };
      });
      setEmployees(opts);
    } catch (err) {
      console.warn("Failed to fetch employees list:", err);
    }
  }, []);

  useEffect(() => {
    fetchPenaltiesData();
    fetchPenaltyTypes();
    fetchEmployeesList();
  }, [fetchPenaltiesData, fetchPenaltyTypes, fetchEmployeesList]);

  // Handle template selection change in Add Modal
  const handleTemplateSelect = (typeId: string) => {
    setNewTypeId(typeId);
    const selected = penaltyTypes.find(t => t.id === typeId);
    if (selected) {
      if (selected.warning_limit > 0 && selected.default_price === 0) {
        setNewType("Warning");
        setNewAmount("0");
        setNewImpact(false);
      } else {
        setNewType("Penalty");
        setNewAmount(selected.default_price ? String(selected.default_price) : "");
        setNewImpact(true);
      }
      if (selected.description && !newDesc) {
        setNewDesc(selected.description);
      }
    }
  };

  // Submit Create Record
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpId) {
      toast.error("Please select an employee.");
      return;
    }
    if (!newTypeId) {
      toast.error("Please select a penalty type.");
      return;
    }
    if (!newDesc.trim()) {
      toast.error("Please provide a reason/description.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        employee_id: newEmpId,
        penalty_type_id: newTypeId,
        reason: newDesc.trim(),
        penalty_date: newDate || new Date().toISOString().split("T")[0],
        price: newType === "Penalty" ? (parseFloat(newAmount) || 0) : 0,
        is_warning: newType === "Warning",
        impact_payroll: newType === "Penalty" ? newImpact : false,
        status: "Active"
      };

      await api.post("/penalties", payload);
      toast.success(`${newType} assigned successfully!`);
      
      setIsNewOpen(false);
      // Reset form
      setNewEmpId("");
      setNewTypeId("");
      setNewDesc("");
      setNewAmount("");
      setNewType("Penalty");
      setNewImpact(true);
      setNewDate(new Date().toISOString().split("T")[0]);

      // Refresh list & stats
      await fetchPenaltiesData(true);
    } catch (err: any) {
      console.error("Failed to create penalty:", err);
      toast.error(err.message || "Failed to create penalty");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Waive / Resolve
  const handleConfirmUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateRecordId) return;
    if (!updateReason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }

    try {
      await api.put(`/penalties/${updateRecordId}`, {
        status: updateAction,
        resolution_reason: updateReason.trim(),
        impact_payroll: updateAction === "Waived" ? false : undefined
      });

      toast.success(`Record marked as ${updateAction}`);
      setIsUpdateOpen(false);
      setUpdateRecordId(null);
      setUpdateReason("");
      await fetchPenaltiesData(true);
    } catch (err: any) {
      console.error("Failed to update status:", err);
      toast.error(err.message || "Failed to update record");
    }
  };

  // Submit Edit Amount
  const handleEditAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecordId) return;

    const parsed = parseFloat(editAmount);
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Please enter a valid non-negative amount.");
      return;
    }

    try {
      await api.put(`/penalties/${editRecordId}`, {
        price: parsed
      });

      toast.success("Penalty amount updated successfully");
      setIsEditOpen(false);
      setEditRecordId(null);
      setEditAmount("");
      await fetchPenaltiesData(true);
    } catch (err: any) {
      console.error("Failed to update amount:", err);
      toast.error(err.message || "Failed to update amount");
    }
  };

  // Submit Delete
  const handleConfirmDelete = async () => {
    if (!deleteRecordId) return;
    try {
      await api.delete(`/penalties/${deleteRecordId}`);
      toast.success("Penalty record removed successfully");
      setIsDeleteOpen(false);
      setDeleteRecordId(null);
      await fetchPenaltiesData(true);
    } catch (err: any) {
      console.error("Failed to delete record:", err);
      toast.error(err.message || "Failed to delete record");
    }
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      // Tab filter: All, Penalty, Warning
      const recType = rec.is_warning ? "Warning" : "Penalty";
      const matchesTab = activeTab === "All" || recType === activeTab;

      // Status filter
      const matchesStatus = statusFilter === "All" || rec.status === statusFilter;

      // Employee Filter
      const matchesEmployee = selectedEmployeeFilter === "All" || rec.employee_id === selectedEmployeeFilter;

      // Penalty Type Filter
      const matchesType = selectedTypeFilter === "All" || rec.penalty_type_name.toLowerCase() === selectedTypeFilter.toLowerCase();

      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        rec.employee_name.toLowerCase().includes(q) ||
        rec.penalty_type_name.toLowerCase().includes(q) ||
        rec.reason.toLowerCase().includes(q) ||
        (rec.department && rec.department.toLowerCase().includes(q));

      return matchesTab && matchesStatus && matchesEmployee && matchesType && matchesSearch;
    });
  }, [records, activeTab, statusFilter, selectedEmployeeFilter, selectedTypeFilter, searchQuery]);

  // Dynamic KPI Metrics (fallback to client calc if summary not yet loaded)
  const activePenaltiesCount = summary?.active_penalties_count ?? records.filter(r => !r.is_warning && r.status === "Active").length;
  const totalDeductions = summary?.total_payroll_deductions ?? records.filter(r => !r.is_warning && r.status === "Active" && r.impact_payroll).reduce((sum, r) => sum + (r.price || 0), 0);
  const maxViolationsEmp = summary?.max_violations_employee || "None";
  const maxViolationsCount = summary?.max_violations_count ?? 0;
  const maxPenaltyEmp = summary?.max_penalty_employee || "None";
  const maxPenaltyAmount = summary?.max_penalty_amount ?? 0;

  // Month options for leaderboard
  const monthOptions = useMemo(() => {
    const list: { label: string; value: string }[] = [{ label: "All Time", value: "all" }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthName = d.toLocaleString("default", { month: "long" });
      list.push({ label: `${monthName} ${d.getFullYear()}`, value: val });
    }
    return list;
  }, []);

  // Leaderboard data filtered by month
  const dynamicMonthLeaderboard = useMemo(() => {
    const recordsToConsider = leaderboardMonth === "all" 
      ? records 
      : records.filter(r => {
          const d = r.penalty_date || r.created_at || "";
          return d.startsWith(leaderboardMonth);
        });

    const map = new Map<string, LeaderboardItem>();
    recordsToConsider.forEach(r => {
      if (!r.employee_id) return;
      const existing = map.get(r.employee_id) || {
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        avatar: r.avatar,
        role: r.role,
        department: r.department,
        total_violations: 0,
        total_penalty_amount: 0,
      };
      existing.total_violations += 1;
      if (!r.is_warning) {
        existing.total_penalty_amount += (r.price || 0);
      }
      map.set(r.employee_id, existing);
    });

    const items = Array.from(map.values());
    if (leaderboardSort === "violations") {
      return items.sort((a, b) => b.total_violations - a.total_violations);
    } else {
      return items.sort((a, b) => b.total_penalty_amount - a.total_penalty_amount);
    }
  }, [records, leaderboardMonth, leaderboardSort]);

  const currentLeaderboardData = leaderboardMonth === "all" && leaderboard.top_by_violations.length > 0
    ? (leaderboardSort === "violations" ? leaderboard.top_by_violations : leaderboard.top_by_amount)
    : dynamicMonthLeaderboard;

  return (
    <div className="space-y-5 h-[calc(100vh-4rem)] flex flex-col overflow-hidden pb-0">
      {/* Header / Stats */}
      <div className="shrink-0 bg-card border border-border rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <ShieldAlert className="w-64 h-64 text-foreground" />
        </div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-black text-foreground tracking-tight">Penalties & Warnings</h1>
              <button 
                onClick={() => fetchPenaltiesData(true)} 
                disabled={isRefreshing}
                title="Refresh penalty data"
                className="p-1.5 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin text-primary")} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Track disciplinary actions and policy violations. Active penalties marked for payroll will automatically be factored into the payroll cycle.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-center gap-4 min-w-[150px]">
              <div className="w-10 h-10 bg-background rounded-xl shadow-sm flex items-center justify-center text-destructive shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-destructive/70 uppercase tracking-wider mb-0.5">Active</p>
                <p className="text-2xl font-black text-destructive leading-none">{activePenaltiesCount}</p>
              </div>
            </div>
            
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 min-w-[150px]">
              <div className="w-10 h-10 bg-background rounded-xl shadow-sm flex items-center justify-center text-primary shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary/70 uppercase tracking-wider mb-0.5">Payroll Impact</p>
                <p className="text-2xl font-black text-primary leading-none">₹{totalDeductions.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 min-w-[160px] flex-1 sm:flex-none">
              <div className="w-10 h-10 bg-background rounded-xl shadow-sm flex items-center justify-center text-amber-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-600/80 uppercase tracking-wider mb-0.5 truncate" title={maxViolationsEmp}>
                  {maxViolationsEmp}
                </p>
                <p className="text-base font-black text-amber-700 leading-none truncate">
                  {maxViolationsCount} Violations
                </p>
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-4 min-w-[160px] flex-1 sm:flex-none">
              <div className="w-10 h-10 bg-background rounded-xl shadow-sm flex items-center justify-center text-rose-600 shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-rose-600/80 uppercase tracking-wider mb-0.5 truncate" title={maxPenaltyEmp}>
                  {maxPenaltyEmp}
                </p>
                <p className="text-base font-black text-rose-700 leading-none truncate">
                  ₹{maxPenaltyAmount.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-6">
        {/* Left Column: Records List */}
        <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
              {(["All", "Penalty", "Warning"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 border",
                    activeTab === tab 
                      ? "bg-primary text-primary-foreground border-primary shadow-md" 
                      : "bg-background text-muted-foreground border-border hover:border-border hover:bg-muted"
                  )}
                >
                  {tab}
                </button>
              ))}

              <span className="text-border mx-1 hidden sm:inline">|</span>

              {(["All", "Active", "Resolved", "Waived"] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                    statusFilter === st
                      ? "bg-foreground/10 text-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Employee Filter */}
              <div className="w-40 sm:w-44">
                <SearchableSelect
                  value={selectedEmployeeFilter}
                  onChange={(val) => setSelectedEmployeeFilter(String(val))}
                  options={[
                    { label: "All Employees", value: "All" },
                    ...employees.map(e => ({ label: e.name, value: e.id }))
                  ]}
                  placeholder="Employee"
                  className="w-full h-[38px] text-xs bg-background border-border rounded-xl"
                />
              </div>

              {/* Penalty Type Filter */}
              <div className="w-36 sm:w-40">
                <SearchableSelect
                  value={selectedTypeFilter}
                  onChange={(val) => setSelectedTypeFilter(String(val))}
                  options={[
                    { label: "All Types", value: "All" },
                    ...penaltyTypes.map(t => ({ label: t.name, value: t.name }))
                  ]}
                  placeholder="Penalty Type"
                  className="w-full h-[38px] text-xs bg-background border-border rounded-xl"
                />
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search records..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full sm:w-48 pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              
              <button 
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                className={cn(
                  "px-3.5 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted font-bold text-sm transition-all flex items-center gap-2 shadow-sm shrink-0", 
                  showLeaderboard && "bg-amber-500/10 text-amber-600 border-amber-500/30"
                )}
              >
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Leaderboard</span>
              </button>
              
              {isAdminOrHr && (
                <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
                  <DialogTrigger asChild>
                    <button className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0">
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Add Record</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
                    <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/50 bg-muted/30">
                      <div>
                        <h2 className="text-xl md:text-2xl font-black tracking-tight">Add Disciplinary Record</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Record a violation or formal warning</p>
                      </div>
                      <DialogClose asChild>
                        <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                      </DialogClose>
                    </div>

                    <form onSubmit={handleCreateRecord} className="flex flex-col max-h-[75vh]">
                      <div className="p-6 md:p-8 space-y-5 overflow-y-auto">
                        {/* Pre-defined Template */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                            Penalty Type / Template
                          </label>
                          <SearchableSelect 
                            value={newTypeId}
                            onChange={handleTemplateSelect}
                            options={penaltyTypes.map(t => ({ 
                              label: `${t.name} ${t.default_price ? `(₹${t.default_price})` : "(Warning)"}`, 
                              value: t.id 
                            }))}
                            placeholder="Select Pre-defined Type"
                            className="w-full h-[40px] px-3 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                          />
                        </div>

                        {/* Record Type Switch */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                            Record Type
                          </label>
                          <SearchableSelect 
                            value={newType}
                            onChange={(val) => {
                              const t = val as RecordType;
                              setNewType(t);
                              if (t === "Warning") {
                                setNewAmount("0");
                                setNewImpact(false);
                              } else {
                                setNewImpact(true);
                              }
                            }}
                            options={[
                              { label: "Penalty (Financial impact / deduction)", value: "Penalty" },
                              { label: "Warning (Formal written notice, ₹0)", value: "Warning" }
                            ]}
                            className="w-full h-[40px] px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                          />
                        </div>

                        {/* Employee Select */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                            Employee
                          </label>
                          <SearchableSelect 
                            value={newEmpId}
                            onChange={setNewEmpId}
                            options={employees.map(emp => ({ 
                              label: `${emp.name} (${emp.role} • ${emp.department})`, 
                              value: emp.id 
                            }))}
                            placeholder="Select Employee"
                            className="w-full h-[40px] px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        
                        {/* Financial inputs (if Penalty) */}
                        {newType === "Penalty" && (
                          <div className="flex gap-4">
                            <div className="space-y-1.5 flex-1">
                              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                                Deduction Amount (₹)
                              </label>
                              <input 
                                type="number" 
                                placeholder="e.g. 100"
                                min="0"
                                required
                                value={newAmount}
                                onChange={e => setNewAmount(e.target.value)}
                                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>
                            <div className="space-y-1.5 flex-1 flex flex-col justify-end pb-2">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                  type="checkbox" 
                                  checked={newImpact}
                                  onChange={e => setNewImpact(e.target.checked)}
                                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <span className="text-sm font-bold text-foreground/90">Affect Payroll</span>
                              </label>
                            </div>
                          </div>
                        )}

                        {/* Date Picker */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                            Date of Infraction
                          </label>
                          <input 
                            type="date"
                            value={newDate}
                            onChange={e => setNewDate(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>

                        {/* Reason / Description */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                            Description / Reason
                          </label>
                          <textarea 
                            required
                            rows={3}
                            placeholder="Provide details about the incident or policy violation..."
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                          />
                        </div>
                      </div>

                      <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                        <button 
                          type="button" 
                          onClick={() => setIsNewOpen(false)}
                          className="px-4 py-2 bg-background border border-border text-foreground/80 hover:bg-muted font-bold text-sm rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit"
                          disabled={isSubmitting}
                          className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
                        >
                          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                          Save Record
                        </button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Loading penalties...</p>
              </div>
            ) : filteredRecords.length > 0 ? (
              <div className="space-y-3">
                {filteredRecords.map(record => {
                  const isRecordWarning = record.is_warning;
                  return (
                    <div 
                      key={record.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/50 hover:border-border bg-card transition-all shadow-sm hover:shadow-md group"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                          !isRecordWarning 
                            ? "bg-destructive/10 text-destructive border-destructive/20" 
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        )}>
                          {!isRecordWarning ? <AlertTriangle className="w-5 h-5" /> : <MessageSquareWarning className="w-5 h-5" />}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-foreground text-sm">{record.employee_name}</span>
                            <span className="text-xs text-muted-foreground">({record.role} • {record.department})</span>
                            <span className="text-border">•</span>
                            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3 inline" />
                              {record.penalty_date ? formatDate(record.penalty_date) : "Recent"}
                            </span>
                          </div>
                          
                          <p className="text-sm text-foreground/85 mb-2.5 leading-relaxed">{record.reason}</p>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Type Pill */}
                            <span className={cn(
                              "text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider",
                              !isRecordWarning 
                                ? "bg-destructive/10 text-destructive border border-destructive/20" 
                                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            )}>
                              {record.penalty_type_name || (isRecordWarning ? "Warning" : "Penalty")}
                            </span>
                            
                            {/* Amount Pill */}
                            {!isRecordWarning && (
                              <span className="text-xs font-bold text-foreground/80 bg-muted px-2.5 py-0.5 rounded-md border border-border/50">
                                Amount: ₹{record.price}
                              </span>
                            )}
                            
                            {/* Payroll Impact */}
                            {record.impact_payroll && record.status === "Active" && (
                              <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                Affects Payroll
                              </span>
                            )}
                          </div>
                          
                          {/* Resolution Reason Note */}
                          {record.resolution_reason && (
                            <div className="mt-3 bg-muted/40 border border-border/60 rounded-xl p-3 text-left">
                              <p className="text-xs font-bold text-foreground/80 mb-0.5">
                                Reason for {record.status}:
                              </p>
                              <p className="text-xs text-muted-foreground">{record.resolution_reason}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Status & Actions */}
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 pt-3 sm:pt-0 border-t border-border/50 sm:border-0 mt-3 sm:mt-0">
                        {/* Status Badge */}
                        <div className={cn(
                          "text-xs font-black px-3 py-1 rounded-full border tracking-wide uppercase",
                          record.status === "Active" 
                            ? "bg-destructive/10 text-destructive border-destructive/30" 
                            : record.status === "Resolved" 
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" 
                            : "bg-muted text-muted-foreground border-border"
                        )}>
                          {record.status}
                        </div>
                        
                        {/* Action Buttons (Admin / HR only) */}
                        {isAdminOrHr && (
                          <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                            {record.status === "Active" && (
                              <>
                                {!isRecordWarning && (
                                  <button 
                                    onClick={() => {
                                      setEditRecordId(record.id);
                                      setEditAmount(String(record.price));
                                      setIsEditOpen(true);
                                    }}
                                    className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 rounded-lg transition-colors border border-blue-200/50"
                                  >
                                    Edit
                                  </button>
                                )}
                                <button 
                                  onClick={() => {
                                    setUpdateRecordId(record.id);
                                    setUpdateAction("Waived");
                                    setUpdateReason("");
                                    setIsUpdateOpen(true);
                                  }}
                                  className="px-2.5 py-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border"
                                >
                                  Waive
                                </button>
                                <button 
                                  onClick={() => {
                                    setUpdateRecordId(record.id);
                                    setUpdateAction("Resolved");
                                    setUpdateReason("");
                                    setIsUpdateOpen(true);
                                  }}
                                  className="px-2.5 py-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 rounded-lg transition-colors border border-emerald-500/20"
                                >
                                  Resolve
                                </button>
                              </>
                            )}

                            <button 
                              onClick={() => {
                                setDeleteRecordId(record.id);
                                setIsDeleteOpen(true);
                              }}
                              title="Delete penalty record"
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/10 rounded-3xl border border-border/50 border-dashed">
                <div className="w-14 h-14 bg-background rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-border/50 text-muted-foreground">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-foreground/90 mb-1">No records found</h3>
                <p className="text-muted-foreground text-xs max-w-sm">
                  {searchQuery ? "No disciplinary records match your search criteria." : "No active disciplinary actions or warnings have been recorded."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Leaderboard Card */}
        {showLeaderboard && (
          <div className="w-full lg:w-80 bg-card border border-border rounded-3xl shadow-sm flex flex-col overflow-hidden shrink-0 animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-border bg-muted/30 shrink-0 text-left">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-black text-foreground tracking-tight">Disciplinary Leaderboard</h2>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Live metrics on infractions and penalties</p>
              
              {/* Month-wise Filter for Leaderboard */}
              <div className="mt-3">
                <SearchableSelect
                  value={leaderboardMonth}
                  onChange={(val) => setLeaderboardMonth(String(val))}
                  options={monthOptions}
                  placeholder="Select Month"
                  className="w-full h-8 text-xs bg-background border-border rounded-lg font-medium"
                />
              </div>

              {/* Sorting Switcher */}
              <div className="flex p-0.5 bg-muted rounded-xl border border-border/40 mt-2.5">
                <button 
                  onClick={() => setLeaderboardSort("violations")}
                  className={cn(
                    "flex-1 py-1 text-[11px] font-bold rounded-lg transition-all", 
                    leaderboardSort === "violations" 
                      ? "bg-card text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Violations
                </button>
                <button 
                  onClick={() => setLeaderboardSort("amount")}
                  className={cn(
                    "flex-1 py-1 text-[11px] font-bold rounded-lg transition-all", 
                    leaderboardSort === "amount" 
                      ? "bg-card text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Penalty Amt
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-left">
              {currentLeaderboardData && currentLeaderboardData.length > 0 ? (
                currentLeaderboardData.map((item, idx) => {
                  const rank = idx + 1;
                  return (
                    <div 
                      key={item.employee_id || idx} 
                      className="flex items-center justify-between gap-3 p-2.5 hover:bg-muted/30 rounded-2xl transition-all border border-transparent hover:border-border/40"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rank Badge */}
                        <span className={cn(
                          "grid h-6 w-6 place-items-center rounded-lg text-[10px] font-black border shrink-0",
                          rank === 1 ? "bg-amber-500/15 text-amber-600 border-amber-500/30 font-black" :
                          rank === 2 ? "bg-slate-400/15 text-slate-500 border-slate-400/30" :
                          rank === 3 ? "bg-orange-700/15 text-orange-700 border-orange-700/30" :
                          "bg-muted text-muted-foreground border-border/50"
                        )}>
                          {rank}
                        </span>
                        
                        {/* Avatar */}
                        <img 
                          src={item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.employee_name)}`} 
                          alt={item.employee_name} 
                          className="w-8 h-8 rounded-full border border-border shadow-sm shrink-0 object-cover" 
                        />
                        
                        <div className="min-w-0">
                          <p className="text-xs font-black text-foreground truncate leading-snug">{item.employee_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">{item.role || item.department}</p>
                        </div>
                      </div>

                      {/* Value Pill */}
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-black rounded-lg shrink-0 uppercase tracking-wider border", 
                        leaderboardSort === "violations" 
                          ? "bg-amber-500/10 text-amber-700 border-amber-500/20" 
                          : "bg-rose-500/10 text-rose-700 border-rose-500/20"
                      )}>
                        {leaderboardSort === "violations" ? `${item.total_violations} Violations` : `₹${item.total_penalty_amount.toLocaleString("en-IN")}`}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <p className="text-xs">No leaderboard data available.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Waive / Resolve Dialog */}
      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-xl font-black tracking-tight">
                {updateAction === "Waived" ? "Waive Penalty" : "Resolve Infraction"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {updateAction === "Waived" ? "Remove payroll deduction for this infraction" : "Mark this warning or penalty as resolved"}
              </p>
            </div>
            <DialogClose asChild>
              <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <form onSubmit={handleConfirmUpdate} className="flex flex-col max-h-[70vh]">
            <div className="p-6 md:p-8 space-y-4 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                  Reason for {updateAction === "Waived" ? "Waiving" : "Resolving"}
                </label>
                <textarea 
                  required
                  rows={3}
                  placeholder={`Explain why this record is being ${updateAction.toLowerCase()}...`}
                  value={updateReason}
                  onChange={e => setUpdateReason(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>

            <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button 
                type="button" 
                onClick={() => setIsUpdateOpen(false)}
                className="px-4 py-2 bg-background border border-border text-foreground/80 hover:bg-muted font-bold text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors"
              >
                Confirm {updateAction}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Amount Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-xl font-black tracking-tight">Edit Penalty Amount</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Adjust the deduction value</p>
            </div>
            <DialogClose asChild>
              <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <form onSubmit={handleEditAmount} className="flex flex-col">
            <div className="p-6 md:p-8 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                  New Amount (₹)
                </label>
                <input 
                  type="number"
                  required
                  min="0"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button 
                type="button" 
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 bg-background border border-border text-foreground/80 hover:bg-muted font-bold text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors"
              >
                Update Amount
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <ConfirmModal 
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Penalty Record"
        description="Are you sure you want to remove this disciplinary record? This action will remove it from payroll calculations and active violation statistics."
        confirmText="Delete Record"
        variant="destructive"
      />
    </div>
  );
}
