import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { formatCurrency } from "./payroll-data";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Users, Gift, MinusCircle, PlayCircle, CheckCircle2, Lock, FileSpreadsheet, FileText, Send, Loader2, ChevronDown } from "lucide-react";
import { SearchInput } from "@/components/common/SearchInput";
import { SearchableSelect } from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/components/auth/AuthContext";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

type PayrollStage = "not_generated" | "generated" | "approved" | "locked";
type ReviewStatus = "pending" | "verified" | "on_hold";

interface PayrollRow {
  id: string;
  employee: string;
  empId: string;
  department: string;
  designation: string;
  working: number;
  present: number;
  payable_days: number;
  per_day: number;
  absent: number;
  leave: number;
  paid_leave: number;
  carry_forward_in?: number;
  carry_forward_out?: number;
  unpaid_leave: number;
  excess_leave?: number;
  half_day_converted?: number;
  half_day_details?: { date: string; hours: number; required: number; result: string }[];
  not_joined_days: number;
  exit_days?: number;
  salary_changes?: { date: string; gross: number }[];
  lop_days: number;
  upcoming_days?: number;
  otHrs: number;
  gross: number;
  ot_pay: number;
  bonus: number;
  lop_amount: number;
  not_due_amount?: number;
  structure_deductions: number;
  penalty_deductions: number;
  other_deductions: number;
  deduction: number;
  netSalary: number;
  warnings: string[];
  review_status?: ReviewStatus;
  review_note?: string | null;
  reviewed_by?: Actor | null;
}

interface Actor {
  id: string;
  name: string;
}

interface PayrollRun {
  month: string;
  status: PayrollStage;
  rows: PayrollRow[];
  summary: {
    company_expense: number;
    eligible: number;
    employees: number;
    total_bonus: number;
    total_deduction: number;
    total_not_due?: number;
    upcoming_days?: number;
    total_net: number;
  };
  calendar: {
    total_days: number;
    holidays: number;
    working_days: number;
    counted_until: string;
  };
  rules: {
    paid_leave_per_month: number;
    unpaid_leave_cap: number;
    half_day_hours: number;
    standard_hours: number;
    enable_ot: boolean;
    ot_rate: number;
    double_ot_after: number;
    holiday_ot_multiplier: number;
    carry_forward?: boolean;
    max_carry_forward?: number;
  };
  generated_by?: Actor | null;
  generated_at?: string | null;
  approved_by?: Actor | null;
  locked_by?: Actor | null;
  payslips_sent_at?: string | null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ label: m, value: String(i + 1).padStart(2, "0") }));

const statusLabel: Record<PayrollStage, string> = {
  not_generated: "Not Generated",
  generated: "Generated",
  approved: "Approved",
  locked: "Locked 🔒",
};

const statusColor: Record<PayrollStage, string> = {
  not_generated: "bg-muted/50 text-foreground/80 border border-border",
  generated: "bg-amber-100 text-amber-700 border border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  locked: "bg-slate-100 text-slate-600 border border-slate-200",
};

const REVIEW_OPTIONS: { value: ReviewStatus; label: string; cls: string }[] = [
  { value: "pending", label: "Pending Review", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "verified", label: "Verified", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "on_hold", label: "On Hold", cls: "bg-rose-100 text-rose-700 border-rose-200" },
];
const reviewOf = (s?: ReviewStatus) => REVIEW_OPTIONS.find(o => o.value === s) ?? REVIEW_OPTIONS[0]!;

