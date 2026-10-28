import { useState, useEffect, useCallback, useMemo } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { formatCurrency } from "./payroll-data";
import { Plus, Gift, MinusCircle, Loader2, X, Check, ShieldAlert } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SearchInput } from "@/components/common/SearchInput";
import { cn, formatDate } from "@/lib/utils";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { SearchableSelect } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/components/auth/AuthContext";

type EntrySource = "manual" | "penalty" | "salary";
type Scope = "individual" | "department" | "company";

interface Entry {
  id: string;
  ref: string;
  source: EntrySource;
  type: "Bonus" | "Deduction";
  typeLabel: string;
  appliedTo: string;
  appliedToSub: string;
  reason: string;
  creator: string;
  date: string | null;
  amount: number;
  total_amount: number;
  state: string;
  reject_reason?: string | null;
  counts: boolean;
}

interface ListResponse {
  month: string;
  entries: Entry[];
  summary: {
    total_bonus: number;
    total_deduction: number;
    entries_count: number;
    pending_count: number;
  };
  employees: { id: string; name: string; department: string }[];
  departments: string[];
}

const SOURCE_OPTIONS = [
  { label: "All sources", value: "all" },
  { label: "Manual entries", value: "manual" },
  { label: "Penalties", value: "penalty" },
  { label: "Salary structure", value: "salary" }
];

const CATEGORY_OPTIONS = [
  "Loan EMI",
  "Advance Recovery",
  "Late Coming",
  "Damage / Loss Recovery",
  "Notice Period Recovery",
  "Other"
].map(c => ({ label: c, value: c }));

const SCOPE_OPTIONS = [
  { label: "Individual", value: "individual" },
  { label: "Department", value: "department" },
  { label: "Entire Company", value: "company" }
];

