import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Pencil,
  History, 
  Calendar, 
  Users, 
  ArrowUpRight,
  ExternalLink,
  X,
  Upload,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { SearchInput } from "@/components/common/SearchInput";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { useAuth } from "@/components/auth/AuthContext";
import { API_URL, getAvatarUrl, handleAvatarError } from "@/lib/config";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { hasModulePermission, isUserAdmin } from "@/lib/permissions";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";

type DocStatus = "Accepted" | "Pending Review" | "Pending to Submit" | "Rejected" | "Returned to Employee";

interface SubmittedDocItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  designation?: string;
  avatar?: string;
  documentTypeId?: string;
  documentName: string;
  isDeposit: boolean;
  status: DocStatus;
  uploadDate: string;
  filePath?: string;
  fileName?: string;
  fileUrl?: string;
  originalFilename?: string;
  isPendingSubmit?: boolean;
}

interface DocTypeItem {
  id: string;
  name: string;
  description?: string;
  isRequired: boolean;
}

export function SubmittedDocuments() {
  const { employees, updateEmployee } = useEmployeesContext();
  const { user } = useAuth();

  const userRole = String((user as any)?.role || (user as any)?.work_details?.system_role || (user as any)?.system_role || "").toLowerCase();
  const userDept = String((user as any)?.department || (user as any)?.work_details?.department || "").toLowerCase();
  const isAdminOrHR = isUserAdmin(user) || ["admin", "subadmin", "superadmin", "hr", "hr manager"].some(r => userRole.includes(r)) || userDept === "hr";

  const [backendDocs, setBackendDocs] = useState<SubmittedDocItem[]>([]);
  const [docTypes, setDocTypes] = useState<DocTypeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Upload Modal States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadEmployeeId, setUploadEmployeeId] = useState("");
  const [uploadDocTypeId, setUploadDocTypeId] = useState("");
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split("T")[0]);
  const [uploadStatus, setUploadStatus] = useState<DocStatus>("Accepted");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modal States
  const [editingDoc, setEditingDoc] = useState<SubmittedDocItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<DocStatus>("Accepted");
  const [editDocTypeId, setEditDocTypeId] = useState("");
  const [editDate, setEditDate] = useState("");

  // Deposit Ledger Modal States
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [selectedLedgerDoc, setSelectedLedgerDoc] = useState<SubmittedDocItem | null>(null);
  const [directPaymentAmount, setDirectPaymentAmount] = useState("");
  const [directPaymentNote, setDirectPaymentNote] = useState("");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // Fetch Submitted Documents & Document Types from backend
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [docsRes, typesRes] = await Promise.all([
        api.get(isAdminOrHR ? "/submitted-documents" : "/submitted-documents/my-documents", { showLoader: false, showErrorToast: false }),
        api.get("/document-types", { showLoader: false, showErrorToast: false })
      ]);

      const rawDocs = Array.isArray(docsRes) ? docsRes : docsRes?.items || docsRes?.data || [];
      const rawTypes = Array.isArray(typesRes) ? typesRes : typesRes?.items || typesRes?.data || [];

      const mappedTypes: DocTypeItem[] = rawTypes.map((t: any) => ({
        id: String(t._id || t.id),
        name: t.name || "Document Type",
        description: t.description || "",
        isRequired: Boolean(t.is_mandatory || t.isRequired)
      }));
      setDocTypes(mappedTypes);

      const mappedDocs: SubmittedDocItem[] = rawDocs.map((d: any) => {
        const emp = employees.find(e => String(e.id) === String(d.employee_id) || String(e.employeeId) === String(d.employee_code));
        return {
          id: String(d._id || d.id),
          employeeId: String(d.employee_id || emp?.id || ""),
          employeeName: d.employee_name || emp?.name || "Employee",
          employeeCode: d.employee_code || emp?.employeeId || "",
          designation: emp?.designation || emp?.role || "Employee",
          avatar: emp?.avatar || emp?.profile_photo || "",
          documentTypeId: String(d.document_type_id || ""),
          documentName: d.document_type_name || "Submitted Document",
          isDeposit: (d.document_type_name || "").toLowerCase().includes("deposit"),
          status: (d.status as DocStatus) || "Accepted",
          uploadDate: d.date || "-",
          filePath: d.file_path,
          fileName: d.file_name || d.original_filename,
          originalFilename: d.original_filename
        };
      });

      setBackendDocs(mappedDocs);
    } catch (err: any) {
      console.error("Failed to fetch submitted documents data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [employees]);

  // Helper to determine intern status
  const isIntern = (emp: any) => {
    const des = (emp.designation || emp.role || "").toLowerCase();
    return des.includes("intern");
  };

  // Helper to get deposit information for any document row
  const getDepositInfo = (doc: SubmittedDocItem) => {
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

  // Combine actual submitted documents with auto-generated pending rows for MANDATORY document types for EMPLOYEES only (excluding Admins)
  const allCombinedDocs: SubmittedDocItem[] = useMemo(() => {
    const combined: SubmittedDocItem[] = [...backendDocs];
    const existingKeys = new Set(backendDocs.map(d => `${d.employeeId}-${d.documentName.toLowerCase()}`));

    // Filter mandatory document types configured in Document Types tab
    const mandatoryTypes = docTypes.filter(t => t.isRequired);

    // Filter employees - EXCLUDE Admins & Subadmins
    const nonAdminEmployees = employees.filter(emp => {
      const roleStr = String(emp.role || emp.designation || "").toLowerCase();
      const nameStr = String(emp.name || "").toLowerCase();
      return !roleStr.includes("admin") && !roleStr.includes("subadmin") && !nameStr.includes("admin");
    });

    const myEmpId = String((user as any)?._id || (user as any)?.id || "");
    const myEmpCode = String((user as any)?.employee_code || (user as any)?.employeeId || (user as any)?.employeeCode || "");
    const myEmail = String(user?.email || "").toLowerCase();
    const myName = String((user as any)?.name || (user as any)?.contact_info?.full_name || "").toLowerCase();

    const targetEmployees = !isAdminOrHR
      ? nonAdminEmployees.filter(e => 
          String(e.id) === myEmpId || 
          (myEmpCode && String(e.employeeId || e.employeeCode) === myEmpCode) ||
          (myEmail && String(e.email).toLowerCase() === myEmail) ||
          (myName && String(e.name).toLowerCase() === myName)
        )
      : (filterEmployee !== "all" ? nonAdminEmployees.filter(e => String(e.id) === String(filterEmployee)) : nonAdminEmployees);

    targetEmployees.forEach((emp) => {
      mandatoryTypes.forEach((type) => {
        const key = `${emp.id}-${type.name.toLowerCase()}`;
        if (!existingKeys.has(key)) {
          combined.push({
            id: `placeholder-${emp.id}-${type.id}`,
            employeeId: String(emp.id),
            employeeName: emp.name || "Employee",
            employeeCode: emp.employeeId || emp.employeeCode || "",
            designation: emp.designation || emp.role || "Employee",
            avatar: emp.avatar || emp.profile_photo || "",
            documentTypeId: type.id,
            documentName: type.name,
            isDeposit: type.name.toLowerCase().includes("deposit"),
            status: "Pending to Submit",
            uploadDate: "-",
            isPendingSubmit: true
          });
        }
      });
    });

    if (!isAdminOrHR) {
      return combined.filter(d => 
        String(d.employeeId) === myEmpId || 
        (myEmpCode && String(d.employeeCode) === myEmpCode) ||
        (myName && d.employeeName && d.employeeName.toLowerCase() === myName)
      );
    }

    if (filterEmployee !== "all") {
      return combined.filter(d => String(d.employeeId) === String(filterEmployee));
    }

    return combined;
  }, [backendDocs, docTypes, employees, isAdminOrHR, user, filterEmployee]);

  // Format clean employee options without raw Mongo ObjectIds and excluding Admins
  const formattedEmployeeOptions = useMemo(() => {
    const nonAdmins = employees.filter(e => {
      const roleStr = String(e.role || e.designation || "").toLowerCase();
      const nameStr = String(e.name || "").toLowerCase();
      return !roleStr.includes("admin") && !roleStr.includes("subadmin") && !nameStr.includes("admin");
    });

    return nonAdmins.map(e => {
      return { label: e.name, value: String(e.id) };
    });
  }, [employees]);

  // Pre-fill Upload Modal for a pending document row
  const openUploadModalForPending = (doc: SubmittedDocItem) => {
    setUploadEmployeeId(doc.employeeId);
    const matchedType = docTypes.find(t => t.name.toLowerCase() === doc.documentName.toLowerCase());
    setUploadDocTypeId(doc.documentTypeId || matchedType?.id || "");
    setUploadDate(new Date().toISOString().split("T")[0]);
    setUploadStatus("Accepted");
    setSelectedFile(null);
    setIsUploadModalOpen(true);
  };

  // Filtering
  const filteredDocs = useMemo(() => {
    return allCombinedDocs.filter(doc => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || 
        doc.employeeName.toLowerCase().includes(query) || 
        doc.documentName.toLowerCase().includes(query) ||
        (doc.employeeCode && doc.employeeCode.toLowerCase().includes(query));

      const matchesType = filterType === "all" || 
        (filterType === "deposit" ? doc.isDeposit : !doc.isDeposit && (doc.documentTypeId === filterType || doc.documentName.toLowerCase().includes(filterType.toLowerCase())));

      let matchesStatus = true;
      if (statusFilter !== "all") {
        if (doc.isDeposit) {
          const { isCollectedOrExempt } = getDepositInfo(doc);
          if (statusFilter === "Accepted") matchesStatus = isCollectedOrExempt;
          else if (statusFilter === "Pending to Submit") matchesStatus = !isCollectedOrExempt;
          else matchesStatus = false;
        } else {
          matchesStatus = doc.status === statusFilter;
        }
      }

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [allCombinedDocs, search, filterType, statusFilter]);

  const { items: sortedDocs, requestSort, sortConfig } = useSortableData(filteredDocs);

  // Financial KPIs for Deposit
  const depositKPIs = useMemo(() => {
    let totalTarget = 0;
    let totalCollected = 0;
    let pendingCount = 0;
    let completedCount = 0;

    allCombinedDocs.filter(d => d.isDeposit).forEach(doc => {
      const info = getDepositInfo(doc);
      totalTarget += info.target;
      totalCollected += Math.min(info.collected, info.target);
      if (info.isCollectedOrExempt) completedCount++;
      else pendingCount++;
    });

    return { totalTarget, totalCollected, pendingCount, completedCount };
  }, [allCombinedDocs, employees]);

  // Handle Submit Document (Create Record)
  const handleUploadDocument = async () => {
    if (!uploadEmployeeId) {
      toast.error("Please select an employee");
      return;
    }
    if (!uploadDocTypeId) {
      toast.error("Please select a document type");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/submitted-documents", {
        employee_id: uploadEmployeeId,
        document_type_id: uploadDocTypeId,
        date: uploadDate,
        status: uploadStatus
      });
      toast.success("Document submitted successfully!");

      setIsUploadModalOpen(false);
      setUploadEmployeeId("");
      setUploadDocTypeId("");
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit document");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal for a submitted document
  const openEditModal = (doc: SubmittedDocItem) => {
    setEditingDoc(doc);
    setEditStatus(doc.status === "Pending to Submit" ? "Accepted" : doc.status);
    const matchedTypeId = doc.documentTypeId || docTypes.find(t => t.name.toLowerCase() === doc.documentName.toLowerCase())?.id || "";
    setEditDocTypeId(matchedTypeId);
    setEditDate(doc.uploadDate && doc.uploadDate !== "-" ? doc.uploadDate : new Date().toISOString().split("T")[0]);
    setIsEditModalOpen(true);
  };

  // Handle Save Edit (Update / Change Status)
  const handleSaveEdit = async () => {
    if (!editingDoc) return;
    setIsSubmitting(true);
    try {
      if (editingDoc.isPendingSubmit) {
        // Create/Update submitted document record for pending row
        const matchedTypeId = editDocTypeId || docTypes.find(t => t.name.toLowerCase() === editingDoc.documentName.toLowerCase())?.id;
        if (!matchedTypeId) {
          toast.error("Invalid document type selected");
          return;
        }
        await api.post("/submitted-documents", {
          employee_id: editingDoc.employeeId,
          document_type_id: matchedTypeId,
          status: editStatus,
          date: editDate
        });
        toast.success(`Document status updated for ${editingDoc.employeeName}`);
      } else {
        // Update existing backend record
        await api.put(`/submitted-documents/${editingDoc.id}`, {
          status: editStatus,
          document_type_id: editDocTypeId || undefined,
          date: editDate
        });
        toast.success("Submitted document updated successfully!");
      }
      setIsEditModalOpen(false);
      setEditingDoc(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update document");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Submitted Document
  const handleDeleteSubmittedDoc = async (doc: SubmittedDocItem) => {
    if (!window.confirm(`Are you sure you want to delete/reset document record for "${doc.documentName}"?`)) {
      return;
    }
    try {
      if (!doc.isPendingSubmit && doc.id) {
        await api.delete(`/submitted-documents/${doc.id}`);
        toast.success("Document deleted successfully!");
      } else {
        toast.success("Document status reset.");
      }
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete document");
    }
  };

  // Inline edit handler for Status
  const handleInlineStatusChange = async (doc: SubmittedDocItem, newStatus: string) => {
    if (doc.status === newStatus) return;
    try {
      const matchedTypeId = doc.documentTypeId || docTypes.find(t => t.name.toLowerCase() === doc.documentName.toLowerCase())?.id;
      if (doc.isPendingSubmit) {
        if (!matchedTypeId) return;
        await api.post("/submitted-documents", {
          employee_id: doc.employeeId,
          document_type_id: matchedTypeId,
          status: newStatus,
          date: doc.uploadDate && doc.uploadDate !== "-" ? doc.uploadDate : new Date().toISOString().split("T")[0]
        });
      } else {
        await api.put(`/submitted-documents/${doc.id}`, {
          status: newStatus
        });
      }
      toast.success(`Status updated to "${newStatus}"`);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  // Inline edit handler for Date
  const handleInlineDateChange = async (doc: SubmittedDocItem, newDate: string) => {
    if (!newDate || doc.uploadDate === newDate) return;
    try {
      const matchedTypeId = doc.documentTypeId || docTypes.find(t => t.name.toLowerCase() === doc.documentName.toLowerCase())?.id;
      if (doc.isPendingSubmit) {
        if (!matchedTypeId) return;
        await api.post("/submitted-documents", {
          employee_id: doc.employeeId,
          document_type_id: matchedTypeId,
          status: doc.status === "Pending to Submit" ? "Accepted" : doc.status,
          date: newDate
        });
      } else {
        await api.put(`/submitted-documents/${doc.id}`, {
          date: newDate
        });
      }
      toast.success(`Date updated to ${newDate}`);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update date");
    }
  };

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
      const paymentDate = new Date().toISOString().split("T")[0] || "2026-10-08";
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
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Documents</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{allCombinedDocs.length}</div>
          <p className="text-[11px] text-muted-foreground mt-1 font-medium">Across all team members</p>
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

      {/* Filters & Action Bar */}
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
                ...formattedEmployeeOptions
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
            {docTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 h-[40px] text-xs font-bold bg-card border border-border/50 rounded-xl focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Pending to Submit">Pending to Submit</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
            <option value="Returned to Employee">Returned to Employee</option>
          </select>

          {isAdminOrHR && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-4 py-2 min-h-[40px] bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Upload Document
            </button>
          )}
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
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2 text-primary" />
                    <p className="font-bold text-sm">Loading submitted documents...</p>
                  </td>
                </tr>
              ) : sortedDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-bold text-sm">No submitted documents found matching your filters.</p>
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
                          <div className="min-w-0">
                            <div className="font-extrabold text-foreground text-sm leading-snug truncate max-w-[160px] sm:max-w-[220px]" title={doc.employeeName}>
                              {doc.employeeName}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[160px] sm:max-w-[220px]">
                              {(() => {
                                const code = (doc.employeeCode || doc.employeeId || "").trim();
                                const isMongoId = code.length === 24 && /^[0-9a-fA-F]+$/.test(code);
                                const cleanCode = code && !isMongoId ? code : "";
                                return cleanCode ? `${cleanCode} • ${doc.designation}` : doc.designation;
                              })()}
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
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-foreground truncate max-w-[160px] sm:max-w-[220px]" title={doc.documentName}>{doc.documentName}</div>
                            {doc.fileName && (
                              <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[160px]">
                                📎 {doc.fileName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status Column (Inline Editable for Admin/HR) */}
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
                            </div>
                          )
                        ) : isAdminOrHR ? (
                          <select
                            value={doc.status}
                            onChange={(e) => handleInlineStatusChange(doc, e.target.value)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors",
                              doc.status === "Accepted" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/20" :
                              doc.status === "Rejected" ? "bg-rose-500/10 text-rose-700 border-rose-500/20 hover:bg-rose-500/20" :
                              doc.status === "Returned to Employee" ? "bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20" :
                              "bg-slate-500/10 text-slate-700 border-slate-500/20 hover:bg-slate-500/20"
                            )}
                          >
                            <option value="Pending to Submit" className="bg-background text-foreground font-semibold">Pending to Submit</option>
                            <option value="Accepted" className="bg-background text-foreground font-semibold">Accepted</option>
                            <option value="Rejected" className="bg-background text-foreground font-semibold">Rejected</option>
                            <option value="Returned to Employee" className="bg-background text-foreground font-semibold">Returned to Employee</option>
                          </select>
                        ) : (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border",
                            doc.status === "Accepted" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" :
                            doc.status === "Rejected" ? "bg-rose-500/10 text-rose-700 border-rose-500/20" :
                            doc.status === "Returned to Employee" ? "bg-amber-500/10 text-amber-700 border-amber-500/20" :
                            "bg-slate-500/10 text-slate-700 border-slate-500/20"
                          )}>
                            {doc.status}
                          </span>
                        )}
                      </td>

                      {/* Date Column (Inline Editable for Admin/HR) */}
                      <td className="p-4 text-xs font-semibold text-muted-foreground">
                        {isAdminOrHR ? (
                          <input
                            type="date"
                            value={doc.uploadDate && doc.uploadDate !== "-" ? doc.uploadDate : ""}
                            onChange={(e) => handleInlineDateChange(doc, e.target.value)}
                            className="px-2 py-1 bg-background hover:bg-muted/50 border border-border/50 rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors cursor-pointer"
                          />
                        ) : (
                          doc.uploadDate || "-"
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
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
                            <>
                              {doc.filePath && (
                                <button
                                  onClick={() => window.open(`${API_URL}/submitted-documents/${doc.id}/download`, '_blank')}
                                  className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-xl transition-colors"
                                  title="View / Download Document File"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}

                              {isAdminOrHR && (
                                <button
                                  onClick={() => openEditModal(doc)}
                                  className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-xl transition-colors"
                                  title="Update Document Status"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}

                              {isAdminOrHR && (
                                <button
                                  onClick={() => handleDeleteSubmittedDoc(doc)}
                                  className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                                  title="Delete Document"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload/Submit Document Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="w-[calc(100vw-16px)] sm:max-w-[480px] p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Upload className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black tracking-tight text-foreground">Upload Submitted Document</h2>
            </div>
            <DialogClose asChild>
              <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Select Employee *
              </label>
              <SearchableSelect
                value={uploadEmployeeId}
                onChange={setUploadEmployeeId}
                options={formattedEmployeeOptions}
                placeholder="Choose Employee..."
                className="w-full h-[40px] text-xs font-bold bg-background border border-border/50 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Document Type *
              </label>
              <select
                value={uploadDocTypeId}
                onChange={e => setUploadDocTypeId(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border/50 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">-- Choose Document Type --</option>
                {docTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name} {t.isRequired ? "(Mandatory)" : ""}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Document Date
                </label>
                <input
                  type="date"
                  value={uploadDate}
                  onChange={e => setUploadDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  value={uploadStatus}
                  onChange={e => setUploadStatus(e.target.value as DocStatus)}
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Accepted">Accepted</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Returned to Employee">Returned to Employee</option>
                </select>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border/50 bg-muted/30 flex justify-end gap-3">
            <button
              onClick={() => setIsUploadModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUploadDocument}
              disabled={isSubmitting || !uploadEmployeeId || !uploadDocTypeId}
              className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Document"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Submitted Document Modal */}
      {editingDoc && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="w-[calc(100vw-16px)] sm:max-w-[440px] p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-black tracking-tight text-foreground">Edit Submitted Document</h2>
              </div>
              <DialogClose asChild>
                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </DialogClose>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Employee
                </label>
                <div className="p-2.5 bg-muted/40 border border-border/40 rounded-xl text-xs font-bold text-foreground">
                  {editingDoc.employeeName}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Document Type
                </label>
                <select
                  value={editDocTypeId}
                  onChange={e => setEditDocTypeId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border/50 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">{editingDoc.documentName}</option>
                  {docTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as DocStatus)}
                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Accepted">Accepted</option>
                    <option value="Pending Review">Pending Review</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Returned to Employee">Returned to Employee</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border/50 bg-muted/30 flex justify-end gap-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSubmitting}
                className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Deposit Ledger Modal */}
      {selectedLedgerDoc && (() => {
        const info = getDepositInfo(selectedLedgerDoc);
        const targetEmp = employees.find(e => e.id === selectedLedgerDoc.employeeId);

        return (
          <Dialog open={isLedgerModalOpen} onOpenChange={(v) => { if (!v) setIsLedgerModalOpen(false); }}>
            <DialogContent className="w-[calc(100vw-16px)] sm:max-w-[560px] max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
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

              <div className="p-4 sm:p-6 space-y-6 max-h-[75dvh] overflow-y-auto flex-1 min-h-0">
                {/* Ledger Financial Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        className="px-4 py-2 min-h-[44px] sm:min-h-0 w-full sm:w-auto justify-center bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black rounded-xl transition-colors shadow-sm disabled:opacity-50"
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
