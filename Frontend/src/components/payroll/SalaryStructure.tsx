import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  Calendar,
  TrendingUp,
  History,
  ShieldCheck,
  Users,
  IndianRupee,
  Activity,
  AlertCircle,
  X,
  Plus,
  Check,
  Loader2,
  Clock
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { SearchableSelect } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/components/auth/AuthContext";
import { formatCurrency } from "./payroll-data";

type ComponentType = "earnings" | "deductions";

interface SalaryComponent {
  id: string;
  name: string;
  amount: number | string;
  type: ComponentType;
}

interface Actor {
  id: string;
  name: string;
}

interface SalaryRevision {
  _id: string | null;
  employee_id: string;
  components: SalaryComponent[];
  gross: number;
  total_deductions: number;
  net: number;
  previous_gross?: number;
  effective_date: string | null;
  reason: string;
  change_type: string;
  status: "pending" | "approved" | "rejected";
  created_by?: Actor;
  created_at?: string;
  approved_by?: Actor;
  approved_at?: string;
  reject_reason?: string;
  is_virtual?: boolean;
}

interface EmployeeRow {
  id: string;
  employee_code: string;
  name: string;
  designation: string;
  department: string;
  joining_date: string | null;
  work_mode: string;
  gross: number;
  net: number;
  effective_date: string | null;
  has_pending: boolean;
}

interface Overview {
  employees: EmployeeRow[];
  summary: {
    employees_on_payroll: number;
    total_monthly_gross: number;
    revisions_this_year: number;
    pending_revisions: number;
  };
}

interface EmployeeDetail {
  employee: Omit<EmployeeRow, "gross" | "net" | "effective_date" | "has_pending">;
  current: SalaryRevision;
  pending: SalaryRevision | null;
  history: SalaryRevision[];
}

const REASON_OPTIONS = [
  { label: "Annual appraisal", value: "Annual appraisal" },
  { label: "Promotion", value: "Promotion" },
  { label: "Mid-year adjustment", value: "Mid-year adjustment" },
  { label: "Correction", value: "Correction" }
];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getInitials = (name: string) =>
  name.split(" ").filter(Boolean).map(n => n[0]).join("").substring(0, 2).toUpperCase();

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-700"
};

