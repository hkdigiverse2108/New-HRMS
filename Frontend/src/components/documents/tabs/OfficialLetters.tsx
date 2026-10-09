import { useState, useEffect, useMemo } from "react";
import { Plus, Filter, FileText, CheckCircle2, XCircle, Clock, X, Download, Eye, Upload, Printer, Mail, FilePlus, Send, ChevronDown, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { SearchInput } from "@/components/common/SearchInput";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin } from "@/lib/permissions";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

type RequestStatus = "Pending" | "Approved" | "Sent" | "Rejected";

interface LetterRequestItem {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code?: string;
  letter_type: string;
  template_id?: string;
  requested_date: string;
  needed_by_date: string;
  reason: string;
  status: RequestStatus;
  rejection_reason?: string;
  pdf_url?: string;
  generated_document_id?: string;
  content?: string;
}

export function OfficialLetters({ onNavigate }: { onNavigate?: ((path: string) => void) | undefined }) {
  const { user } = useAuth();
  const userRole = String((user as any)?.role || (user as any)?.work_details?.system_role || (user as any)?.system_role || "").toLowerCase();
  const userDept = String((user as any)?.department || (user as any)?.work_details?.department || "").toLowerCase();
  const isAdminOrHR = isUserAdmin(user) || ["admin", "subadmin", "superadmin", "hr", "hr manager"].some(r => userRole.includes(r)) || userDept === "hr";

  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<LetterRequestItem[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; role: string }[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [newLetterType, setNewLetterType] = useState("Relieving Letter");
  const [newReason, setNewReason] = useState("");
  const [newNeededBy, setNewNeededBy] = useState("");

  // Rejection Modal State
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; reqId?: string; reason: string }>({
    isOpen: false,
    reason: "",
  });

  // View Document Modal State
  const [viewDocModal, setViewDocModal] = useState<{
    isOpen: boolean;
    doc?: LetterRequestItem;
    isLoadingContent?: boolean;
    htmlContent?: string;
  }>({ isOpen: false });

  const pInfo = (user as any)?.personal_info || (user as any)?.personal_details || {};
  const currentEmpName = [
    pInfo.first_name || (user as any)?.first_name,
    pInfo.middle_name || (user as any)?.middle_name,
    pInfo.last_name || (user as any)?.last_name
  ].filter(Boolean).join(" ") || (user as any)?.name || (user as any)?.email || "Employee";

  const currentEmpId = String((user as any)?._id || (user as any)?.id || (user as any)?.employee_id || "");

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/letter-requests", { showLoader: false, showErrorToast: false });
      const rawItems = Array.isArray(res) ? res : res?.items || res?.data || [];
      const mapped: LetterRequestItem[] = rawItems.map((item: any) => ({
        id: String(item._id || item.id),
        employee_id: item.employee_id || "",
        employee_name: item.employee_name || "Employee",
        employee_code: item.employee_code || "",
        letter_type: item.letter_type || item.template_name || "Official Letter",
        template_id: item.template_id || "",
        requested_date: item.requested_date 
          ? new Date(item.requested_date).toISOString().split("T")[0] 
          : (item.created_at ? new Date(item.created_at).toISOString().split("T")[0] : "-"),
        needed_by_date: item.needed_by_date || "-",
        reason: item.reason || "-",
        status: (item.status as RequestStatus) || "Pending",
        rejection_reason: item.rejection_reason || "",
        pdf_url: item.pdf_url || "",
        generated_document_id: item.generated_document_id || "",
        content: item.content || "",
      }));
      setRequests(mapped);
    } catch (err: any) {
      console.error("Failed to fetch letter requests:", err);
      toast.error("Failed to load letter requests");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const loadEmployeesAndTemplates = async () => {
      try {
        const [empRes, tempRes] = await Promise.all([
          api.get("/employees?limit=1000", { showLoader: false, showErrorToast: false }).catch(() => []),
          api.get("/document-templates", { showLoader: false, showErrorToast: false }).catch(() => [])
        ]);

        const rawEmps = Array.isArray(empRes) ? empRes : empRes?.items || empRes?.data || [];
        setEmployees(rawEmps.map((e: any) => {
          const p = e.personal_info || {};
          const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || e.name || "Employee";
          return { id: String(e._id || e.id || e.employee_id), name, role: e.work_details?.designation || e.role || "EMP" };
        }));

        const rawTemps = Array.isArray(tempRes) ? tempRes : tempRes?.items || tempRes?.data || [];
        setTemplates(rawTemps.map((t: any) => ({ id: String(t._id || t.id), name: t.template_name || t.name || "Template" })));
      } catch (e) {}
    };

    loadEmployeesAndTemplates();
  }, []);

  const handleOpenCreateModal = () => {
    if (!isAdminOrHR) {
      setSelectedEmpId(currentEmpId);
    } else {
      setSelectedEmpId("");
    }
    setNewLetterType(templates[0]?.name || "Relieving Letter");
    setNewReason("");
    setNewNeededBy("");
    setIsAddMode(true);
  };

  const handleCreateRequest = async () => {
    if (!newReason.trim() || !newNeededBy) return;
    
    setIsSubmitting(true);
    try {
      const payload: any = {
        needed_by_date: newNeededBy,
        reason: newReason.trim(),
        letter_type: newLetterType,
      };

      if (isAdminOrHR && selectedEmpId && selectedEmpId !== "manual") {
        payload.employee_id = selectedEmpId;
      }

      await api.post("/letter-requests", payload);
      toast.success("Letter request submitted successfully!");
      setIsAddMode(false);
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit letter request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/letter-requests/${id}/approve`);
      toast.success("Request approved successfully");
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve request");
    }
  };

  const handleReject = async () => {
    if (!rejectModal.reqId) return;
    try {
      await api.post(`/letter-requests/${rejectModal.reqId}/reject`, { reason: rejectModal.reason });
      toast.success("Request rejected");
      setRejectModal({ isOpen: false, reason: "" });
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject request");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/letter-requests/${id}`);
      toast.success("Request deleted successfully");
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete request");
    }
  };

  const handleViewDocument = async (req: LetterRequestItem) => {
    setViewDocModal({ isOpen: true, doc: req, isLoadingContent: true, htmlContent: req.content || "" });

    if (!req.content && (req.generated_document_id || req.id)) {
      try {
        if (req.generated_document_id) {
          const docRes = await api.get(`/generated-documents/${req.generated_document_id}`, { showLoader: false, showErrorToast: false });
          if (docRes && docRes.rendered_content) {
            setViewDocModal({ isOpen: true, doc: req, isLoadingContent: false, htmlContent: docRes.rendered_content });
            return;
          }
        }
      } catch (e) {
        console.warn("Could not fetch generated document content:", e);
      }
    }

    setViewDocModal((prev) => ({ ...prev, isLoadingContent: false }));
  };

  const handleDownloadPDF = async (req: LetterRequestItem) => {
    if (req.generated_document_id) {
      try {
        const pdfBlob = await api.getBlob(`/generated-documents/${req.generated_document_id}/pdf`);
        const blobUrl = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = blobUrl;
        const fileName = `${req.letter_type.replace(/[^a-zA-Z0-9_-]/g, "_")}_${req.employee_name.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
        toast.success("Document downloaded successfully!");
        return;
      } catch (e) {
        console.warn("Direct PDF download failed, falling back to pdf_url or preview print:", e);
      }
    }

    if (req.pdf_url) {
      window.open(req.pdf_url, "_blank");
      return;
    }

    // Fallback view & print
    handleViewDocument(req);
  };

  const filteredRequests = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter(req => 
      req.employee_name.toLowerCase().includes(q) || 
      req.letter_type.toLowerCase().includes(q) ||
      req.reason.toLowerCase().includes(q)
    );
  }, [requests, search]);

  const { items: sortedRequests, requestSort, sortConfig } = useSortableData(filteredRequests);

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case "Sent": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "Approved": return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
      case "Pending": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Rejected": return "bg-rose-500/10 text-rose-600 border-rose-500/20";
    }
  };

  const letterTypeOptions = useMemo(() => {
    const defaultTypes = ["Relieving Letter", "Salary Certificate", "Employment Proof", "Offer Letter", "Experience Letter", "NOC Letter"];
    const templateNames = templates.map((t) => t.name);
    const combined = Array.from(new Set([...defaultTypes, ...templateNames]));
    return combined.map((name) => ({ label: name, value: name }));
  }, [templates]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <SearchInput
          placeholder="Search requests..."
          value={search}
          onChange={setSearch}
          className="w-full sm:max-w-md"
        />
        <button 
          onClick={handleOpenCreateModal}
          className="w-full sm:w-auto px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Request Document / Letter
        </button>
      </div>

      {/* CREATE NEW LETTER REQUEST DIALOG */}
      <Dialog open={isAddMode} onOpenChange={setIsAddMode}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between p-6 border-b border-border/50">
            <div>
              <h2 className="text-xl font-bold">New Letter Request</h2>
              <p className="text-xs text-muted-foreground">Submit a formal request for an official letter or document.</p>
            </div>
            <button 
              onClick={() => setIsAddMode(false)}
              className="p-2 text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
            
          <div className="p-4 sm:p-6 md:p-8 space-y-5 overflow-y-auto flex-1 min-h-0 max-h-[70dvh]">
            {isAdminOrHR ? (
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Target Employee</label>
                <SearchableSelect
                  value={selectedEmpId}
                  onChange={(val) => setSelectedEmpId(val)}
                  options={[
                    { label: "👤 Current User (Self)", value: currentEmpId },
                    ...employees.map(emp => ({ label: `${emp.name} (${emp.role})`, value: emp.id }))
                  ]}
                  placeholder="Select Employee..."
                  className="w-full h-[40px] px-4 rounded-xl border border-border/50 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Requesting For</label>
                <input
                  type="text"
                  disabled
                  value={currentEmpName}
                  className="w-full px-4 py-2.5 bg-muted/40 border border-border/50 rounded-xl text-sm font-bold text-foreground"
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Letter Type / Template *</label>
              <SearchableSelect
                value={newLetterType}
                onChange={(val) => setNewLetterType(val)}
                options={letterTypeOptions}
                placeholder="Select Letter Type..."
                className="w-full h-[40px] px-4 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Needed By Date *</label>
              <input
                type="date"
                value={newNeededBy}
                onChange={(e) => setNewNeededBy(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Reason for Request *</label>
              <textarea
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. Required for Bank Loan / Visa Application / Resignation Process"
                className="w-full h-24 px-4 py-3 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium resize-none"
              />
            </div>
          </div>

          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button 
              onClick={() => setIsAddMode(false)}
              className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted/50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateRequest}
              disabled={!newReason.trim() || !newNeededBy || isSubmitting}
              className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* REJECTION REASON DIALOG */}
      <Dialog open={rejectModal.isOpen} onOpenChange={(open) => setRejectModal({ isOpen: open, reason: "" })}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl bg-card border border-border/60">
          <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">
            <XCircle className="w-5 h-5" /> Reject Request
          </h3>
          <p className="text-xs text-muted-foreground">Provide a reason for rejecting this document request.</p>
          <textarea
            value={rejectModal.reason}
            onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
            placeholder="e.g. Incomplete details provided or request invalid..."
            className="w-full h-24 px-3.5 py-2.5 bg-background border border-border/50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500/20 font-medium resize-none mt-2"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setRejectModal({ isOpen: false, reason: "" })}
              className="px-4 py-2 text-xs font-bold border border-border rounded-xl hover:bg-muted/50"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              className="px-5 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 shadow-sm"
            >
              Reject Request
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TABLE VIEW */}
      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader label="Employee" sortKey="employee_name" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Letter Type" sortKey="letter_type" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Reason" sortKey="reason" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Dates" sortKey="requested_date" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    Loading document requests...
                  </td>
                </tr>
              ) : sortedRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <Mail className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="font-bold text-foreground text-sm mb-1">No Document Requests Found</p>
                    <p className="text-xs text-muted-foreground mb-4">You have no pending or completed official letter requests.</p>
                    <button
                      onClick={handleOpenCreateModal}
                      className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Submit New Request
                    </button>
                  </td>
                </tr>
              ) : (
                sortedRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/30 transition-colors group">
                    {(() => {
                      const resolvedEmpName = (req.employee_name && req.employee_name !== "Employee")
                        ? req.employee_name
                        : (employees.find(e => e.id === req.employee_id)?.name || req.employee_name || "Employee");

                      const resolvedLetterType = (req.letter_type && req.letter_type !== "Official Letter")
                        ? req.letter_type
                        : (templates.find(t => t.id === req.template_id)?.name || req.letter_type || "Official Letter");

                      return (
                        <>
                          <td className="p-4">
                            <div className="font-bold text-foreground">{resolvedEmpName}</div>
                            {req.employee_code && (
                              <div className="text-[10px] font-mono font-semibold text-muted-foreground">{req.employee_code}</div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                                <Mail className="w-4 h-4" />
                              </div>
                              <div className="font-semibold text-sm">{resolvedLetterType}</div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm text-muted-foreground truncate max-w-[220px]" title={req.reason}>
                              {req.reason}
                            </div>
                            {req.rejection_reason && req.status === "Rejected" && (
                              <div className="text-xs text-rose-500 font-medium mt-0.5" title={req.rejection_reason}>
                                Reason: {req.rejection_reason}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-0.5">
                              <div className="text-xs font-medium text-muted-foreground">Req: {req.requested_date}</div>
                              <div className="text-xs font-bold text-foreground">Due: {req.needed_by_date}</div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border",
                              getStatusColor(req.status)
                            )}>
                              {req.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex justify-end items-center gap-1">
                              {/* View Document Action */}
                              {(req.status === "Sent" || req.status === "Approved" || req.pdf_url || req.content || req.generated_document_id) && (
                                <button
                                  title="View Document"
                                  onClick={() => handleViewDocument(req)}
                                  className="p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg transition-colors font-bold"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}

                              {/* Download PDF Action */}
                              {(req.status === "Sent" || req.status === "Approved" || req.pdf_url || req.generated_document_id) && (
                                <button
                                  title="Download PDF Document"
                                  onClick={() => handleDownloadPDF(req)}
                                  className="p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors font-bold"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}

                              {isAdminOrHR ? (
                                <>
                                  {req.status === "Pending" && (
                                    <>
                                      <button
                                        title="Approve Request"
                                        onClick={() => handleApprove(req.id)}
                                        className="p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors font-bold"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        title="Reject Request"
                                        onClick={() => setRejectModal({ isOpen: true, reqId: req.id, reason: "" })}
                                        className="p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors font-bold"
                                      >
                                        <XCircle className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}

                                  <button
                                    title="Generate Document"
                                    onClick={() => {
                                      if (onNavigate) {
                                        const params = new URLSearchParams();
                                        if (req.employee_id) params.set("empId", req.employee_id);
                                        if (req.template_id) params.set("tempId", req.template_id);
                                        if (resolvedLetterType) params.set("letterType", resolvedLetterType);
                                        onNavigate(`/employees/documents/generate?${params.toString()}`);
                                      }
                                    }}
                                    className="p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                  >
                                    <FilePlus className="w-4 h-4" />
                                  </button>

                                  <button
                                    title="Delete Request"
                                    onClick={() => handleDelete(req.id)}
                                    className="p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : !req.pdf_url && req.status !== "Sent" && !req.content && !req.generated_document_id ? (
                                <span className="text-xs text-muted-foreground font-mono px-2 py-1">-</span>
                              ) : null}
                            </div>
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW DOCUMENT MODAL */}
      <Dialog open={viewDocModal.isOpen} onOpenChange={(open) => setViewDocModal({ isOpen: open })}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-4xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between p-5 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{viewDocModal.doc?.letter_type || "Official Document"}</h2>
                <p className="text-xs text-muted-foreground">Issued to: {viewDocModal.doc?.employee_name || "Employee"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {viewDocModal.doc && (
                <button
                  onClick={() => handleDownloadPDF(viewDocModal.doc!)}
                  className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
              )}
              <button 
                onClick={() => setViewDocModal({ isOpen: false })}
                className="p-2 text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-900/60 flex justify-center">
            {viewDocModal.isLoadingContent ? (
              <div className="py-16 text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
                <p className="text-sm font-semibold">Loading document content...</p>
              </div>
            ) : viewDocModal.htmlContent ? (
              <div className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-md rounded-2xl p-8 sm:p-12 border border-slate-200 font-normal text-sm leading-relaxed prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: viewDocModal.htmlContent }} />
              </div>
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="font-bold text-base text-foreground mb-1">Document Sent</p>
                <p className="text-xs text-muted-foreground mb-4">Click below to download the official signed PDF document.</p>
                {viewDocModal.doc && (
                  <button
                    onClick={() => handleDownloadPDF(viewDocModal.doc!)}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download Official PDF
                  </button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

