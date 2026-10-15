import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Pencil, Plus, Timer, Trash2, X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { SearchableSelect } from "@/components/ui/select";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin } from "@/lib/permissions";
import { formatCurrency } from "@/components/payroll/payroll-data";
import { RequestOvertimeModal } from "./RequestOvertimeModal";

type Status = "Pending" | "Approved" | "Rejected";

interface OvertimeRequest {
  _id: string;
  employee_id: string;
  employee_name: string;
  emp_code?: string;
  department?: string;
  date: string;
  hours: number;
  requested_hours?: number;
  reason: string;
  worked_hours?: number;
  standard_hours?: number;
  status: Status;
  decision_note?: string | null;
  decided_by?: { name: string } | null;
  pay: { amount: number; normal_hours: number; double_hours: number; holiday_hours: number; holiday: boolean };
}

interface OvertimeResponse {
  can_approve: boolean;
  rules: { enable_ot: boolean; standard_hours: number; ot_rate: number; double_ot_after: number; holiday_ot_multiplier: number };
  items: OvertimeRequest[];
}

const STATUS_STYLE: Record<Status, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
};

const STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Pending", value: "Pending" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
];

const currentMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

/** Overtime page, opened from the Dashboard (not listed in the sidebar). */
export function Overtime() {
  const { user } = useAuth();
  // Admin / Sub-Admin only approve; HR and employees request their own overtime
  const roleName = String((user as any)?.role || "").trim().toLowerCase();
  const isHR = roleName === "hr" || String(user?.department || "").trim().toLowerCase() === "hr";
  const canRequest = isHR || !(isUserAdmin(user) || ["admin", "superadmin", "sub-admin", "subadmin"].includes(roleName));
  // Approvers open on the pending approvals; employees on their own requests
  const [tab, setTab] = useState<"mine" | "all">("all");
  const [status, setStatus] = useState("Pending");
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<OvertimeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Approver's hours per pending request (defaults to the requested hours)
  const [editHours, setEditHours] = useState<Record<string, string>>({});
  // Request being edited by Admin / HR (hours and reason)
  const [editing, setEditing] = useState<{ id: string; hours: string; reason: string } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams({ scope: tab, month });
      if (status) q.set("status", status);
      setData(await api.get<OvertimeResponse>(`/overtime?${q}`, { showLoader: false }));
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [tab, status, month]);

  useEffect(() => {
    load();
  }, [load]);

  // Not an approver: the server returns only their own requests — show them as such
  useEffect(() => {
    if (data && !data.can_approve && tab === "all") {
      setTab("mine");
      setStatus("");
    }
  }, [data, tab]);

  const decide = async (req: OvertimeRequest, decision: "Approved" | "Rejected") => {
    let note: string | null = null;
    if (decision === "Rejected") {
      note = window.prompt("Reason for rejecting (optional)") ?? null;
    }
    let hours: number | undefined;
    if (decision === "Approved") {
      hours = Number(editHours[req._id] ?? req.hours);
      if (!hours || hours <= 0 || hours > 16) {
        toast.error("Approved hours must be between 0 and 16");
        return;
      }
    }
    setBusyId(req._id);
    try {
      await api.patch(`/overtime/${req._id}/status`, { status: decision, note, hours }, { showLoader: false });
      toast.success(`Overtime ${decision.toLowerCase()}`);
      await load();
    } catch {
      // error toast shown by api
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const hours = Number(editing.hours);
    if (!hours || hours <= 0 || hours > 16) { toast.error("Hours must be between 0 and 16"); return; }
    if (editing.reason.trim().length < 3) { toast.error("Write the reason"); return; }
    setBusyId(editing.id);
    try {
      await api.put(`/overtime/${editing.id}`, { hours, reason: editing.reason.trim() }, { showLoader: false });
      toast.success("Overtime request updated");
      setEditing(null);
      await load();
    } catch {
      // error toast shown by api
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (req: OvertimeRequest) => {
    if (!window.confirm("Cancel this overtime request?")) return;
    setBusyId(req._id);
    try {
      await api.delete(`/overtime/${req._id}`, { showLoader: false });
      toast.success("Overtime request cancelled");
      await load();
    } catch {
      // error toast shown by api
    } finally {
      setBusyId(null);
    }
  };

  const items = data?.items ?? [];
  const rules = data?.rules;
  const ownId = String(user?.id ?? "");
  const approvedHours = items.filter(i => i.status === "Approved").reduce((t, i) => t + i.hours, 0);
  const approvedPay = items.filter(i => i.status === "Approved").reduce((t, i) => t + i.pay.amount, 0);
  const pendingCount = items.filter(i => i.status === "Pending").length;

  return (
    <div className="w-full min-w-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
            {/* Opened from the Dashboard (not in the sidebar) — go back there */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("navigate_tab", { detail: "/dashboard" }))}
              title="Back to Dashboard"
              className="mr-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Timer className="h-7 w-7 text-emerald-600" /> Overtime
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {rules
              ? rules.enable_ot
                ? `Standard day ${rules.standard_hours} hrs · ₹${rules.ot_rate}/hr · 2x after ${rules.double_ot_after} hrs · Holiday/Sunday ${rules.holiday_ot_multiplier}x · paid only after approval`
                : "Overtime is turned off in Payroll Settings"
              : "Request overtime and track approvals"}
          </p>
        </div>
        {canRequest && (
          <button
            onClick={() => setIsRequestOpen(true)}
            disabled={rules ? !rules.enable_ot : false}
            className="flex items-center justify-center gap-2 bg-[#0c7851] hover:bg-[#00925e] text-white px-4 py-2 rounded-lg text-[13px] font-semibold shadow-sm disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Request Overtime
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Admin has no own requests — only HR gets both tabs */}
        {data?.can_approve && canRequest && (
          <div className="flex rounded-lg border border-border/80 bg-white p-0.5 shadow-sm">
            {(["all", "mine"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn("px-3 py-1.5 rounded-md text-[13px] font-semibold", tab === t ? "bg-[#0c7851] text-white" : "text-foreground/70 hover:bg-muted/50")}
              >
                {t === "all" ? "All Requests" : "My Requests"}
              </button>
            ))}
          </div>
        )}
        <input
          type="month"
          value={month}
          onChange={e => e.target.value && setMonth(e.target.value)}
          className="h-[38px] px-3 rounded-lg border border-border/80 bg-white text-[13px] font-semibold text-foreground/80 shadow-sm outline-none focus:border-emerald-500"
        />
        <SearchableSelect
          value={status}
          onChange={v => setStatus(v ?? "")}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          className="w-[160px] bg-white border border-border/80 text-[13px] font-semibold text-foreground/80 rounded-lg h-[38px] shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs text-muted-foreground">Approved hours</p>
          <p className="mt-1 text-xl font-bold">{approvedHours} hrs</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs text-muted-foreground">Approved OT pay</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(approvedPay)}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs text-muted-foreground">Pending approval</p>
          <p className="mt-1 text-xl font-bold text-amber-600">{pendingCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline-block" /></div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No overtime requests for this month.</p>
        ) : (
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
              <tr>
                {tab === "all" && <th className="px-4 py-3 font-semibold">Employee</th>}
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">OT hours</th>
                <th className="px-4 py-3 font-semibold">Worked</th>
                <th className="px-4 py-3 font-semibold">OT pay</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(req => (
                <tr key={req._id} className="border-t border-border/60 align-top">
                  {tab === "all" && (
                    <td className="px-4 py-3">
                      <p className="font-semibold">{req.employee_name}</p>
                      <p className="text-[11px] text-muted-foreground">{[req.emp_code, req.department].filter(Boolean).join(" · ")}</p>
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(req.date)}
                    {req.pay.holiday && <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">Holiday</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    {editing?.id === req._id ? (
                      <div className="flex w-[84px] items-center rounded-lg border border-border bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/15">
                        <input
                          type="number"
                          min="0.25"
                          max="16"
                          step="0.25"
                          value={editing.hours}
                          onChange={e => setEditing({ ...editing, hours: e.target.value })}
                          className="w-full bg-transparent pl-2.5 pr-1 py-1.5 text-[13px] font-semibold text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <span className="pr-2.5 text-[12px] font-normal text-muted-foreground">hrs</span>
                      </div>
                    ) : data?.can_approve && tab === "all" && req.status === "Pending" ? (
                      <div className="flex w-[84px] items-center rounded-lg border border-border bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/15">
                        <input
                          type="number"
                          min="0.25"
                          max="16"
                          step="0.25"
                          value={editHours[req._id] ?? String(req.hours)}
                          onChange={e => setEditHours(h => ({ ...h, [req._id]: e.target.value }))}
                          title="Change the hours before approving"
                          className="w-full bg-transparent pl-2.5 pr-1 py-1.5 text-[13px] font-semibold text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <span className="pr-2.5 text-[12px] font-normal text-muted-foreground">hrs</span>
                      </div>
                    ) : (
                      <>{req.hours} hrs</>
                    )}
                    {req.requested_hours !== undefined && req.requested_hours !== req.hours && (
                      <p className="text-[11px] font-normal text-muted-foreground">requested {req.requested_hours} hrs</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {req.worked_hours ?? 0} / {req.standard_hours ?? 0} hrs
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{formatCurrency(req.pay.amount)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {req.pay.holiday
                        ? `${req.pay.holiday_hours} hrs × ${rules?.holiday_ot_multiplier ?? 1}x`
                        : req.pay.double_hours > 0
                          ? `${req.pay.normal_hours} hrs + ${req.pay.double_hours} hrs × 2`
                          : `${req.pay.normal_hours} hrs`}
                    </p>
                  </td>
                  <td className="px-4 py-3 max-w-[260px]">
                    {editing?.id === req._id ? (
                      <textarea
                        value={editing.reason}
                        onChange={e => setEditing({ ...editing, reason: e.target.value })}
                        rows={2}
                        className="w-full min-w-[200px] rounded-lg border border-border bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 resize-none"
                      />
                    ) : (
                      <p className="line-clamp-2">{req.reason}</p>
                    )}
                    {req.decision_note && <p className="mt-1 text-[11px] text-rose-600">Note: {req.decision_note}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", STATUS_STYLE[req.status])}>{req.status}</span>
                    {req.decided_by?.name && <p className="mt-1 text-[11px] text-muted-foreground">by {req.decided_by.name}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {busyId === req._id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : editing?.id === req._id ? (
                        <>
                          <button onClick={saveEdit} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700">
                            <Check className="h-3.5 w-3.5" /> Save
                          </button>
                          <button onClick={() => setEditing(null)} className="flex items-center gap-1 rounded-lg border border-border/80 px-2.5 py-1.5 text-[12px] font-semibold text-foreground/70 hover:bg-muted/50">
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Only Admin / HR edit requests; HR not their own (an Admin does) */}
                          {data?.can_approve && tab === "all" && !(canRequest && req.employee_id === ownId) && (
                            <button
                              onClick={() => setEditing({ id: req._id, hours: String(req.hours), reason: req.reason })}
                              title="Edit hours and reason"
                              className="rounded-lg border border-border/80 p-1.5 text-muted-foreground hover:text-emerald-700 hover:bg-muted/50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {data?.can_approve && tab === "all" && req.status === "Pending" && (
                            <>
                              <button onClick={() => decide(req, "Approved")} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700">
                                <Check className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button onClick={() => decide(req, "Rejected")} className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-700 hover:bg-rose-100">
                                <X className="h-3.5 w-3.5" /> Reject
                              </button>
                            </>
                          )}
                          {req.status === "Pending" && req.employee_id === ownId && (
                            <button onClick={() => cancel(req)} title="Cancel request" className="rounded-lg border border-border/80 p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-muted/50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RequestOvertimeModal open={isRequestOpen} onClose={() => setIsRequestOpen(false)} onCreated={load} />
    </div>
  );
}