export function SalaryStructure() {
  const { user } = useAuth();
  const role = String((user as any)?.role || (user as any)?.system_role || "").toLowerCase().trim();
  const canApprove = ["admin", "subadmin", "super admin", "superadmin"].includes(role);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ baseSalary: string; deduction: string; reason: string; date: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reject state
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isActing, setIsActing] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.get<Overview>("/payroll/salary", { showLoader: false });
      setOverview(res);
      setSelectedEmpId(prev => prev ?? res?.employees?.[0]?.id ?? null);
    } catch {
      // error toast shown by api
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (empId: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get<EmployeeDetail>(`/payroll/salary/${empId}`, { showLoader: false });
      setDetail(res);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    setIsEditing(false);
    setIsRejecting(false);
    if (selectedEmpId) fetchDetail(selectedEmpId);
  }, [selectedEmpId, fetchDetail]);

  const refreshAll = async () => {
    await fetchOverview();
    if (selectedEmpId) await fetchDetail(selectedEmpId);
  };

  const employees = overview?.employees ?? [];
  const filteredEmployees = employees.filter(e => {
    const q = searchTerm.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.employee_code.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    );
  });

  const { items: sortedEmployees, requestSort, sortConfig } = useSortableData(filteredEmployees);

  const current = detail?.current;
  const pending = detail?.pending;
  // Single base salary + single deduction; older multi-row revisions are shown as their totals
  const viewGross = isEditing && editForm ? Number(editForm.baseSalary) || 0 : current?.gross ?? 0;
  const viewDeductions = isEditing && editForm ? Number(editForm.deduction) || 0 : current?.total_deductions ?? 0;

  const summary = overview?.summary;

  const handleEditClick = () => {
    if (!current) return;
    setEditForm({
      baseSalary: String(current.gross || ""),
      deduction: String(current.total_deductions || ""),
      reason: "Annual appraisal",
      date: todayStr()
    });
    setIsEditing(true);
  };

  const handleSaveRevision = async () => {
    if (!selectedEmpId || !editForm) return;
    if (!editForm.date || !editForm.reason) {
      toast.error("Effective date and reason are required");
      return;
    }
    const baseSalary = Number(editForm.baseSalary) || 0;
    const deduction = Number(editForm.deduction) || 0;
    if (baseSalary <= 0) {
      toast.error("Enter a base salary greater than 0");
      return;
    }
    if (deduction < 0 || deduction > baseSalary) {
      toast.error("Deduction must be between 0 and the base salary");
      return;
    }
    const components = [
      { id: "base", name: "Base Salary", amount: baseSalary, type: "earnings" },
      { id: "deduction", name: "Deductions", amount: deduction, type: "deductions" }
    ];

    const reasonType = editForm.reason === "Promotion" || editForm.reason === "Correction" ? editForm.reason : undefined;
    setIsSaving(true);
    try {
      await api.post(`/payroll/salary/${selectedEmpId}/revisions`, {
        components,
        effective_date: editForm.date,
        reason: editForm.reason,
        change_type: reasonType
      }, { showLoader: false });
      toast.success(canApprove ? "Revision created — approve it to apply" : "Revision sent for approval");
      setIsEditing(false);
      await refreshAll();
    } catch {
      // error toast shown by api
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!pending?._id) return;
    setIsActing(true);
    try {
      await api.post(`/payroll/salary/revisions/${pending._id}/approve`, {}, { showLoader: false });
      toast.success("Salary revision approved");
      await refreshAll();
    } catch {
      // error toast shown by api
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    if (!pending?._id) return;
    if (!rejectReason.trim()) {
      toast.error("Please enter a reason for rejection");
      return;
    }
    setIsActing(true);
    try {
      await api.post(`/payroll/salary/revisions/${pending._id}/reject`, { reason: rejectReason.trim() }, { showLoader: false });
      toast.success("Salary revision rejected");
      setIsRejecting(false);
      setRejectReason("");
      await refreshAll();
    } catch {
      // error toast shown by api
    } finally {
      setIsActing(false);
    }
  };

  const renderAmountRow = (label: string, value: number, field: "baseSalary" | "deduction") => (
    <tr>
      <td className="px-3 py-2.5 font-medium">{label}</td>
      <td className="px-3 py-2.5 text-right">
        {isEditing && editForm ? (
          <input
            type="number"
            min={0}
            value={editForm[field]}
            onChange={e => setEditForm({ ...editForm, [field]: e.target.value })}
            className="w-32 text-right border border-border rounded p-1 outline-none focus:border-emerald-500"
          />
        ) : (
          formatCurrency(value)
        )}
      </td>
    </tr>
  );

    if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px] space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Salary Structure</h1>
        <p className="mt-1 text-sm text-muted-foreground">Salary is auto-fetched from the employee profile and applied by effective date</p>
      </div>

      {/* Top Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Employees on payroll</p>
            <p className="text-3xl font-black mt-2">{summary?.employees_on_payroll ?? 0}</p>
          </div>
          <div className="rounded-lg bg-emerald-100/50 p-3 text-emerald-600">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total monthly gross</p>
            <p className="text-3xl font-black mt-2">{formatCurrency(summary?.total_monthly_gross ?? 0)}</p>
          </div>
          <div className="rounded-lg bg-blue-100/50 p-3 text-blue-600">
            <IndianRupee className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Revisions this year</p>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-3xl font-black">{summary?.revisions_this_year ?? 0}</p>
              <p className="text-xs font-medium text-muted-foreground mb-1">Append-only history</p>
            </div>
          </div>
          <div className="rounded-lg bg-purple-100/50 p-3 text-purple-600">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Pending revisions</p>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-3xl font-black text-amber-950">{summary?.pending_revisions ?? 0}</p>
              <p className="text-xs font-medium text-amber-700 mb-1">Awaiting Admin approval</p>
            </div>
          </div>
          <div className="rounded-lg bg-amber-200/50 p-3 text-amber-700">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6 items-start">

        {/* Left Pane - Employee Table */}
        <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-white">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employee, ID, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border-none bg-transparent py-2 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] whitespace-nowrap text-sm">
              <thead className="bg-white text-muted-foreground/70 border-b border-border">
                <tr>
                  <SortableHeader label="Employee" sortKey="name" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider" />
                  <SortableHeader label="Department" sortKey="department" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider" />
                  <SortableHeader label="Gross" sortKey="gross" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider" />
                  <SortableHeader label="Joining" sortKey="joining_date" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider" />
                  <SortableHeader label="Effective From" sortKey="effective_date" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedEmployees.map(emp => {
                  const isSelected = selectedEmpId === emp.id;
                  return (
                    <tr
                      key={emp.id}
                      className={cn(
                        "transition-colors cursor-pointer",
                        isSelected ? "bg-emerald-50/60" : "hover:bg-muted/30"
                      )}
                      onClick={() => setSelectedEmpId(emp.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white text-xs font-bold">
                            {getInitials(emp.name)}
                          </div>
                          <div>
                            <p className="font-bold text-foreground flex items-center gap-2">
                              {emp.name}
                              {emp.has_pending && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Pending</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[emp.employee_code, emp.designation].filter(Boolean).join(" · ") || "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground/80 font-medium">{emp.department || "-"}</td>
                      <td className="px-6 py-4 text-foreground font-bold">{emp.gross ? formatCurrency(emp.gross) : "-"}</td>
                      <td className="px-6 py-4 text-foreground/80 font-medium">{formatDate(emp.joining_date ?? undefined)}</td>
                      <td className="px-6 py-4 text-foreground/80 font-medium">{formatDate(emp.effective_date ?? undefined)}</td>
                    </tr>
                  );
                })}
                {sortedEmployees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                      No employees found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Pane - Salary Details */}
        {selectedEmpId && (
          <div className="rounded-2xl border border-border bg-white shadow-sm p-4 sm:p-8 lg:sticky lg:top-8">
            {detailLoading || !detail || !current ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-8 pb-6 border-b border-border/60">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{detail.employee.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {[detail.employee.employee_code, detail.employee.designation].filter(Boolean).join(" · ") || "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <button
                        onClick={handleEditClick}
                        disabled={!!pending}
                        title={pending ? "A revision is already pending approval" : undefined}
                        className="flex items-center gap-2 text-sm font-bold bg-white border border-border text-foreground/80 px-4 py-2 rounded-lg hover:bg-muted/50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" /> Revise Salary
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex items-center gap-2 text-sm font-bold bg-muted text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted/80 transition-colors shadow-sm"
                      >
                        <X className="h-4 w-4" /> Cancel Revision
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-8 flex-1 overflow-y-auto pr-2 pb-8">

                  {/* Pending revision banner */}
                  {pending && !isEditing && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                            <Clock className="h-4 w-4" /> Revision pending approval
                          </p>
                          <p className="text-xs text-amber-800 mt-1">
                            New gross {formatCurrency(pending.gross)} · net {formatCurrency(pending.net)} · effective {formatDate(pending.effective_date ?? undefined)}
                          </p>
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            {pending.reason}{pending.created_by?.name ? ` · requested by ${pending.created_by.name}` : ""}
                          </p>
                        </div>
                      </div>
                      {canApprove && !isRejecting && (
                        <div className="flex gap-2">
                          <button
                            onClick={handleApprove}
                            disabled={isActing}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-60"
                          >
                            {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                          </button>
                          <button
                            onClick={() => setIsRejecting(true)}
                            disabled={isActing}
                            className="px-4 bg-white border border-border hover:bg-rose-50 hover:text-rose-600 text-xs font-bold py-2 rounded-lg disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {canApprove && isRejecting && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection"
                            className="w-full rounded-md border border-border p-2 text-xs outline-none focus:border-rose-400 bg-white"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleReject}
                              disabled={isActing}
                              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-60"
                            >
                              Confirm Reject
                            </button>
                            <button
                              onClick={() => { setIsRejecting(false); setRejectReason(""); }}
                              className="px-4 bg-white border border-border text-xs font-bold py-2 rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-2xl bg-emerald-900 p-6 text-white flex items-center justify-between shadow-md">
                    <div>
                      <p className="text-emerald-100 text-sm font-medium">{isEditing ? "Proposed Net In-hand" : "Net In-hand Salary"}</p>
                      <p className="text-3xl font-black mt-1">{formatCurrency(viewGross - viewDeductions)}</p>
                    </div>
                    <div className="text-right text-sm space-y-1 text-emerald-100 font-medium">
                      <p>Gross: {formatCurrency(viewGross)}</p>
                      <p className="text-emerald-300">Deductions: -{formatCurrency(viewDeductions)}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-4 flex items-center gap-2 font-bold">
                      <TrendingUp className="h-4 w-4 text-emerald-600" /> Earnings
                    </h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-border">
                          {renderAmountRow("Base Salary", viewGross, "baseSalary")}
                        </tbody>
                        <tfoot className="bg-muted/50">
                          <tr>
                            <td className="px-3 py-2.5 font-bold">Total Gross</td>
                            <td className="px-3 py-2.5 text-right font-bold text-emerald-600">{formatCurrency(viewGross)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-4 flex items-center gap-2 font-bold">
                      <ShieldCheck className="h-4 w-4 text-rose-600" /> Deductions
                    </h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-border">
                          {renderAmountRow("Deductions", viewDeductions, "deduction")}
                        </tbody>
                        <tfoot className="bg-muted/50">
                          <tr>
                            <td className="px-3 py-2.5 font-bold">Total Deductions</td>
                            <td className="px-3 py-2.5 text-right font-bold text-rose-600">{formatCurrency(viewDeductions)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-4 flex items-center gap-2 font-bold">
                      <History className="h-4 w-4 text-primary" /> Salary Revision History
                    </h3>
                    {isEditing && editForm ? (
                      <div className="rounded-xl border border-border p-5 bg-emerald-50/50 space-y-4">
                        <p className="text-sm font-bold text-emerald-900">Finalize Revision</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-muted-foreground flex gap-1 mb-1">
                              Effective Date <span className="text-rose-500">*</span>
                            </label>
                            <DatePicker
                              value={editForm.date}
                              onChange={(val) => setEditForm({ ...editForm, date: val })}
                              placeholder="Select date"
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-muted-foreground flex gap-1">
                              Reason for change <span className="text-rose-500">*</span>
                            </label>
                            <SearchableSelect
                              value={editForm.reason}
                              onChange={(val) => setEditForm({ ...editForm, reason: val })}
                              options={REASON_OPTIONS}
                              placeholder="Select reason..."
                              className="mt-1 w-full h-[38px] px-2 rounded-md border border-border text-sm outline-none focus:border-emerald-500 bg-white"
                            />
                          </div>
                        </div>
                        <button
                          onClick={handleSaveRevision}
                          disabled={isSaving}
                          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg transition-colors mt-2 disabled:opacity-60"
                        >
                          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                          Submit for Approval
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border p-5">
                        <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-2 before:w-px before:bg-border">
                          {detail.history.map((hist, i) => (
                            <div key={hist._id ?? `virtual-${i}`} className="relative pl-6">
                              <div className={cn(
                                "absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white",
                                hist.status === "pending" ? "bg-amber-400" :
                                hist.status === "rejected" ? "bg-rose-400" :
                                hist.change_type === "Initial" ? "bg-slate-400" :
                                hist.change_type === "Promotion" ? "bg-primary" : "bg-emerald-500"
                              )} />
                              <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" /> {formatDate(hist.effective_date ?? undefined)}
                                <span className={cn("ml-1 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider", STATUS_STYLES[hist.status])}>
                                  {hist.status}
                                </span>
                              </p>
                              <p className="mt-1 text-lg font-black">{formatCurrency(hist.gross)}</p>
                              <div className="mt-1.5 inline-flex items-center rounded-md bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                                {hist.change_type} · {hist.reason}
                              </div>
                              {hist.status === "rejected" && hist.reject_reason && (
                                <p className="mt-1 text-[10px] text-rose-600">Rejected: {hist.reject_reason}</p>
                              )}
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {hist.is_virtual
                                  ? "From employee profile"
                                  : hist.status === "pending"
                                    ? `Requested by ${hist.created_by?.name ?? "-"}`
                                    : `${hist.status === "rejected" ? "Rejected" : "Authorized"} by ${hist.approved_by?.name ?? "-"}`}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