const STATE_STYLES: Record<string, string> = {
  Approved: "bg-primary text-primary-foreground",
  Applied: "bg-primary text-primary-foreground",
  Recurring: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Pending: "bg-amber-100 text-amber-800",
  Rejected: "bg-rose-100 text-rose-700",
  Waived: "bg-muted text-muted-foreground border border-border",
  Resolved: "bg-muted text-muted-foreground border border-border",
  "Not in payroll": "bg-muted text-muted-foreground border border-border"
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (month: string) => {
  const [y = 0, m = 1] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};

const emptyForm = (month: string) => ({
  category: "",
  scope: "individual" as Scope,
  employee_id: "",
  department: "",
  amount: "",
  reason: "",
  date: month === currentMonth()
    ? new Date().toISOString().slice(0, 10)
    : `${month}-01`
});

export function BonusDeductions() {
  const { user } = useAuth();
  const anyUser = user as any;
  const role = String(anyUser?.role || anyUser?.system_role || anyUser?.work_details?.system_role || "").toLowerCase().trim();
  const userDept = String(anyUser?.department || anyUser?.work_details?.department || "").toLowerCase().trim();
  const userDesig = String(anyUser?.designation || anyUser?.work_details?.designation || "").toLowerCase().trim();

  const isHrOrAdmin = ["admin", "superadmin", "subadmin", "director", "ceo", "hr"].includes(role) ||
    userDept === "hr" || userDesig.includes("hr");
  const canApprove = isHrOrAdmin;

  const [activeTab, setActiveTab] = usePersistentState<"All" | "Bonuses" | "Deductions">("bonusDeductions.tab", "All");
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<ListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(emptyForm(month));
  const [isSaving, setIsSaving] = useState(false);

  const [actingId, setActingId] = useState<string | null>(null);
  const [applying, setApplying] = useState<Entry | null>(null);
  const [rejecting, setRejecting] = useState<Entry | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<ListResponse>(`/payroll/bonus-deductions?month=${month}`, { showLoader: false });
      setData(res);
    } catch {
      // error toast shown by api
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const currentName = String(user?.name || "").trim().toLowerCase();
    const currentId = String(user?.id || anyUser?._id || anyUser?.employee_id || "").trim();

    return (data?.entries ?? []).filter(entry => {
      // Non-HR/Admin users only see their own personal deductions and bonuses
      if (!isHrOrAdmin) {
        const appTo = (entry.appliedTo || "").toLowerCase();
        const appSub = (entry.appliedToSub || "").toLowerCase();
        const isPersonal = (currentName && appTo.includes(currentName)) ||
                           (currentId && (appSub.includes(currentId) || entry.id.includes(currentId)));
        if (!isPersonal) return false;
      }

      const matchesTab =
        activeTab === "All" ||
        (activeTab === "Bonuses" && entry.type === "Bonus") ||
        (activeTab === "Deductions" && entry.type === "Deduction");
      const matchesSource = sourceFilter === "all" || entry.source === sourceFilter;
      const matchesSearch =
        entry.typeLabel.toLowerCase().includes(q) ||
        entry.appliedTo.toLowerCase().includes(q) ||
        entry.reason.toLowerCase().includes(q) ||
        entry.ref.toLowerCase().includes(q);
      return matchesTab && matchesSource && matchesSearch;
    });
  }, [data, activeTab, sourceFilter, searchTerm, isHrOrAdmin, user]);

  const { items: sortedEntries, requestSort, sortConfig } = useSortableData(filteredEntries);

  const employeeOptions = useMemo(
    () => (data?.employees ?? []).map(e => ({ label: e.department ? `${e.name} · ${e.department}` : e.name, value: e.id })),
    [data]
  );
  const departmentOptions = useMemo(() => (data?.departments ?? []).map(d => ({ label: d, value: d })), [data]);

  const openAdd = () => {
    setForm(emptyForm(month));
    setIsAdding(true);
  };

  const handleCreate = async () => {
    const amount = Number(form.amount);
    if (!form.category) { toast.error("Select a deduction type"); return; }
    if (form.scope === "individual" && !form.employee_id) { toast.error("Select an employee"); return; }
    if (form.scope === "department" && !form.department) { toast.error("Select a department"); return; }
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (!form.reason.trim()) { toast.error("Reason is required"); return; }
    if (!form.date) { toast.error("Select a date"); return; }

    setIsSaving(true);
    try {
      await api.post("/payroll/bonus-deductions", {
        type: "Deduction",
        category: form.category,
        scope: form.scope,
        employee_id: form.scope === "individual" ? form.employee_id : null,
        department: form.scope === "department" ? form.department : null,
        amount,
        reason: form.reason.trim(),
        date: form.date
      }, { showLoader: false });
      toast.success(canApprove ? "Deduction added — approve it to apply" : "Deduction sent for approval");
      setIsAdding(false);
      if (form.date.slice(0, 7) !== month) setMonth(form.date.slice(0, 7));
      else await fetchEntries();
    } catch {
      // error toast shown by api
    } finally {
      setIsSaving(false);
    }
  };

  // Manual entries are approved, penalties are applied — both only after the confirmation popup
  const handleApply = async () => {
    const entry = applying;
    if (!entry) return;
    setApplying(null);
    setActingId(entry.id);
    try {
      const url = entry.source === "penalty"
        ? `/payroll/bonus-deductions/penalties/${entry.id}/apply`
        : `/payroll/bonus-deductions/${entry.id}/approve`;
      await api.post(url, {}, { showLoader: false });
      toast.success(`${entry.ref} applied — it will be included in payroll and the payslip`);
      await fetchEntries();
    } catch {
      // error toast shown by api
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejecting) return;
    if (!rejectReason.trim()) { toast.error("Reason is required"); return; }
    setActingId(rejecting.id);
    try {
      await api.post(`/payroll/bonus-deductions/${rejecting.id}/reject`, { reason: rejectReason.trim() }, { showLoader: false });
      toast.success(`${rejecting.ref} rejected`);
      setRejecting(null);
      setRejectReason("");
      await fetchEntries();
    } catch {
      // error toast shown by api
    } finally {
      setActingId(null);
    }
  };

  const summary = isHrOrAdmin ? data?.summary : {
    total_bonus: filteredEntries.filter(e => e.type === "Bonus").reduce((acc, e) => acc + (e.total_amount || e.amount || 0), 0),
    total_deduction: filteredEntries.filter(e => e.type === "Deduction").reduce((acc, e) => acc + (e.total_amount || e.amount || 0), 0),
    entries_count: filteredEntries.length,
    pending_count: filteredEntries.filter(e => e.state === "Pending").length,
  };
  const shortMonth = monthLabel(month).split(" ")[0];
  const headerCls = "py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest";

  if (!isHrOrAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center bg-card rounded-3xl border border-border/70 shadow-sm max-w-xl mx-auto my-12 animate-in fade-in">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-4 border border-rose-500/20">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">Access Restricted</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Bonus & Deductions and Payroll records are confidential and accessible only to Admin and HR personnel. Heads and other employees are not authorized to view or manage these records.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px]">

      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Bonus & Deductions</h1>
          <p className="mt-1 sm:mt-1.5 text-xs sm:text-[13px] text-muted-foreground/80">Apply to an individual, a department or the entire company</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="month"
            value={month}
            onChange={e => e.target.value && setMonth(e.target.value)}
            className="h-[38px] sm:h-auto px-3 py-2 rounded-lg border border-border/80 bg-white text-[13px] font-semibold text-foreground/80 shadow-sm outline-none focus:border-emerald-500"
          />
          {isHrOrAdmin && (
            <button
              onClick={openAdd}
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 bg-primary hover:bg-[#00925e] text-primary-foreground px-4 sm:px-5 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[13px] font-bold shadow-sm transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" /> Add Deduction
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-[#0b6c4b] rounded-2xl p-5 shadow-sm relative text-white">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-emerald-50">Total Bonus ({shortMonth})</p>
            <Gift className="h-4 w-4 text-emerald-100" />
          </div>
          <p className="text-2xl sm:text-[32px] font-black">{formatCurrency(summary?.total_bonus ?? 0)}</p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm relative">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Total Deduction ({shortMonth})</p>
            <MinusCircle className="h-4 w-4 text-[#0b6c4b]" />
          </div>
          <p className="text-2xl sm:text-[32px] font-black text-foreground">{formatCurrency(summary?.total_deduction ?? 0)}</p>
          <p className="text-[12px] text-muted-foreground mt-1">Approved entries, penalties & salary deductions</p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm relative">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Entries This Cycle</p>
          </div>
          <p className="text-2xl sm:text-[32px] font-black text-foreground">{summary?.entries_count ?? 0}</p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm relative">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Pending Approval</p>
          </div>
          <p className="text-2xl sm:text-[32px] font-black text-foreground">{summary?.pending_count ?? 0}</p>
          <p className="text-[12px] text-muted-foreground mt-1">Requires Admin sign-off</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-6">
        <div className="inline-flex bg-muted/50 border border-border/60 p-1 rounded-full gap-1 overflow-x-auto">
          {(["All", "Bonuses", "Deductions"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 sm:px-4 py-1.5 text-xs sm:text-[13px] font-semibold rounded-full transition-colors whitespace-nowrap",
                activeTab === tab
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <SearchInput
            placeholder="Search entries..."
            value={searchTerm}
            onChange={setSearchTerm}
            containerClassName="flex-1 sm:flex-none min-w-0"
          />
          <div className="w-40 sm:w-44 shrink-0">
            <SearchableSelect
              value={sourceFilter}
              onChange={val => setSourceFilter(val || "all")}
              options={SOURCE_OPTIONS}
              placeholder="Source"
              className="h-[34px] sm:h-[38px] px-3 rounded-xl border-border/60 bg-muted/40 text-xs sm:text-sm font-medium shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="border-b border-border/60">
                <SortableHeader label="Ref" sortKey="ref" currentSort={sortConfig} onSort={requestSort} className={headerCls} />
                <SortableHeader label="Type" sortKey="typeLabel" currentSort={sortConfig} onSort={requestSort} className={headerCls} />
                <SortableHeader label="Applied To" sortKey="appliedTo" currentSort={sortConfig} onSort={requestSort} className={headerCls} />
                <SortableHeader label="Reason" sortKey="reason" currentSort={sortConfig} onSort={requestSort} className={headerCls} />
                <SortableHeader label="Created By" sortKey="creator" currentSort={sortConfig} onSort={requestSort} className={headerCls} />
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} onSort={requestSort} className={headerCls} />
                <SortableHeader label="Amount" sortKey="amount" currentSort={sortConfig} onSort={requestSort} className={cn(headerCls, "text-right")} />
                <SortableHeader label="Approval" sortKey="state" currentSort={sortConfig} onSort={requestSort} className={cn(headerCls, "text-center")} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                    <Loader2 className="h-5 w-5 animate-spin inline-block" />
                  </td>
                </tr>
              ) : sortedEntries.map((entry: Entry) => (
                <tr key={`${entry.source}-${entry.id}`} className={cn("hover:bg-muted/50 transition-colors", !entry.counts && entry.state !== "Pending" && "opacity-60")}>
                  <td className="py-4 px-5">
                    <span className="text-[13px] font-bold text-foreground">{entry.ref}</span>
                  </td>
                  <td className="py-4 px-5">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold",
                      entry.type === "Bonus" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-foreground/80 border border-border"
                    )}>
                      {entry.typeLabel}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <p className="text-[13px] font-bold text-foreground/80">{entry.appliedTo}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">{entry.appliedToSub}</p>
                  </td>
                  <td className="py-4 px-5 max-w-[240px]">
                    <p className="text-[13px] text-muted-foreground font-medium">{entry.reason || "—"}</p>
                    {entry.reject_reason && (
                      <p className="text-[11px] text-rose-600 font-medium mt-0.5">Rejected: {entry.reject_reason}</p>
                    )}
                  </td>
                  <td className="py-4 px-5">
                    <p className="text-[13px] text-muted-foreground font-medium">{entry.creator || "—"}</p>
                  </td>
                  <td className="py-4 px-5">
                    <p className="text-[13px] text-muted-foreground font-medium whitespace-nowrap">{entry.date ? formatDate(entry.date) : "—"}</p>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <p className={cn(
                      "text-[14px] font-bold",
                      entry.type === "Bonus" ? "text-foreground" : "text-rose-600"
                    )}>
                      {entry.type === "Bonus" ? "+" : "-"}{formatCurrency(Math.abs(entry.amount))}
                    </p>
                    {entry.total_amount !== entry.amount && (
                      <p className="text-[11px] text-muted-foreground font-medium">per employee · {formatCurrency(entry.total_amount)} total</p>
                    )}
                  </td>
                  <td className="py-4 px-5 text-center">
                    {entry.state === "Pending" && entry.source === "manual" && canApprove ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setApplying(entry)}
                          disabled={actingId === entry.id}
                          title="Approve"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-full bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-60"
                        >
                          {actingId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => { setRejecting(entry); setRejectReason(""); }}
                          disabled={actingId === entry.id}
                          title="Reject"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-full bg-rose-100 hover:bg-rose-200 text-rose-700 disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : entry.state === "Pending" && entry.source === "penalty" && canApprove ? (
                      <button
                        onClick={() => setApplying(entry)}
                        disabled={actingId === entry.id}
                        title="Apply this penalty to payroll"
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 disabled:opacity-60"
                      >
                        {actingId === entry.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Apply
                      </button>
                    ) : (
                      <span className={cn(
                        "inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap",
                        STATE_STYLES[entry.state] ?? "bg-white text-foreground/80 border border-border/80"
                      )}>
                        {entry.state}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                    {searchTerm ? `No entries found matching "${searchTerm}"` : `No entries for ${monthLabel(month)}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground px-1 font-medium">
        Deductions include manual entries, payroll-impacting penalties and recurring salary-structure deductions. History entries are permanent — reason, creator, date and approval state are retained forever.
      </p>

      {/* Add deduction modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !isSaving && setIsAdding(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Add Deduction</h2>
              <button onClick={() => setIsAdding(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground flex gap-1 mb-1">Deduction Type <span className="text-rose-500">*</span></label>
              <SearchableSelect
                value={form.category}
                onChange={val => setForm({ ...form, category: val })}
                options={CATEGORY_OPTIONS}
                placeholder="Select type..."
                className="w-full h-[38px] px-2 rounded-md border border-border text-sm bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground flex gap-1 mb-1">Apply To <span className="text-rose-500">*</span></label>
              <div className="inline-flex bg-muted/50 border border-border/60 p-1 rounded-full gap-1 w-full">
                {SCOPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setForm({ ...form, scope: opt.value as Scope })}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap",
                      form.scope === opt.value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {form.scope === "individual" && (
              <div>
                <label className="text-xs font-bold text-muted-foreground flex gap-1 mb-1">Employee <span className="text-rose-500">*</span></label>
                <SearchableSelect
                  value={form.employee_id}
                  onChange={val => setForm({ ...form, employee_id: val })}
                  options={employeeOptions}
                  placeholder="Select employee..."
                  className="w-full h-[38px] px-2 rounded-md border border-border text-sm bg-white"
                />
              </div>
            )}
            {form.scope === "department" && (
              <div>
                <label className="text-xs font-bold text-muted-foreground flex gap-1 mb-1">Department <span className="text-rose-500">*</span></label>
                <SearchableSelect
                  value={form.department}
                  onChange={val => setForm({ ...form, department: val })}
                  options={departmentOptions}
                  placeholder="Select department..."
                  className="w-full h-[38px] px-2 rounded-md border border-border text-sm bg-white"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground flex gap-1 mb-1">
                  Amount {form.scope !== "individual" && "(per employee)"} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="₹0"
                  className="w-full h-[38px] px-3 rounded-md border border-border text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground flex gap-1 mb-1">Payroll Date <span className="text-rose-500">*</span></label>
                <DatePicker
                  value={form.date}
                  onChange={val => setForm({ ...form, date: val })}
                  placeholder="Select date"
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground flex gap-1 mb-1">Reason <span className="text-rose-500">*</span></label>
              <textarea
                value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                rows={3}
                placeholder="e.g. Personal loan EMI 3/12"
                className="w-full px-3 py-2 rounded-md border border-border text-sm outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit for Approval
            </button>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !actingId && setRejecting(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground">Reject {rejecting.ref}</h2>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection"
              className="w-full px-3 py-2 rounded-md border border-border text-sm outline-none focus:border-rose-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRejecting(null)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold hover:bg-muted/50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!actingId}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-60"
              >
                {actingId && <Loader2 className="h-4 w-4 animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!applying}
        onClose={() => setApplying(null)}
        onConfirm={handleApply}
        variant="restore"
        title={`Apply ${applying?.type === "Bonus" ? "bonus" : "deduction"}?`}
        description={applying
          ? `${formatCurrency(applying.total_amount)} ${applying.typeLabel} for ${applying.appliedTo} will be ${applying.type === "Bonus" ? "added to" : "deducted from"} salary in payroll and shown on the payslip.`
          : ""}
        confirmText="Done"
      />
    </div>
  );
}
