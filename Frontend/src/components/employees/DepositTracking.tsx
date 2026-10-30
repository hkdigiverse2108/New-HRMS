import React, { useState, useMemo } from "react";
import { 
  ShieldCheck, 
  IndianRupee, 
  Search, 
  Clock, 
  Edit2, 
  Users, 
  GraduationCap, 
  Briefcase,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useEmployeesContext } from "./EmployeeContext";
import { Employee } from "./employee-data";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { getAvatarUrl, handleAvatarError } from "@/lib/config";

export function DepositTracking() {
  const { employees, updateEmployee } = useEmployeesContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "Intern" | "Employee">("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Modal states
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  // Form states for deposit update
  const [editDepositType, setEditDepositType] = useState<"Intern" | "Employee">("Employee");
  const [editAmountPaid, setEditAmountPaid] = useState<number>(0);
  const [editPaymentMode, setEditPaymentMode] = useState<string>("UPI");
  const [editPaymentDate, setEditPaymentDate] = useState<string>("");
  const [editRemarks, setEditRemarks] = useState<string>("");
  const [editIsRefunded, setEditIsRefunded] = useState<boolean>(false);
  const [editRefundAmount, setEditRefundAmount] = useState<number>(0);
  const [editRefundDate, setEditRefundDate] = useState<string>("");
  const [editRefundRemarks, setEditRefundRemarks] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Helper to determine if employee is intern
  const isIntern = (emp: Employee) => {
    const des = (emp.designation || "").toLowerCase();
    const role = (emp.role || "").toLowerCase();
    const pos = (emp.position || "").toLowerCase();
    return des.includes("intern") || role.includes("intern") || pos.includes("intern") || emp.depositAmount === 2000;
  };

  const getTargetDeposit = (emp: Employee) => {
    if (emp.depositAmount && Number(emp.depositAmount) > 0) return Number(emp.depositAmount);
    return isIntern(emp) ? 2000 : 10000;
  };

  const getDepositStatus = (emp: Employee): "Paid" | "Partial" | "Pending" | "Refunded" => {
    if (emp.depositStatus === "Refunded" || (emp as any).deposit_details?.status === "Refunded" || (emp as any).deposit_details?.refund_date) {
      return "Refunded";
    }
    const target = getTargetDeposit(emp);
    const paid = emp.depositPaid || 0;
    if (paid >= target && target > 0) return "Paid";
    if (paid > 0) return "Partial";
    return "Pending";
  };

  // Filter out Admins and Inactive/Deleted employees
  const validEmployees = useMemo(() => {
    return employees.filter(emp => {
      const role = String(emp.role || (emp as any).system_role || (emp as any).work_details?.system_role || "").toLowerCase();
      const isAdm = role.includes("admin") || Boolean((emp as any).is_superuser);
      const isInactive = Boolean(
        (emp as any).is_delete ||
        (emp as any).is_block ||
        emp.status === "Inactive" ||
        (emp as any).work_details?.is_delete ||
        (emp as any).work_details?.is_block
      );
      return !isAdm && !isInactive;
    });
  }, [employees]);

  // Aggregate Metrics (4 Specific KPIs requested)
  const stats = useMemo(() => {
    let totalTarget = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let paidCount = 0;
    let internCount = 0;
    let fullTimeCount = 0;

    validEmployees.forEach(emp => {
      const intern = isIntern(emp);
      if (intern) internCount++; else fullTimeCount++;
      const target = getTargetDeposit(emp);
      const paid = emp.depositPaid || 0;
      const st = getDepositStatus(emp);

      if (st === "Refunded") {
        const refundedAmt = Number((emp as any).deposit_details?.refund_amount || paid);
        totalCollected += Math.max(0, paid - refundedAmt);
      } else {
        totalTarget += target;
        totalCollected += paid;
        totalPending += Math.max(0, target - paid);
        if (paid >= target && target > 0) {
          paidCount++;
        }
      }
    });

    return {
      totalTarget,
      totalCollected,
      totalPending,
      paidCount,
      totalCandidates: validEmployees.length,
      internCount,
      fullTimeCount,
    };
  }, [validEmployees]);

  // Filtered employees list for Table
  const filteredEmployees = useMemo(() => {
    return validEmployees.filter(emp => {
      // 1. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (emp.name || "").toLowerCase().includes(q);
        const matchesId = (emp.employeeId || emp.id || "").toLowerCase().includes(q);
        const matchesEmail = (emp.email || "").toLowerCase().includes(q);
        const matchesDept = (emp.department || "").toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesEmail && !matchesDept) return false;
      }

      // 2. Type filter
      const intern = isIntern(emp);
      if (typeFilter === "Intern" && !intern) return false;
      if (typeFilter === "Employee" && intern) return false;

      // 3. Deposit status filter
      const st = getDepositStatus(emp);
      if (statusFilter !== "All") {
        if (statusFilter === "Paid" && st !== "Paid") return false;
        if (statusFilter === "Partial" && st !== "Partial") return false;
        if (statusFilter === "Pending" && (st === "Paid" || st === "Refunded")) return false;
        if (statusFilter === "Refunded" && st !== "Refunded") return false;
      }

      return true;
    });
  }, [validEmployees, searchQuery, typeFilter, statusFilter]);

  // Open modal with employee data
  const handleOpenDepositModal = (emp: Employee) => {
    setSelectedEmp(emp);
    const intern = isIntern(emp);
    setEditDepositType(intern ? "Intern" : "Employee");
    setEditAmountPaid(emp.depositPaid || 0);
    setEditPaymentMode(emp.depositPaymentDate ? "UPI" : "Cash");
    setEditPaymentDate(emp.depositPaymentDate || new Date().toISOString().split("T")[0] || "");
    setEditRemarks(emp.depositRemarks || "");

    const isRefund = emp.depositStatus === "Refunded" || (emp as any).deposit_details?.status === "Refunded";
    setEditIsRefunded(Boolean(isRefund));
    setEditRefundAmount(Number((emp as any).deposit_details?.refund_amount || emp.depositPaid || 0));
    setEditRefundDate(String((emp as any).deposit_details?.refund_date || new Date().toISOString().split("T")[0]));
    setEditRefundRemarks(String((emp as any).deposit_details?.refund_remarks || ""));

    setIsDepositModalOpen(true);
  };

  // Save deposit changes
  const handleSaveDeposit = async () => {
    if (!selectedEmp) return;
    setIsSaving(true);
    const targetAmount = editDepositType === "Intern" ? 2000 : 10000;
    
    // Auto status determination
    let finalStatus: "Paid" | "Partial" | "Pending" | "Refunded" = "Pending";
    if (editIsRefunded) {
      finalStatus = "Refunded";
    } else if (editAmountPaid >= targetAmount && targetAmount > 0) {
      finalStatus = "Paid";
    } else if (editAmountPaid > 0) {
      finalStatus = "Partial";
    } else {
      finalStatus = "Pending";
    }

    const payload = {
      depositAmount: targetAmount,
      depositPaid: editAmountPaid,
      depositStatus: finalStatus,
      depositPaymentDate: editPaymentDate,
      depositRemarks: editRemarks,
    };

    try {
      await updateEmployee(selectedEmp.id, payload);
      // Sync to backend deposit_details
      try {
        await api.put(`/employees/${selectedEmp.id}`, {
          deposit_details: {
            deposit_type: editDepositType,
            deposit_amount: targetAmount,
            amount_paid: editAmountPaid,
            status: finalStatus,
            payment_date: editPaymentDate || undefined,
            payment_mode: editPaymentMode,
            remarks: editRemarks,
            refund_amount: editIsRefunded ? editRefundAmount : 0,
            refund_date: editIsRefunded ? (editRefundDate || undefined) : null,
            refund_remarks: editIsRefunded ? editRefundRemarks : null,
          }
        }, { showErrorToast: false });
      } catch (err) {
        console.warn("Backend deposit update sync notice:", err);
      }
      toast.success("Security deposit updated successfully!");
      setIsDepositModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update deposit record");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Header Banner (Cleaned - Removed Document references) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-4 sm:p-6 md:p-8 rounded-3xl sm:rounded-[2.5rem] border border-border/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-0 pointer-events-none" />
        <div className="relative z-10 min-w-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-primary/10 text-primary rounded-2xl border border-primary/20 shadow-sm shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight">
                Security Deposit Tracking
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Track onboarding security deposits (₹2,000 for Interns, ₹10,000 for Full-Time), collections, remaining balances and refunds.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4 KPIs Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Total Deposit Value */}
        <div className="bg-card border border-border/60 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2 relative overflow-hidden group min-w-0 hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Deposit Value</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-foreground font-mono break-words">
            ₹{stats.totalTarget.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <span>Target value for active candidates</span>
          </div>
        </div>

        {/* KPI 2: Total Collected */}
        <div className="bg-card border border-border/60 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2 relative overflow-hidden group min-w-0 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Collected Deposits</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-foreground font-mono break-words">
            ₹{stats.totalCollected.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
            <span>Total collected from team</span>
          </div>
        </div>

        {/* KPI 3: Total Pending */}
        <div className="bg-card border border-border/60 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2 relative overflow-hidden group min-w-0 hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Deposits</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-foreground font-mono break-words">
            ₹{stats.totalPending.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
            <span>Remaining balance to collect</span>
          </div>
        </div>

        {/* KPI 4: Employee Breakdown */}
        <div className="bg-card border border-border/60 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2 relative overflow-hidden group min-w-0 hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Employee Breakdown</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {stats.paidCount} / {stats.totalCandidates} <span className="text-xs font-normal text-muted-foreground">Paid</span>
          </div>
          <div className="text-[11px] font-semibold text-blue-600 flex items-center gap-2">
            <span>{stats.internCount} Interns (₹2k)</span>
            <span>•</span>
            <span>{stats.fullTimeCount} Full-Time (₹10k)</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border/60 rounded-3xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate, ID or department..."
            className="w-full pl-10 pr-4 py-2 bg-muted/30 border border-border/60 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap shrink-0">
          {/* Type Filter */}
          <div className="flex flex-1 md:flex-none bg-muted/40 p-1 rounded-2xl border border-border/40">
            {(["All", "Intern", "Employee"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "flex-1 sm:flex-none justify-center whitespace-nowrap px-2 sm:px-3 py-1 min-h-[40px] sm:min-h-0 inline-flex items-center rounded-xl text-[11px] sm:text-xs font-bold transition-all",
                  typeFilter === t
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "All" ? "All Types" : t === "Intern" ? "🎓 Interns" : "💼 Full-Time"}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-auto min-h-[40px] md:min-h-0 md:h-9 px-3 bg-muted/30 border border-border/60 rounded-xl text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Pending">Pending</option>
            <option value="Refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Main Table (Document Checklist Column REMOVED, Remaining Column ADDED) */}
      <div className="bg-card border border-border/60 rounded-3xl sm:rounded-[2.5rem] shadow-sm overflow-hidden min-w-0">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground space-y-2">
            <ShieldCheck className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-sm font-semibold">No candidates found matching the filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] whitespace-nowrap text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground font-black uppercase tracking-wider bg-muted/20">
                  <th className="py-3 sm:py-4 px-3 sm:px-6">Candidate / Employee</th>
                  <th className="py-4 px-4">Designation & Department</th>
                  <th className="py-4 px-4 text-center">Type</th>
                  <th className="py-4 px-4 text-right">Standard Deposit</th>
                  <th className="py-3 sm:py-4 px-3 sm:px-4 text-right">Amount Paid</th>
                  <th className="py-4 px-4 text-right">Remaining Balance</th>
                  <th className="py-3 sm:py-4 px-3 sm:px-4 text-center">Deposit Status</th>
                  <th className="py-3 sm:py-4 px-3 sm:px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredEmployees.map((emp) => {
                  const intern = isIntern(emp);
                  const targetDeposit = getTargetDeposit(emp);
                  const paid = emp.depositPaid || 0;
                  const st = getDepositStatus(emp);
                  const remaining = st === "Refunded" ? 0 : Math.max(0, targetDeposit - paid);

                  return (
                    <tr key={emp.id} className="hover:bg-muted/30 transition-colors group">
                      {/* Name & Photo */}
                      <td className="py-3.5 px-3 sm:px-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={getAvatarUrl(emp.avatar || emp.profile_photo, emp.name)}
                            alt={emp.name}
                            onError={handleAvatarError}
                            className="w-9 h-9 rounded-xl object-cover border border-border/50 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-extrabold text-foreground text-sm leading-snug truncate max-w-[180px] sm:max-w-[220px]" title={emp.name}>
                              {emp.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[180px] sm:max-w-[220px]">
                              {emp.employeeId || emp.id} • {emp.email || "No email"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Designation & Department */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-foreground">{emp.designation || emp.role || "Employee"}</div>
                        <div className="text-[11px] text-muted-foreground">{emp.department || "General"}</div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1",
                            intern
                              ? "bg-purple-500/10 text-purple-700 border border-purple-500/20"
                              : "bg-blue-500/10 text-blue-700 border border-blue-500/20"
                          )}
                        >
                          {intern ? <GraduationCap className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                          {intern ? "Intern (₹2k)" : "Full-Time (₹10k)"}
                        </span>
                      </td>

                      {/* Standard Deposit */}
                      <td className="py-3.5 px-4 text-right font-black text-foreground font-mono text-sm">
                        ₹{targetDeposit.toLocaleString("en-IN")}
                      </td>

                      {/* Amount Paid */}
                      <td className="py-3.5 px-3 sm:px-4 text-right font-black font-mono text-sm whitespace-nowrap">
                        <span className={paid >= targetDeposit ? "text-emerald-600" : paid > 0 ? "text-amber-600" : "text-muted-foreground"}>
                          ₹{paid.toLocaleString("en-IN")}
                        </span>
                        {emp.depositPaymentDate && (
                          <div className="text-[10px] font-medium text-muted-foreground">
                            {emp.depositPaymentDate}
                          </div>
                        )}
                      </td>

                      {/* Remaining Balance (Explicitly Added) */}
                      <td className="py-3.5 px-4 text-right font-black font-mono text-sm">
                        {st === "Refunded" ? (
                          <span className="text-blue-600 text-xs font-bold">₹0 (Refunded)</span>
                        ) : remaining === 0 ? (
                          <span className="text-emerald-600 font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> ₹0
                          </span>
                        ) : (
                          <span className="text-rose-600 font-black inline-flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> ₹{remaining.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>

                      {/* Deposit Status (Auto Status) */}
                      <td className="py-3.5 px-3 sm:px-4 text-center">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider inline-block",
                            st === "Paid" && "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30",
                            st === "Partial" && "bg-amber-500/15 text-amber-700 border border-amber-500/30",
                            st === "Pending" && "bg-rose-500/15 text-rose-700 border border-rose-500/30",
                            st === "Refunded" && "bg-blue-500/15 text-blue-700 border border-blue-500/30"
                          )}
                        >
                          {st === "Paid" ? "Paid ✅" : st === "Partial" ? "Partial 🟡" : st === "Refunded" ? "Refunded 🔵" : "Pending 🔴"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 sm:px-6 text-center">
                        <button
                          onClick={() => handleOpenDepositModal(emp)}
                          className="px-3 py-1.5 min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-colors"
                          title="Manage Deposit & Refund"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Manage</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Update Deposit Details & Refund (Document Checklist REMOVED) */}
      {isDepositModalOpen && selectedEmp && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-[calc(100vw-32px)] sm:w-full max-w-lg rounded-2xl sm:rounded-[2.5rem] border border-border/60 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Manage Deposit: {selectedEmp.name}</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">{selectedEmp.employeeId || selectedEmp.id}</p>
                </div>
              </div>
              <button onClick={() => setIsDepositModalOpen(false)} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 max-h-[70dvh] overflow-y-auto flex-1 min-h-0 pr-2">
              {/* Candidate Type selector */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Candidate Classification
                </label>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditDepositType("Intern");
                    }}
                    className={cn(
                      "p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all",
                      editDepositType === "Intern"
                        ? "bg-purple-500/10 border-purple-500/40 text-purple-700 shadow-sm"
                        : "bg-muted/20 border-border/40 text-muted-foreground"
                    )}
                  >
                    <span>🎓 Intern Candidate</span>
                    <span className="text-[10px] font-mono">Standard Deposit: ₹2,000</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditDepositType("Employee");
                    }}
                    className={cn(
                      "p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all",
                      editDepositType === "Employee"
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-700 shadow-sm"
                        : "bg-muted/20 border-border/40 text-muted-foreground"
                    )}
                  >
                    <span>💼 Full-Time Employee</span>
                    <span className="text-[10px] font-mono">Standard Deposit: ₹10,000</span>
                  </button>
                </div>
              </div>

              {/* Amount Paid & Live Remaining Calculation */}
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Amount Received (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editAmountPaid}
                    onChange={(e) => setEditAmountPaid(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Remaining to Collect
                  </label>
                  <div className="px-3 py-2 bg-muted/20 border border-border/50 rounded-xl text-xs font-black font-mono">
                    {editIsRefunded ? (
                      <span className="text-blue-600">₹0 (Refunded)</span>
                    ) : (() => {
                      const tgt = editDepositType === "Intern" ? 2000 : 10000;
                      const rem = Math.max(0, tgt - editAmountPaid);
                      return rem === 0 ? (
                        <span className="text-emerald-600">₹0 (Paid in Full)</span>
                      ) : (
                        <span className="text-rose-600">₹{rem.toLocaleString("en-IN")} Pending</span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Payment Date & Mode */}
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={editPaymentDate}
                    onChange={(e) => setEditPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={editPaymentMode}
                    onChange={(e) => setEditPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Cash">Cash Receipt</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="e.g. 1st installment received via GPay, 2nd installment next month..."
                  className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Refund Section */}
              <div className="pt-3 border-t border-border/50 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={editIsRefunded}
                    onChange={(e) => {
                      setEditIsRefunded(e.target.checked);
                      if (e.target.checked && editRefundAmount <= 0) {
                        setEditRefundAmount(editAmountPaid);
                        setEditRefundDate(new Date().toISOString().split("T")[0] || "");
                      }
                    }}
                    className="rounded border-border text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-foreground block">Process Deposit Refund</span>
                    <span className="text-[10px] text-muted-foreground">Mark this deposit as refunded to candidate upon departure or policy clearance</span>
                  </div>
                </label>

                {editIsRefunded && (
                  <div className="p-3 bg-muted/30 rounded-2xl border border-border/40 space-y-3 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Refunded Amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editRefundAmount}
                          onChange={(e) => setEditRefundAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Refund Date
                        </label>
                        <input
                          type="date"
                          value={editRefundDate}
                          onChange={(e) => setEditRefundDate(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Refund Remarks / Reference ID
                      </label>
                      <input
                        type="text"
                        value={editRefundRemarks}
                        onChange={(e) => setEditRefundRemarks(e.target.value)}
                        placeholder="e.g. Returned via UPI Ref #123456 after completion of tenure"
                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDeposit}
                disabled={isSaving}
                className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                {isSaving ? "Saving..." : "Save Deposit Details"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
