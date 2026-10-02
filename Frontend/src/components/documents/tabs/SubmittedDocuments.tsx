import React, { useState, useMemo } from "react";
import { 
  Filter, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Eye, 
  Download, 
  ShieldCheck, 
  IndianRupee, 
  Plus, 
  Trash2, 
  History, 
  Calendar, 
  Users, 
  ArrowUpRight,
  ExternalLink,
  X
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { SearchInput } from "@/components/common/SearchInput";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { useAuth } from "@/components/auth/AuthContext";
import { getAvatarUrl, handleAvatarError } from "@/lib/config";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";

type DocStatus = "Accepted" | "Pending Review" | "Pending to Submit" | "Rejected" | "Returned to Employee";

interface ProcessedDoc {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode?: string | undefined;
  designation?: string | undefined;
  avatar?: string | undefined;
  documentName: string;
  isDeposit: boolean;
  status: DocStatus;
  uploadDate: string;
  fileUrl?: string | undefined;
  fileName?: string | undefined;
  fileSize?: string | undefined;
  isPendingSubmit: boolean;
}

const DEFAULT_DOC_TYPES = [
  "Aadhar Card",
  "PAN Card",
  "10th Marksheet",
  "12th Marksheet",
  "Degree Certificate",
  "Cancelled Cheque",
  "Passport Size Photo",
  "Previous Experience Letter"
];

export function SubmittedDocuments() {
  const { employees, updateEmployee } = useEmployeesContext();
  const { user } = useAuth();

  const userRole = String((user as any)?.role || (user as any)?.work_details?.system_role || "").toLowerCase();
  const isAdminOrHR = ["admin", "superadmin", "hr"].some(r => userRole.includes(r));

  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Deposit Ledger Modal States
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [selectedLedgerDoc, setSelectedLedgerDoc] = useState<ProcessedDoc | null>(null);
  const [directPaymentAmount, setDirectPaymentAmount] = useState("");
  const [directPaymentNote, setDirectPaymentNote] = useState("");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // Helper to determine intern status
  const isIntern = (emp: any) => {
    const des = (emp.designation || emp.role || "").toLowerCase();
    return des.includes("intern");
  };

  // Helper to get deposit information for any document row
  const getDepositInfo = (doc: ProcessedDoc) => {
    const emp = employees.find(e => String(e.id) === String(doc.employeeId) || String(e.employeeId) === String(doc.employeeId));
    
    let target = 10000;
    if (doc.documentName?.includes("Intern - 2000") || doc.documentName?.includes("2000")) {
      target = 2000;
    } else if (doc.documentName?.includes("Employee - 10000") || doc.documentName?.includes("10000")) {
      target = 10000;
    } else if (emp?.targetSecurityDeposit && Number(emp.targetSecurityDeposit) > 0) {
      target = Number(emp.targetSecurityDeposit);
    } else if (emp?.depositAmount && Number(emp.depositAmount) > 0) {
      target = Number(emp.depositAmount);
    } else if (emp && isIntern(emp)) {
      target = 2000;
    }

    const isExempt = Boolean(emp?.securityDepositExempt);
    const directPayments = emp?.securityDepositDirectPayments || [];
    const directPaid = directPayments.reduce((sum: number, dp: any) => sum + (Number(dp.amount) || 0), 0);
    
    // Also include any depositPaid recorded on emp directly if not yet in directPayments
    const legacyPaid = Number(emp?.depositPaid) || 0;
    const collected = Math.max(directPaid, legacyPaid);
    const isCollectedOrExempt = isExempt || (collected >= target);
    const remaining = isExempt ? 0 : Math.max(0, target - collected);

    return {
      emp,
      target,
      isExempt,
      directPayments,
      directPaid,
      collected,
      remaining,
      isCollectedOrExempt
    };
  };

  // Generate combined list of all documents and pending placeholders from requiredDocuments
  const processedDocs: ProcessedDoc[] = useMemo(() => {
    const docs: ProcessedDoc[] = [];

    const relevantEmployees = !isAdminOrHR && user?.id
      ? employees.filter(e => e.id === user.id || e.email?.toLowerCase() === user.email?.toLowerCase())
      : (filterEmployee !== "all" ? employees.filter(e => e.id === filterEmployee) : employees);

    relevantEmployees.forEach((emp) => {
      const intern = isIntern(emp);
      const defaultDepositDocName = intern ? "Security Deposit - Intern - 2000" : "Security Deposit - Employee - 10000";

      let reqDocs = emp.requiredDocuments;
      if (!reqDocs || reqDocs.length === 0) {
        // Standard set if employee has no explicit list
        reqDocs = [
          ...DEFAULT_DOC_TYPES,
          defaultDepositDocName
        ];
      }

      // Check if deposit document is included in reqDocs; if not, ensure standard deposit is tracked
      const hasDepositInReq = reqDocs.some(d => d.toLowerCase().includes("deposit") || d.toLowerCase().includes("deposite"));
      const finalReqDocs = hasDepositInReq ? [...reqDocs] : [...reqDocs, defaultDepositDocName];

      finalReqDocs.forEach((docName) => {
        const isDep = docName.toLowerCase().includes("deposit") || docName.toLowerCase().includes("deposite");
        docs.push({
          id: `${emp.id}-${docName}`,
          employeeId: emp.id,
          employeeName: emp.name,
          employeeCode: emp.employeeId,
          designation: emp.designation || emp.role || "Employee",
          avatar: emp.avatar || emp.profile_photo,
          documentName: docName,
          isDeposit: isDep,
          status: isDep ? "Accepted" : "Pending to Submit",
          uploadDate: emp.joinDate || "-",
          isPendingSubmit: true
        });
      });
    });

    return docs;
  }, [employees, isAdminOrHR, user, filterEmployee]);

  // Filtering
  const filteredDocs = useMemo(() => {
    return processedDocs.filter(doc => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || 
        doc.employeeName.toLowerCase().includes(query) || 
        doc.documentName.toLowerCase().includes(query) ||
        (doc.employeeCode && doc.employeeCode.toLowerCase().includes(query));

      const matchesType = filterType === "all" || 
        (filterType === "deposit" ? doc.isDeposit : !doc.isDeposit && doc.documentName.toLowerCase().includes(filterType.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter !== "all") {
        if (doc.isDeposit) {
          const { isCollectedOrExempt } = getDepositInfo(doc);
          if (statusFilter === "accepted") matchesStatus = isCollectedOrExempt;
          else if (statusFilter === "pending") matchesStatus = !isCollectedOrExempt;
          else matchesStatus = false;
        } else {
          matchesStatus = statusFilter === "pending" 
            ? doc.status === "Pending to Submit" 
            : doc.status.toLowerCase().includes(statusFilter.toLowerCase());
        }
      }

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [processedDocs, search, filterType, statusFilter]);

  const { items: sortedDocs, requestSort, sortConfig } = useSortableData(filteredDocs);

  // Financial KPIs for Deposit
  const depositKPIs = useMemo(() => {
    let totalTarget = 0;
    let totalCollected = 0;
    let pendingCount = 0;
    let completedCount = 0;

    processedDocs.filter(d => d.isDeposit).forEach(doc => {
      const info = getDepositInfo(doc);
      totalTarget += info.target;
      totalCollected += Math.min(info.collected, info.target);
      if (info.isCollectedOrExempt) completedCount++;
      else pendingCount++;
    });

    return { totalTarget, totalCollected, pendingCount, completedCount };
  }, [processedDocs, employees]);

  // Record Direct Payment Handler
  const handleRecordDirectPayment = async () => {
    if (!selectedLedgerDoc) return;
    const amount = parseFloat(directPaymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid positive payment amount");
      return;
    }

    const info = getDepositInfo(selectedLedgerDoc);
    if (amount > info.remaining && info.remaining > 0) {
      toast.error(`Amount cannot exceed remaining balance of ₹${info.remaining.toLocaleString("en-IN")}`);
      return;
    }

    try {
      setIsRecordingPayment(true);
      const targetEmp = employees.find(e => e.id === selectedLedgerDoc.employeeId);
      if (!targetEmp) throw new Error("Employee not found");

      const existingPayments = targetEmp.securityDepositDirectPayments || [];
      const paymentDate = (new Date().toISOString().split("T")[0] as string) || "2026-10-02";
      const newPayment = {
        amount,
        date: paymentDate,
        note: directPaymentNote.trim() || `Direct deposit payment of ₹${amount.toLocaleString("en-IN")}`,
        recordedBy: user?.name || "Admin"
      };

      const updatedPayments = [...existingPayments, newPayment];
      const newPaid = info.collected + amount;
      const newStatus = newPaid >= info.target ? "Paid" : "Partial";

      await updateEmployee(targetEmp.id, {
        securityDepositDirectPayments: updatedPayments,
        depositPaid: newPaid,
        depositStatus: newStatus as any,
        depositPaymentDate: newPayment.date,
        depositRemarks: newPayment.note
      });

      toast.success(`Payment of ₹${amount.toLocaleString("en-IN")} recorded successfully!`);
      setDirectPaymentAmount("");
      setDirectPaymentNote("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment");
    } finally {
      setIsRecordingPayment(false);
    }
  };

  // Delete Direct Payment Handler
  const handleDeleteDirectPayment = async (index: number) => {
    if (!selectedLedgerDoc) return;
    const targetEmp = employees.find(e => e.id === selectedLedgerDoc.employeeId);
    if (!targetEmp) return;

    const existingPayments = targetEmp.securityDepositDirectPayments || [];
    const targetPayment = existingPayments[index];
    if (!targetPayment) return;

    if (!window.confirm(`Are you sure you want to delete payment entry of ₹${targetPayment.amount.toLocaleString("en-IN")}?`)) {
      return;
    }

    try {
      const updatedPayments = existingPayments.filter((_, i) => i !== index);
      const newPaid = updatedPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const info = getDepositInfo(selectedLedgerDoc);
      const newStatus = newPaid >= info.target ? "Paid" : newPaid > 0 ? "Partial" : "Pending";

      await updateEmployee(targetEmp.id, {
        securityDepositDirectPayments: updatedPayments,
        depositPaid: newPaid,
        depositStatus: newStatus as any
      });

      toast.success("Payment entry deleted successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete payment entry");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Financial & Document KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Assigned Docs</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{processedDocs.length}</div>
          <p className="text-[11px] text-muted-foreground mt-1 font-medium">Across all active team members</p>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Deposits Completed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">{depositKPIs.completedCount}</div>
          <p className="text-[11px] text-muted-foreground mt-1 font-medium">Fully collected or exempt</p>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Deposits Pending</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">{depositKPIs.pendingCount}</div>
          <p className="text-[11px] text-muted-foreground mt-1 font-medium">Pending or partial payments</p>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Financial Collection</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground mt-2">
            ₹{depositKPIs.totalCollected.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 font-medium">
            Target: ₹{depositKPIs.totalTarget.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <SearchInput
          placeholder="Search employees or documents..."
          value={search}
          onChange={setSearch}
          className="w-full sm:max-w-xs"
        />

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdminOrHR && (
            <SearchableSelect
              value={filterEmployee}
              onChange={setFilterEmployee}
              options={[
                { label: "All Employees", value: "all" },
                ...employees.map(e => ({ label: `${e.name} (${e.employeeId || e.id})`, value: e.id }))
              ]}
              className="w-full sm:w-[190px] h-[40px] text-xs font-bold bg-card border border-border/50 rounded-xl"
            />
          )}

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 h-[40px] text-xs font-bold bg-card border border-border/50 rounded-xl focus:outline-none"
          >
            <option value="all">All Document Types</option>
            <option value="deposit">Security Deposits Only</option>
            <option value="Aadhar">Aadhar Card</option>
            <option value="PAN">PAN Card</option>
            <option value="Marksheet">Marksheets</option>
            <option value="Degree">Degree Certificate</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 h-[40px] text-xs font-bold bg-card border border-border/50 rounded-xl focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="accepted">Accepted / Collected</option>
            <option value="pending">Pending to Submit / Partial</option>
          </select>
        </div>
      </div>

      {/* Main Documents Table */}
      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader label="Employee" sortKey="employeeName" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Document" sortKey="documentName" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Date" sortKey="uploadDate" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-bold text-sm">No documents found matching your filters.</p>
                  </td>
                </tr>
              ) : (
                sortedDocs.map((doc) => {
                  const depositInfo = doc.isDeposit ? getDepositInfo(doc) : null;

                  return (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors group">
                      {/* Employee Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={getAvatarUrl(doc.avatar, doc.employeeName)}
                            alt={doc.employeeName}
                            onError={handleAvatarError}
                            className="w-9 h-9 rounded-xl object-cover border border-border/50 shrink-0"
                          />
                          <div>
                            <div className="font-extrabold text-foreground text-sm leading-snug">
                              {doc.employeeName}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {doc.employeeCode || doc.employeeId} • {doc.designation}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Document Name */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            doc.isDeposit ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
                          )}>
                            {doc.isDeposit ? <IndianRupee className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-foreground">{doc.documentName}</div>
                            {doc.isDeposit && (
                              <div className="text-[11px] text-muted-foreground font-semibold">
                                Target: ₹{depositInfo?.target.toLocaleString("en-IN")}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="p-4">
                        {doc.isDeposit && depositInfo ? (
                          depositInfo.isExempt ? (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-purple-500/10 text-purple-700 border border-purple-500/20 inline-flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" /> Paid in Advance
                            </span>
                          ) : depositInfo.collected >= depositInfo.target ? (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Deposit Collected
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-700 border border-amber-500/20 inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                Collected: ₹{depositInfo.collected.toLocaleString("en-IN")} / ₹{depositInfo.target.toLocaleString("en-IN")}
                              </span>
                              {depositInfo.directPaid > 0 && (
                                <p className="text-[10px] text-muted-foreground font-semibold">
                                  (₹{depositInfo.directPaid.toLocaleString("en-IN")} direct payments)
                                </p>
                              )}
                            </div>
                          )
                        ) : (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border",
                            doc.status === "Accepted" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" :
                            doc.status === "Rejected" ? "bg-rose-500/10 text-rose-700 border-rose-500/20" :
                            "bg-slate-500/10 text-slate-700 border-slate-500/20"
                          )}>
                            {doc.status}
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-4 text-xs font-semibold text-muted-foreground">
                        {doc.uploadDate}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        {doc.isDeposit ? (
                          <button
                            onClick={() => {
                              setSelectedLedgerDoc(doc);
                              setIsLedgerModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-sm"
                            title="View Deposit Ledger"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ledger
                          </button>
                        ) : (
                          <button
                            onClick={() => toast.info(`Viewing status for ${doc.documentName}`)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                            title="Document Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deposit Ledger Modal */}
      {selectedLedgerDoc && (() => {
        const info = getDepositInfo(selectedLedgerDoc);
        const targetEmp = employees.find(e => e.id === selectedLedgerDoc.employeeId);

        return (
          <Dialog open={isLedgerModalOpen} onOpenChange={(v) => { if (!v) setIsLedgerModalOpen(false); }}>
            <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
              <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black tracking-tight text-foreground">Deposit Ledger</h2>
                    <p className="text-xs text-muted-foreground">{selectedLedgerDoc.employeeName} ({selectedLedgerDoc.employeeCode || selectedLedgerDoc.employeeId})</p>
                  </div>
                </div>
                <DialogClose asChild>
                  <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </DialogClose>
              </div>

              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Ledger Financial Summary Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/40 text-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Target</span>
                    <p className="text-lg font-black text-foreground mt-1">₹{info.target.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total Paid</span>
                    <p className="text-lg font-black text-emerald-700 mt-1">₹{info.collected.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/20 text-center">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Remaining</span>
                    <p className="text-lg font-black text-amber-700 mt-1">₹{info.remaining.toLocaleString("en-IN")}</p>
                  </div>
                </div>

                {/* Direct Payments Transaction History */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Direct Payments Log</h4>
                    <span className="text-xs font-bold text-muted-foreground">{info.directPayments.length} Entries</span>
                  </div>

                  {info.directPayments.length === 0 ? (
                    <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl text-center text-xs text-muted-foreground">
                      No direct payment entries recorded yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40 border border-border/40 rounded-2xl overflow-hidden bg-card">
                      {info.directPayments.map((dp: any, idx: number) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-black text-foreground">₹{Number(dp.amount).toLocaleString("en-IN")}</div>
                            <div className="text-[11px] text-muted-foreground font-medium">{dp.date} • {dp.note || "Direct Payment"}</div>
                          </div>
                          {isAdminOrHR && (
                            <button
                              onClick={() => handleDeleteDirectPayment(idx)}
                              className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Record New Direct Payment (Admin only) */}
                {isAdminOrHR && (
                  <div className="p-4 bg-muted/30 border border-border/50 rounded-2xl space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-primary" /> Record Direct Cash/UPI Payment
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Amount (₹) *
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 2000"
                          value={directPaymentAmount}
                          onChange={e => setDirectPaymentAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Payment Note
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. UPI Ref #1234 / Cash"
                          value={directPaymentNote}
                          onChange={e => setDirectPaymentNote(e.target.value)}
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleRecordDirectPayment}
                        disabled={isRecordingPayment || !directPaymentAmount}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black rounded-xl transition-colors shadow-sm disabled:opacity-50"
                      >
                        {isRecordingPayment ? "Saving Payment..." : "Record Payment"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