const fmtDays = (n?: number | null) => {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

// Payroll runs saved by an older version may miss newer fields — fill safe defaults
const normalizeRun = <T extends PayrollRun>(run: T): T => ({
  ...run,
  rows: (run.rows ?? []).map(r => {
    const payable = r.payable_days ?? (r.present ?? 0) + (r.paid_leave ?? 0);
    return {
      ...r,
      warnings: r.warnings ?? [],
      payable_days: payable,
      per_day: r.per_day ?? (r.working ? r.gross / r.working : 0),
      lop_days: r.lop_days ?? Math.max(0, (r.working ?? 0) - payable),
    };
  }),
});

const EXPORT_COLUMNS: [string, (r: PayrollRow) => string | number][] = [
  ["Employee", r => r.employee],
  ["Emp ID", r => r.empId],
  ["Department", r => r.department],
  ["Working Days", r => r.working],
  ["Present", r => r.present],
  ["Absent", r => r.absent],
  ["Leave", r => r.leave],
  ["Payable Days", r => r.payable_days],
  ["LOP Days", r => r.lop_days],
  ["Gross", r => r.gross],
  ["Bonus", r => r.bonus],
  ["LOP Deduction", r => r.lop_amount],
  ["Salary Deductions", r => r.structure_deductions],
  ["Penalties", r => r.penalty_deductions],
  ["Other Deductions", r => r.other_deductions],
  ["Total Deduction", r => r.deduction],
  ["Net Salary", r => r.netSalary],
];

export function PayrollProcessing() {
  const { user } = useAuth();
  const role = String((user as any)?.role || (user as any)?.system_role || "").toLowerCase().trim();
  const canApprove = ["admin", "subadmin", "super admin", "superadmin"].includes(role);

  const now = new Date();
  const [searchTerm, setSearchTerm] = useState("");
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const monthKey = `${year}-${month}`;
  const monthName = MONTHS[Number(month) - 1];
  const stage: PayrollStage = run?.status ?? "not_generated";

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1].map(v => ({ label: String(v), value: String(v) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRun = useCallback(async () => {
    setIsLoading(true);
    setRun(null);
    try {
      const res = await api.get<PayrollRun>(`/payroll/processing?month=${monthKey}`, { showLoader: false });
      setRun(normalizeRun(res));
    } catch {
      setRun(null);
    } finally {
      setIsLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  const rows = run?.rows ?? [];
  const filteredRuns = rows.filter(r =>
    r.employee.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.empId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { items: sortedRuns, requestSort, sortConfig } = useSortableData(filteredRuns);

  const runAction = async (action: "generate" | "approve" | "lock", successMsg: string) => {
    setBusyAction(action);
    try {
      const res = await api.post<PayrollRun>(`/payroll/processing/${monthKey}/${action}`, {}, { showLoader: false });
      setRun(normalizeRun(res));
      toast.success(successMsg);
    } catch {
      // error toast shown by api
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerate = () =>
    runAction("generate", `Payroll generated for ${monthName} ${year} — ${run?.summary.eligible ?? 0} employees processed.`);
  const handleApprove = () => {
    const onHold = rows.filter(r => r.review_status === "on_hold").length;
    runAction("approve", `Payroll approved — all employees verified${onHold ? ` (${onHold} kept on hold)` : ""}. Ready to lock and disburse.`);
  };
  const handleLock = () => runAction("lock", "Payroll locked. No further edits allowed.");

  const requireGenerated = () => {
    if (stage === "not_generated") {
      toast.error("Generate payroll first before exporting.");
      return false;
    }
    return true;
  };

  const handleExcelExport = () => {
    if (!requireGenerated()) return;
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      EXPORT_COLUMNS.map(([h]) => escape(h)).join(","),
      ...rows.map(r => EXPORT_COLUMNS.map(([, get]) => escape(get(r))).join(","))
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Payroll exported for Excel.");
  };

  const handlePdfExport = () => {
    if (!requireGenerated() || !run) return;
    const esc = (v: string | number) => String(v).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const money = (n: number) => formatCurrency(n);
    const body = rows.map(r => `<tr>
      <td>${esc(r.employee)}<br><small>${esc(r.empId)}</small></td>
      <td>${r.working}</td><td>${fmtDays(r.present)}</td><td>${fmtDays(r.absent)}</td><td>${fmtDays(r.leave)}</td><td>${fmtDays(r.payable_days)}</td>
      <td class="r">${money(r.gross)}</td><td class="r">${money(r.bonus)}</td><td class="r">-${money(r.deduction)}</td><td class="r"><b>${money(r.netSalary)}</b></td>
    </tr>`).join("");
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Allow pop-ups to export PDF.");
      return;
    }
    win.document.write(`<!doctype html><html><head><title>Payroll ${monthName} ${year}</title><style>
      body{font-family:system-ui,sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin:0}p{color:#555;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-top:16px}
      th,td{border-bottom:1px solid #ddd;padding:6px;text-align:center}th{background:#f3f4f6;text-transform:uppercase;font-size:10px}
      td:first-child,th:first-child{text-align:left}.r{text-align:right}small{color:#777}
      tfoot td{font-weight:bold;border-top:2px solid #111}
    </style></head><body>
      <h1>Payroll — ${monthName} ${year}</h1>
      <p>Status: ${statusLabel[stage]} · ${run.calendar.working_days} working days · ${rows.length} employees</p>
      <table><thead><tr><th>Employee</th><th>Working</th><th>Present</th><th>Absent</th><th>Leave</th><th>Payable</th><th class="r">Gross</th><th class="r">Bonus</th><th class="r">Deduction</th><th class="r">Net</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="6">Total</td><td class="r">${money(rows.reduce((s, r) => s + r.gross, 0))}</td><td class="r">${money(run.summary.total_bonus)}</td><td class="r">-${money(run.summary.total_deduction)}</td><td class="r">${money(run.summary.total_net)}</td></tr></tfoot>
      </table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleReviewChange = async (row: PayrollRow, review: ReviewStatus) => {
    if ((row.review_status ?? "pending") === review) return;
    setBusyAction(`review:${row.id}`);
    try {
      const res = await api.patch<PayrollRun>(
        `/payroll/processing/${monthKey}/rows/${row.id}/status`, { status: review }, { showLoader: false }
      );
      setRun(normalizeRun(res));
      toast.success(`${row.employee} marked as ${reviewOf(review).label}.`);
    } catch {
      // error toast shown by api
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendPayslips = async () => {
    if (stage !== "locked") {
      toast.error("Lock payroll before sending payslips.");
      return;
    }
    setBusyAction("send");
    try {
      const res = await api.post<PayrollRun & { sent: number; published?: number }>(`/payroll/processing/${monthKey}/send-payslips`, {}, { showLoader: false });
      setRun(normalizeRun(res));
      toast.success(`${res.published ?? res.sent} payslips generated — employees can view them in Payslips.`);
    } catch {
      // error toast shown by api
    } finally {
      setBusyAction(null);
    }
  };

  const summary = run?.summary;
  const periodLabel = `${(monthName ?? "").slice(0, 3)} ${year}`;
  const cardAmount = (n?: number) => (isLoading ? "…" : formatCurrency(n ?? 0));
  const processedCount = stage === "not_generated" ? 0 : summary?.eligible ?? 0;
  const spinner = (action: string) => busyAction === action && <Loader2 className="h-4 w-4 animate-spin" />;
  const headerCls = "py-3 sm:py-4 px-3 sm:px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full min-w-0 max-w-[1400px]">

      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-border pb-5 sm:pb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Payroll Processing</h1>
          <p className="mt-1 text-xs sm:text-[14px] text-muted-foreground">{monthName} {year} · Attendance, leave, bonuses and recoveries fetched automatically</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <SearchableSelect
              value={month}
              onChange={(val) => val && setMonth(val)}
              options={MONTH_OPTIONS}
              className="w-full sm:w-[140px] bg-white border border-border/80 rounded-lg text-[13px] font-semibold text-foreground/80 focus:border-emerald-500 shadow-sm"
            />
          </div>
          <div className="relative flex-1 sm:flex-initial">
            <SearchableSelect
              value={year}
              onChange={(val) => val && setYear(val)}
              options={yearOptions}
              className="w-full sm:w-[100px] bg-white border border-border/80 rounded-lg text-[13px] font-semibold text-foreground/80 focus:border-emerald-500 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-[#0b6c4b] rounded-2xl p-4 sm:p-5 shadow-sm relative text-white min-w-0">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-emerald-50">Net Salary Payable</p>
            <span className="text-[14px] font-bold text-emerald-100">₹</span>
          </div>
          <p className="text-2xl xl:text-[30px] font-black break-words">{cardAmount(summary?.total_net)}</p>
          <p className="text-[12px] text-emerald-100 mt-1">
            {periodLabel} · Earned {cardAmount(summary?.company_expense)}
            {/* Penalties, PF/PT and recoveries cut from the earned salary (LOP is already outside it) */}
            {!isLoading && (summary?.company_expense ?? 0) > (summary?.total_net ?? 0) &&
              ` − ${formatCurrency((summary?.company_expense ?? 0) - (summary?.total_net ?? 0))} deductions`}
          </p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-4 sm:p-5 shadow-sm relative min-w-0">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Employees Processed</p>
            <Users className="h-4 w-4 text-[#0b6c4b]" />
          </div>
          <p className="text-2xl xl:text-[30px] font-black break-words text-foreground">{isLoading ? "…" : processedCount}</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            {summary?.eligible ?? 0} with salary · {summary?.employees ?? 0} employees
          </p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-4 sm:p-5 shadow-sm relative min-w-0">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Total Bonus</p>
            <Gift className="h-4 w-4 text-[#0b6c4b]" />
          </div>
          <p className="text-2xl xl:text-[30px] font-black break-words text-foreground">{cardAmount(summary?.total_bonus)}</p>
          <p className="text-[12px] text-muted-foreground mt-1">{periodLabel} · Approved bonuses</p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-4 sm:p-5 shadow-sm relative min-w-0">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Total Deduction</p>
            <MinusCircle className="h-4 w-4 text-[#0b6c4b]" />
          </div>
          <p className="text-2xl xl:text-[30px] font-black break-words text-foreground">{cardAmount(summary?.total_deduction)}</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            {!isLoading && (summary?.total_not_due ?? 0) > 0
              ? `${periodLabel} till ${formatDate(run!.calendar.counted_until)} · ${formatCurrency(summary!.total_not_due!)} for ${fmtDays(summary!.upcoming_days)} upcoming days not counted`
              : `${periodLabel} · LOP, salary deductions, penalties & recoveries`}
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6 bg-white border border-border/60 p-3 rounded-2xl shadow-sm">
        <div className={cn("px-4 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap", statusColor[stage])}>
          Status: {statusLabel[stage]}
        </div>
        {stage !== "not_generated" && rows.length > 0 && (
          <p className="text-[12px] font-semibold text-muted-foreground whitespace-nowrap">
            Verified {rows.filter(r => r.review_status === "verified").length}/{rows.length}
            {rows.some(r => r.review_status === "on_hold") && ` · ${rows.filter(r => r.review_status === "on_hold").length} on hold`}
          </p>
        )}
        <div className="w-px h-6 bg-border/60 mx-1 hidden sm:block"></div>

        {/* Generate — always available unless locked */}
        <button
          onClick={handleGenerate}
          disabled={stage === "locked" || !!busyAction || isLoading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[13px] font-bold shadow-sm transition-colors whitespace-nowrap disabled:cursor-not-allowed",
            stage === "locked"
              ? "bg-muted text-muted-foreground opacity-50"
              : "bg-primary hover:bg-[#00925e] text-primary-foreground disabled:opacity-60"
          )}
        >
          {spinner("generate") || <PlayCircle className="h-4 w-4" />} {stage === "generated" || stage === "approved" ? "Re-Generate" : "Generate Payroll"}
        </button>

        {/* Approve — enabled only after generated */}
        <button
          onClick={handleApprove}
          disabled={stage !== "generated" || !canApprove || !!busyAction}
          title={!canApprove ? "Only Admin can approve payroll" : undefined}
          className={cn(
            "flex items-center gap-2 border px-4 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap",
            stage === "generated" && canApprove
              ? "bg-white border-emerald-400 text-emerald-700 hover:bg-emerald-50"
              : "bg-white border-border/60 text-muted-foreground opacity-50 cursor-not-allowed"
          )}
        >
          {spinner("approve") || <CheckCircle2 className="h-4 w-4" />} Approve Payroll
        </button>

        {/* Lock — enabled only after approved */}
        <button
          onClick={handleLock}
          disabled={stage !== "approved" || !canApprove || !!busyAction}
          title={!canApprove ? "Only Admin can lock payroll" : undefined}
          className={cn(
            "flex items-center gap-2 border px-4 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap",
            stage === "approved" && canApprove
              ? "bg-white border-slate-400 text-slate-700 hover:bg-slate-50"
              : "bg-white border-border/60 text-muted-foreground opacity-50 cursor-not-allowed"
          )}
        >
          {spinner("lock") || <Lock className="h-4 w-4" />} Lock Payroll
        </button>

        <button
          onClick={handleExcelExport}
          className="flex items-center gap-2 bg-white border border-border/80 px-3 sm:px-4 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-foreground/80 text-[13px] font-semibold hover:bg-muted/50 transition-colors shadow-sm whitespace-nowrap"
        >
          <FileSpreadsheet className="h-4 w-4" /> Export Excel
        </button>
        <button
          onClick={handlePdfExport}
          className="flex items-center gap-2 bg-white border border-border/80 px-3 sm:px-4 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-foreground/80 text-[13px] font-semibold hover:bg-muted/50 transition-colors shadow-sm whitespace-nowrap"
        >
          <FileText className="h-4 w-4" /> Export PDF
        </button>
        <button
          onClick={handleSendPayslips}
          disabled={stage !== "locked" || !!busyAction}
          title={stage !== "locked" ? "Lock payroll first to send payslips" : undefined}
          className="flex items-center gap-2 bg-white border border-border/80 px-3 sm:px-4 py-2 rounded-lg text-foreground/80 text-[13px] font-semibold hover:bg-muted/50 transition-colors shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {spinner("send") || <Send className="h-4 w-4" />} {run?.payslips_sent_at ? "Resend Payslips" : "Send Payslips"}
        </button>

        {run?.generated_by && (
          <p className="text-[11px] text-muted-foreground w-full xl:w-auto xl:ml-auto">
            Generated by {run.generated_by.name}
            {run.approved_by && ` · Approved by ${run.approved_by.name}`}
            {run.locked_by && ` · Locked by ${run.locked_by.name}`}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-border/60 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-foreground">Payroll Preview</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {run
                ? <>
                    Salary paid on attendance · {run.calendar.working_days} working days ({run.calendar.holidays} holidays) · Attendance till {formatDate(run.calendar.counted_until)}
                    {` · ${run.rules.paid_leave_per_month} paid + ${run.rules.unpaid_leave_cap ?? 0} unpaid leave/month${run.rules.carry_forward ? ` · Carry forward up to ${run.rules.max_carry_forward ?? 0}` : ""} · Half day = ${run.rules.half_day_hours} hrs`}
                  </>
                : "Computed from effective salary and payroll settings"}
            </p>
          </div>
          <SearchInput
            placeholder="Search employees..."
            value={searchTerm}
            onChange={setSearchTerm}
            containerClassName="w-full sm:w-64"
          />
        </div>

        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse min-w-[420px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/50/50">
                <SortableHeader label="Employee" sortKey="employee" currentSort={sortConfig} onSort={requestSort} className={headerCls} />
                <SortableHeader label="Working" sortKey="working" currentSort={sortConfig} onSort={requestSort} className={cn(headerCls, "text-center hidden xl:table-cell")} />
                <SortableHeader label="Present" sortKey="present" currentSort={sortConfig} onSort={requestSort} className={cn(headerCls, "text-center hidden lg:table-cell")} />
                <SortableHeader label="Absent" sortKey="absent" currentSort={sortConfig} onSort={requestSort} className={cn(headerCls, "text-center hidden lg:table-cell")} />
                <SortableHeader label="Leave" sortKey="leave" currentSort={sortConfig} onSort={requestSort} className={cn(headerCls, "text-center hidden md:table-cell")} />
                <SortableHeader label="Payable" sortKey="payable_days" currentSort={sortConfig} onSort={requestSort} className={cn(headerCls, "text-center hidden sm:table-cell")} />
                <SortableHeader label="Gross" sortKey="gross" currentSort={sortConfig} onSort={requestSort} className={cn(headerCls, "text-right hidden md:table-cell")} />
                <SortableHeader label="Deduction" sortKey="deduction" currentSort={sortConfig} onSort={requestSort} className={cn(headerCls, "text-right hidden lg:table-cell")} />
                <SortableHeader label="Net Salary" sortKey="netSalary" currentSort={sortConfig} onSort={requestSort} className={cn(headerCls, "text-right")} />
                <th className={cn(headerCls, "text-center")}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground text-sm">
                    <Loader2 className="h-5 w-5 animate-spin inline-block" />
                  </td>
                </tr>
              ) : sortedRuns.map((r: PayrollRow) => (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className="hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 sm:py-4 px-3 sm:px-5 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#0b6c4b] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                          {r.employee.split(' ').filter(Boolean).map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-foreground leading-tight flex items-center gap-1.5">
                            {r.employee}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{r.empId || r.department}</p>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground ml-auto transition-transform", expandedId === r.id && "rotate-180")} />
                      </div>
                    </td>
                    <td className="hidden xl:table-cell py-4 px-5 text-center text-[13px] text-foreground/80">{r.working}</td>
                    <td className="hidden lg:table-cell py-4 px-5 text-center text-[13px] text-foreground/80">{fmtDays(r.present)}</td>
                    <td className="hidden lg:table-cell py-4 px-5 text-center text-[13px] text-foreground/80">{fmtDays(r.absent)}</td>
                    <td className="hidden md:table-cell py-4 px-5 text-center text-[13px] text-foreground/80">
                      {fmtDays(r.leave)}
                      {r.leave > 0 && (
                        <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {fmtDays(r.paid_leave)} paid · {fmtDays((r.unpaid_leave ?? 0) + (r.excess_leave ?? 0))} unpaid
                        </p>
                      )}
                    </td>
                    <td className="hidden sm:table-cell py-4 px-5 text-center text-[13px] font-bold text-foreground">{fmtDays(r.payable_days)}</td>
                    <td className="hidden md:table-cell py-4 px-5 text-right text-[13px] font-medium text-foreground/80">
                      {formatCurrency(r.gross)}
                    </td>
                    <td className="hidden lg:table-cell py-4 px-5 text-right text-[13px] font-medium text-rose-500">-{formatCurrency(r.deduction)}</td>
                    <td className="py-3 sm:py-4 px-3 sm:px-5 text-right text-[13px] sm:text-[14px] font-bold text-foreground whitespace-nowrap">{formatCurrency(r.netSalary)}</td>
                    <td className="py-3 sm:py-4 px-3 sm:px-5 text-center" onClick={e => e.stopPropagation()}>
                      {stage === "generated" || stage === "approved" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={!!busyAction}
                              title={r.reviewed_by ? `Updated by ${r.reviewed_by.name}` : "Check this employee's payroll and set a status"}
                              className={cn(
                                "inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-[10px] font-bold tracking-wide whitespace-nowrap disabled:opacity-60",
                                reviewOf(r.review_status).cls
                              )}
                            >
                              {busyAction === `review:${r.id}` && <Loader2 className="h-3 w-3 animate-spin" />}
                              {reviewOf(r.review_status).label}
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-1">
                            {REVIEW_OPTIONS.map(o => (
                              <DropdownMenuItem key={o.value} onSelect={() => handleReviewChange(r, o.value)} className="text-[12px] font-semibold">
                                <span className={cn("h-2 w-2 rounded-full border mr-2", o.cls)} />
                                {o.label}
                                {(r.review_status ?? "pending") === o.value && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-emerald-600" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className={cn(
                          "inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide whitespace-nowrap",
                          stage === "not_generated" ? "bg-white text-foreground/80 border border-border/80" : statusColor[stage]
                        )}>
                          {stage === "locked" ? `Locked · ${reviewOf(r.review_status).label}` : statusLabel[stage]}
                        </span>
                      )}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="bg-muted/30">
                      <td colSpan={10} className="px-3 sm:px-5 py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-[12px]">
                          <div className="space-y-1.5">
                            <p className="font-bold text-foreground uppercase text-[10px] tracking-widest mb-2">Attendance</p>
                            <Line label="Present" value={`${fmtDays(r.present)} days`} />
                            <Line label="Paid leave — no salary cut" value={`${fmtDays(r.paid_leave)} days`} />
                            {run?.rules.carry_forward && <Line label="Carried from last month" value={`${fmtDays(r.carry_forward_in ?? 0)} days`} />}
                            {run?.rules.carry_forward && <Line label="Carry to next month" value={`${fmtDays(r.carry_forward_out ?? 0)} days`} />}
                            <Line label="Payable days" value={`${fmtDays(r.payable_days)} of ${r.working}`} strong />
                            <p className="font-bold text-foreground uppercase text-[10px] tracking-widest pt-2">Salary cut for</p>
                            <Line label="Absent" value={`${fmtDays(r.absent)} days`} />
                            <Line label="Unpaid leave" value={`${fmtDays(r.unpaid_leave)} days`} />
                            {(r.excess_leave ?? 0) > 0 && <Line label="Leave beyond unpaid cap" value={`${fmtDays(r.excess_leave)} days`} />}
                            {r.not_joined_days > 0 && <Line label="Before joining" value={`${r.not_joined_days} days`} />}
                            {(r.exit_days ?? 0) > 0 && <Line label="After last working day" value={`${r.exit_days} days`} />}
                            {(r.half_day_converted ?? 0) > 0 && <Line label="Half-day → full-day leave" value={`${r.half_day_converted}`} />}
                          </div>
                          <div className="space-y-1.5">
                            <p className="font-bold text-foreground uppercase text-[10px] tracking-widest mb-2">Earnings</p>
                            <Line label="Gross salary" value={formatCurrency(r.gross)} />
                            <Line
                              label={(r.salary_changes?.length ?? 0) > 0
                                ? `Earned (${fmtDays(r.payable_days)} days, pro-rata on revised salary)`
                                : `Earned (${fmtDays(r.payable_days)} × ${formatCurrency(r.per_day)}/day)`}
                              value={formatCurrency(r.gross - r.lop_amount - (r.not_due_amount ?? 0))}
                              strong
                            />
                            {(r.not_due_amount ?? 0) > 0 && (
                              <Line label={`Not due yet (${fmtDays(r.upcoming_days)} upcoming days)`} value={formatCurrency(r.not_due_amount!)} />
                            )}
                            <Line label={`Overtime (${r.otHrs ?? 0} hrs approved)`} value={`+${formatCurrency(r.ot_pay ?? 0)}`} />
                            <Line label="Bonus" value={`+${formatCurrency(r.bonus)}`} />
                          </div>
                          <div className="space-y-1.5">
                            <p className="font-bold text-foreground uppercase text-[10px] tracking-widest mb-2">Deductions</p>
                            <Line label="Loss of pay" value={`-${formatCurrency(r.lop_amount)}`} />
                            <Line label="Salary structure (PF, PT…) · pro-rata" value={`-${formatCurrency(r.structure_deductions)}`} />
                            <Line label="Penalties" value={`-${formatCurrency(r.penalty_deductions)}`} />
                            <Line label="Recoveries / other" value={`-${formatCurrency(r.other_deductions)}`} />
                          </div>
                        </div>
                        {(r.half_day_details?.length ?? 0) > 0 && (
                          <div className="mt-4">
                            <p className="font-bold text-foreground uppercase text-[10px] tracking-widest mb-2">Half-day leaves</p>
                            <div className="flex flex-wrap gap-2">
                              {r.half_day_details!.map(h => (
                                <div
                                  key={h.date}
                                  className={cn(
                                    "rounded-lg border px-3 py-2 text-[12px]",
                                    h.result === "Full day leave" ? "border-rose-200 bg-rose-50" : "border-border bg-white"
                                  )}
                                >
                                  <p className="font-semibold text-foreground">{formatDate(h.date)}</p>
                                  <p className="text-muted-foreground">
                                    Worked {h.hours.toFixed(2)} / {h.required} hrs ·{" "}
                                    <span className={cn("font-semibold", h.result === "Full day leave" ? "text-rose-600" : "text-emerald-700")}>{h.result}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {r.warnings.map(w => (
                          <p key={w} className="mt-3 text-[12px] text-muted-foreground">{w}</p>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!isLoading && filteredRuns.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground text-sm">
                    {searchTerm
                      ? `No employees found matching "${searchTerm}"`
                      : "No active employees found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground/80", strong ? "font-bold" : "font-medium")}>{value}</span>
    </div>
  );
}
