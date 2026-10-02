import React, { useState, useMemo } from "react";
import { 
  ShieldCheck, 
  IndianRupee, 
  FileText, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Edit2, 
  Eye, 
  Download, 
  Users, 
  GraduationCap, 
  Briefcase,
  X,
  Calendar,
  CreditCard,
  Check
} from "lucide-react";
import { useEmployeesContext } from "./EmployeeContext";
import { Employee } from "./employee-data";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { getAvatarUrl, handleAvatarError } from "@/lib/config";

const REQUIRED_DOCUMENTS_LIST = [
  "10th Marksheet",
  "12th Marksheet",
  "Degree Certificate",
  "Aadhar Card",
  "PAN Card",
  "Experience Letter",
  "Relieving Letter",
  "3 Months Payslip",
  "Passport Size Photo",
  "Bank Passbook / Cancelled Cheque"
];

export function DepositTracking() {
  const { employees, updateEmployee } = useEmployeesContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "Intern" | "Employee">("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [docFilter, setDocFilter] = useState<"All" | "Complete" | "Incomplete">("All");

  // Modal states
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  // Form states for deposit update
  const [editDepositType, setEditDepositType] = useState<"Intern" | "Employee">("Employee");
  const [editAmountPaid, setEditAmountPaid] = useState<number>(0);
  const [editPaymentMode, setEditPaymentMode] = useState<string>("UPI");
  const [editPaymentDate, setEditPaymentDate] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("Pending");
  const [editRemarks, setEditRemarks] = useState<string>("");
  const [editSelectedDocs, setEditSelectedDocs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Helper to determine if employee is intern
  const isIntern = (emp: Employee) => {
    const des = (emp.designation || "").toLowerCase();
    const role = (emp.role || "").toLowerCase();
    const pos = (emp.position || "").toLowerCase();
    return des.includes("intern") || role.includes("intern") || pos.includes("intern") || emp.depositAmount === 2000;
  };

  const getTargetDeposit = (emp: Employee) => {
    if (emp.depositAmount) return emp.depositAmount;
    return isIntern(emp) ? 2000 : 10000;
  };

  const getDepositStatus = (emp: Employee) => {
    if (emp.depositStatus) return emp.depositStatus;
    const target = getTargetDeposit(emp);
    const paid = emp.depositPaid || 0;
    if (paid >= target && target > 0) return "Paid";
    if (paid > 0) return "Partial";
    return "Pending";
  };

  // Open modal with employee data
  const handleOpenDepositModal = (emp: Employee) => {
    setSelectedEmp(emp);
    const intern = isIntern(emp);
    setEditDepositType(intern ? "Intern" : "Employee");
    setEditAmountPaid(emp.depositPaid || 0);
    setEditPaymentMode(emp.depositPaymentDate ? "UPI" : "Cash");
    setEditPaymentDate(emp.depositPaymentDate || new Date().toISOString().split("T")[0] || "");
    setEditStatus(getDepositStatus(emp));
    setEditRemarks(emp.depositRemarks || "");
    setEditSelectedDocs(emp.requiredDocuments || []);
    setIsDepositModalOpen(true);
  };

  const handleOpenDocModal = (emp: Employee) => {
    setSelectedEmp(emp);
    setEditSelectedDocs(emp.requiredDocuments || []);
    setIsDocModalOpen(true);
  };

  // Save deposit & doc changes
  const handleSaveDeposit = async () => {
    if (!selectedEmp) return;
    setIsSaving(true);
    const targetAmount = editDepositType === "Intern" ? 2000 : 10000;
    
    // Auto align status if paid in full
    let finalStatus = editStatus;
    if (editAmountPaid >= targetAmount && editStatus === "Pending") {
      finalStatus = "Paid";
    } else if (editAmountPaid > 0 && editAmountPaid < targetAmount && editStatus === "Pending") {
      finalStatus = "Partial";
    }

    const payload = {
      depositAmount: targetAmount,
      depositPaid: editAmountPaid,
      depositStatus: finalStatus as any,
      depositPaymentDate: editPaymentDate,
      depositRemarks: editRemarks,
      requiredDocuments: editSelectedDocs,
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
          },
          document_checklist: {
            marksheet_10th: editSelectedDocs.includes("10th Marksheet"),
            marksheet_12th: editSelectedDocs.includes("12th Marksheet"),
            degree_certificate: editSelectedDocs.includes("Degree Certificate"),
            aadhar_card: editSelectedDocs.includes("Aadhar Card"),
            pan_card: editSelectedDocs.includes("PAN Card"),
            experience_letter: editSelectedDocs.includes("Experience Letter"),
            relieving_letter: editSelectedDocs.includes("Relieving Letter"),
            payslip_3_months: editSelectedDocs.includes("3 Months Payslip"),
            passport_size_photo: editSelectedDocs.includes("Passport Size Photo"),
            bank_passbook_or_cheque: editSelectedDocs.includes("Bank Passbook / Cancelled Cheque"),
          }
        }, { showErrorToast: false });
      } catch (err) {
        console.warn("Backend deposit update sync notice:", err);
      }
      toast.success("Deposit & documents updated successfully!");
      setIsDepositModalOpen(false);
      setIsDocModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update deposit record");
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
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
      if (statusFilter !== "All" && st !== statusFilter) return false;

      // 4. Docs filter
      const docCount = (emp.requiredDocuments || []).length;
      if (docFilter === "Complete" && docCount < REQUIRED_DOCUMENTS_LIST.length) return false;
      if (docFilter === "Incomplete" && docCount >= REQUIRED_DOCUMENTS_LIST.length) return false;

      return true;
    });
  }, [employees, searchQuery, typeFilter, statusFilter, docFilter]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    let totalTarget = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let internCount = 0;
    let fullTimeCount = 0;
    let fullySubmittedDocs = 0;

    employees.forEach(emp => {
      const intern = isIntern(emp);
      if (intern) internCount++; else fullTimeCount++;
      const target = getTargetDeposit(emp);
      const paid = emp.depositPaid || 0;
      totalTarget += target;
      totalCollected += paid;
      totalPending += Math.max(0, target - paid);
      if ((emp.requiredDocuments || []).length >= REQUIRED_DOCUMENTS_LIST.length) {
        fullySubmittedDocs++;
      }
    });

    return {
      totalTarget,
      totalCollected,
      totalPending,
      internCount,
      fullTimeCount,
      fullySubmittedDocs,
      completionRate: employees.length > 0 ? Math.round((fullySubmittedDocs / employees.length) * 100) : 0
    };
  }, [employees]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-6 md:p-8 rounded-[2.5rem] border border-border/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-0 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl border border-primary/20 shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                Candidate Deposits & Documents
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Track onboarding security deposits (₹2,000 for Interns, ₹10,000 for Employees) and required verification documents.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="bg-card border border-border/60 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Collected Deposits</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            ₹{stats.totalCollected.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
            <span>Collected from team</span>
          </div>
        </div>

        {/* Total Pending */}
        <div className="bg-card border border-border/60 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Deposits</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            ₹{stats.totalPending.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
            <span>Awaiting full settlement</span>
          </div>
        </div>

        {/* Candidates Count */}
        <div className="bg-card border border-border/60 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Candidates Breakdown</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {employees.length} <span className="text-xs font-normal text-muted-foreground">Total</span>
          </div>
          <div className="text-[11px] font-semibold text-blue-600 flex items-center gap-2">
            <span>{stats.internCount} Interns (₹2k)</span>
            <span>•</span>
            <span>{stats.fullTimeCount} Full-Time (₹10k)</span>
          </div>
        </div>

        {/* Documents Compliance Rate */}
        <div className="bg-card border border-border/60 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Docs Completed</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {stats.completionRate}%
          </div>
          <div className="text-[11px] font-semibold text-purple-600 flex items-center gap-1">
            <span>{stats.fullySubmittedDocs} of {employees.length} full verification</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border/60 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by candidate name, employee ID or department..."
            className="w-full pl-10 pr-4 py-2 bg-muted/30 border border-border/60 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Filter */}
          <div className="flex bg-muted/40 p-1 rounded-2xl border border-border/40">
            {(["All", "Intern", "Employee"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                  typeFilter === t
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "All" ? "All Types" : t === "Intern" ? "🎓 Interns" : "💼 Employees"}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-muted/30 border border-border/60 rounded-xl text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="All">All Deposit Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Pending">Pending</option>
            <option value="Refunded">Refunded</option>
          </select>

          {/* Docs Filter */}
          <select
            value={docFilter}
            onChange={(e) => setDocFilter(e.target.value as any)}
            className="h-9 px-3 bg-muted/30 border border-border/60 rounded-xl text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="All">All Documents Status</option>
            <option value="Complete">Complete (10/10)</option>
            <option value="Incomplete">Incomplete</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-card border border-border/60 rounded-[2.5rem] shadow-sm overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground space-y-2">
            <ShieldCheck className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-sm font-semibold">No candidates found matching the filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground font-black uppercase tracking-wider bg-muted/20">
                  <th className="py-4 px-6">Candidate / Employee</th>
                  <th className="py-4 px-4">Designation & Role</th>
                  <th className="py-4 px-4 text-center">Type</th>
                  <th className="py-4 px-4 text-right">Standard Deposit</th>
                  <th className="py-4 px-4 text-right">Amount Paid</th>
                  <th className="py-4 px-4 text-center">Deposit Status</th>
                  <th className="py-4 px-4 text-center">Documents Checklist</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredEmployees.map((emp) => {
                  const intern = isIntern(emp);
                  const targetDeposit = getTargetDeposit(emp);
                  const paid = emp.depositPaid || 0;
                  const st = getDepositStatus(emp);
                  const docsCount = (emp.requiredDocuments || []).length;
                  const isDocsComplete = docsCount >= REQUIRED_DOCUMENTS_LIST.length;

                  return (
                    <tr key={emp.id} className="hover:bg-muted/30 transition-colors group">
                      {/* Name & Photo */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={getAvatarUrl(emp.avatar || emp.profile_photo, emp.name)}
                            alt={emp.name}
                            onError={handleAvatarError}
                            className="w-9 h-9 rounded-xl object-cover border border-border/50 shrink-0"
                          />
                          <div>
                            <div className="font-extrabold text-foreground text-sm leading-snug">
                              {emp.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {emp.employeeId || emp.id} • {emp.email || "No email"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Designation */}
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
                          {intern ? "Intern" : "Full-Time"}
                        </span>
                      </td>

                      {/* Target Deposit */}
                      <td className="py-3.5 px-4 text-right font-black text-foreground font-mono text-sm">
                        ₹{targetDeposit.toLocaleString("en-IN")}
                      </td>

                      {/* Amount Paid */}
                      <td className="py-3.5 px-4 text-right font-black font-mono text-sm">
                        <span className={paid >= targetDeposit ? "text-emerald-600" : paid > 0 ? "text-amber-600" : "text-muted-foreground"}>
                          ₹{paid.toLocaleString("en-IN")}
                        </span>
                        {emp.depositPaymentDate && (
                          <div className="text-[10px] font-medium text-muted-foreground">
                            {emp.depositPaymentDate}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
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

                      {/* Documents Checklist Progress */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenDocModal(emp)}
                          className="hover:scale-105 transition-transform"
                          title="Click to view/edit document checklist"
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={cn(
                                "text-xs font-bold",
                                isDocsComplete ? "text-emerald-600 font-extrabold" : "text-foreground"
                              )}
                            >
                              {docsCount} / {REQUIRED_DOCUMENTS_LIST.length} Docs
                            </span>
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden border border-border/40">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  isDocsComplete ? "bg-emerald-500" : "bg-primary"
                                )}
                                style={{
                                  width: `${Math.min(100, Math.round((docsCount / REQUIRED_DOCUMENTS_LIST.length) * 100))}%`
                                }}
                              />
                            </div>
                          </div>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-6 text-center">
                        <button
                          onClick={() => handleOpenDepositModal(emp)}
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5"
                          title="Update Deposit & Documents"
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

      {/* Modal 1: Update Deposit & Docs */}
      {isDepositModalOpen && selectedEmp && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-lg rounded-[2.5rem] border border-border/60 shadow-2xl overflow-hidden flex flex-col">
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

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Candidate Type selector */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Candidate Classification
                </label>
                <div className="grid grid-cols-2 gap-3">
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

              {/* Amount Paid & Status */}
              <div className="grid grid-cols-2 gap-3">
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
                    Deposit Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Pending">Pending</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
              </div>

              {/* Payment Date & Mode */}
              <div className="grid grid-cols-2 gap-3">
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

              {/* Documents Checklist */}
              <div className="pt-3 border-t border-border/50">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Required Documents Checklist ({editSelectedDocs.length}/{REQUIRED_DOCUMENTS_LIST.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditSelectedDocs([...REQUIRED_DOCUMENTS_LIST])}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    Select All
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-muted/20 p-3 rounded-2xl border border-border/40">
                  {REQUIRED_DOCUMENTS_LIST.map((doc) => {
                    const isChecked = editSelectedDocs.includes(doc);
                    return (
                      <label key={doc} className="flex items-center gap-2 cursor-pointer text-xs font-semibold p-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditSelectedDocs([...editSelectedDocs, doc]);
                            } else {
                              setEditSelectedDocs(editSelectedDocs.filter((d) => d !== doc));
                            }
                          }}
                          className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                        />
                        <span className={isChecked ? "text-foreground font-bold" : "text-muted-foreground"}>{doc}</span>
                      </label>
                    );
                  })}
                </div>
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

      {/* Modal 2: Quick Documents Checklist View/Edit */}
      {isDocModalOpen && selectedEmp && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-[2.5rem] border border-border/60 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Documents: {selectedEmp.name}</h3>
                  <p className="text-[11px] text-muted-foreground">Required onboarding verification checklist</p>
                </div>
              </div>
              <button onClick={() => setIsDocModalOpen(false)} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-border/40">
                <span className="text-xs font-bold text-muted-foreground">Submitted: {editSelectedDocs.length} / {REQUIRED_DOCUMENTS_LIST.length}</span>
                <button
                  type="button"
                  onClick={() => setEditSelectedDocs([...REQUIRED_DOCUMENTS_LIST])}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  Mark All Complete
                </button>
              </div>

              <div className="space-y-2">
                {REQUIRED_DOCUMENTS_LIST.map((doc) => {
                  const isChecked = editSelectedDocs.includes(doc);
                  return (
                    <label
                      key={doc}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all",
                        isChecked
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                          : "bg-muted/20 border-border/40 text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditSelectedDocs([...editSelectedDocs, doc]);
                            } else {
                              setEditSelectedDocs(editSelectedDocs.filter((d) => d !== doc));
                            }
                          }}
                          className="rounded border-border text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>{doc}</span>
                      </div>
                      <span className={cn("text-[10px]", isChecked ? "text-emerald-600" : "text-muted-foreground/60")}>
                        {isChecked ? "Submitted ✅" : "Pending ⏳"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsDocModalOpen(false)}
                className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDeposit}
                disabled={isSaving}
                className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm rounded-xl transition-all shadow-sm"
              >
                {isSaving ? "Saving..." : "Save Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
