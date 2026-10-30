import React, { useState, useEffect } from "react";
import { Search, PenTool, CheckCircle2, Clock, Eye, UserCheck, Image as ImageIcon, X, Building2, Trash2 } from "lucide-react";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Employee } from "@/components/employees/employee-data";
import { useAuth } from "@/components/auth/AuthContext";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export function EmployeeSignatures() {
  const { employees, refreshEmployees } = useEmployeesContext();
  const { user: authUser } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Signed" | "Pending">("All");
  const [departmentFilter, setDepartmentFilter] = useState<string>("All");

  // Preview modal state
  const [previewSigEmp, setPreviewSigEmp] = useState<{ name: string; id: string; signatureUrl: string } | null>(null);

  // Delete signature state
  const [sigToDelete, setSigToDelete] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdminOrHr =
    authUser?.role === "Admin" ||
    Boolean((authUser as any)?.is_superuser) ||
    (authUser as any)?.department?.toLowerCase() === "hr" ||
    (authUser as any)?.designation?.toLowerCase().includes("hr");

  const handleDeleteSignature = async () => {
    if (!sigToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/employees/${sigToDelete.id}/signature`);
      if (typeof window !== "undefined") {
        localStorage.removeItem(`user_signature_${sigToDelete.id}`);
        if (sigToDelete.employeeId) {
          localStorage.removeItem(`user_signature_${sigToDelete.employeeId}`);
        }
        if (sigToDelete.email) {
          localStorage.removeItem(`user_signature_${sigToDelete.email}`);
        }
        if (
          authUser &&
          (sigToDelete.id === authUser.id || sigToDelete.employeeId === (authUser as any).employee_id)
        ) {
          localStorage.removeItem("user_signature_current");
        }
      }
      toast.success(`Signature for ${sigToDelete.name} has been deleted.`);
      const deletedId = sigToDelete.id;
      const deletedEmpId = sigToDelete.employeeId;
      setSigToDelete(null);
      if (previewSigEmp && (previewSigEmp.id === deletedId || previewSigEmp.id === deletedEmpId)) {
        setPreviewSigEmp(null);
      }
      if (refreshEmployees) {
        await refreshEmployees();
      }
    } catch (error: any) {
      console.error("Failed to delete signature:", error);
      toast.error(error?.response?.data?.detail || "Failed to delete signature. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Auto refresh employee signatures on mount & poll
  useEffect(() => {
    refreshEmployees?.();
  }, []);

  // Helper to resolve employee signature from API object, nested objects, or local storage
  const getEmpSignature = (emp: Employee): string | null => {
    if (emp.signature && emp.signature.trim() !== "") return emp.signature;
    if (emp.signature_url && emp.signature_url.trim() !== "") return emp.signature_url;
    if ((emp as any).personal_info?.signature) return (emp as any).personal_info.signature;
    if ((emp as any).personal_info?.signature_url) return (emp as any).personal_info.signature_url;

    if (typeof window !== "undefined") {
      const localId = localStorage.getItem(`user_signature_${emp.id}`);
      if (localId && localId.trim() !== "") return localId;

      if (emp.employeeId) {
        const localEmpId = localStorage.getItem(`user_signature_${emp.employeeId}`);
        if (localEmpId && localEmpId.trim() !== "") return localEmpId;
      }

      if (emp.email) {
        const localEmail = localStorage.getItem(`user_signature_${emp.email}`);
        if (localEmail && localEmail.trim() !== "") return localEmail;
      }

      // Check current active user signature fallback
      const currentSig = localStorage.getItem("user_signature_current");
      if (currentSig && currentSig.trim() !== "") {
        if (
          authUser &&
          (emp.id === authUser.id ||
            emp.employeeId === (authUser as any).employee_id ||
            emp.email?.toLowerCase() === authUser.email?.toLowerCase())
        ) {
          return currentSig;
        }
      }
    }
    return null;
  };

  // Unique departments for filter
  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

  // Filtered employees list
  const filteredEmployees = employees.filter((emp) => {
    const sigUrl = getEmpSignature(emp);
    const hasSig = !!sigUrl;

    // Search filter
    const searchLower = search.toLowerCase();
    const matchesSearch =
      emp.name.toLowerCase().includes(searchLower) ||
      emp.email.toLowerCase().includes(searchLower) ||
      (emp.employeeId || "").toLowerCase().includes(searchLower) ||
      (emp.department || "").toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // Status filter
    if (statusFilter === "Signed" && !hasSig) return false;
    if (statusFilter === "Pending" && hasSig) return false;

    // Department filter
    if (departmentFilter !== "All" && emp.department !== departmentFilter) return false;

    return true;
  });

  const { items: sortedEmployees, requestSort, sortConfig } = useSortableData(filteredEmployees);

  // Statistics
  const totalEmployees = employees.length;
  const signedCount = employees.filter((e) => !!getEmpSignature(e)).length;
  const pendingCount = totalEmployees - signedCount;

  return (
    <div className="space-y-6">
      {/* Header Controls: Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 justify-between items-stretch lg:items-center">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by employee name, ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/60 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm font-medium shadow-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="py-2.5 px-4 bg-card border border-border/60 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
          >
            <option value="All">All Statuses ({totalEmployees})</option>
            <option value="Signed">Signature Added ({signedCount})</option>
            <option value="Pending">Pending Signature ({pendingCount})</option>
          </select>

          {/* Department Filter */}
          {departments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="py-2.5 px-4 bg-card border border-border/60 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            >
              <option value="All">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">Total Employees</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-800">{totalEmployees}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-emerald-700 font-bold text-xs uppercase tracking-wider mb-1">Signature Added</div>
            <div className="text-3xl font-black text-emerald-700">{signedCount}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">Pending Signatures</div>
            <div className="text-3xl font-black text-amber-700">{pendingCount}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Employee Signatures Table */}
      <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <SortableHeader
                  label="Employee"
                  sortKey="name"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap"
                />
                <SortableHeader
                  label="Department / Role"
                  sortKey="department"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap"
                />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                  Signature Status
                </th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                  Digital Signature
                </th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-muted-foreground">
                    <div className="max-w-xs mx-auto space-y-2">
                      <PenTool className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                      <p className="font-bold text-sm">No employees found</p>
                      <p className="text-xs text-muted-foreground">Try adjusting your search query or filter selection.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedEmployees.map((emp) => {
                  const sigUrl = getEmpSignature(emp);
                  const hasSig = !!sigUrl;

                  return (
                    <tr key={emp.id} className="hover:bg-muted/30 transition-colors group">
                      {/* Employee Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-black flex items-center justify-center overflow-hidden shrink-0">
                            {emp.avatar || emp.profile_photo ? (
                              <img src={emp.avatar || emp.profile_photo} alt={emp.name} className="w-full h-full object-cover" />
                            ) : (
                              emp.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground truncate max-w-[180px]" title={emp.name}>
                              {emp.name}
                            </div>
                            <div className="text-xs text-muted-foreground font-medium truncate max-w-[180px]">
                              {emp.employeeId ? `ID: ${emp.employeeId} · ` : ""}
                              {emp.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department / Designation */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                            {emp.department || "General"}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium">
                            {emp.designation || emp.role || "Team Member"}
                          </div>
                        </div>
                      </td>

                      {/* Signature Status */}
                      <td className="p-4">
                        {hasSig ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Signature Added
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Digital Signature Preview Thumbnail */}
                      <td className="p-4">
                        {hasSig && sigUrl ? (
                          <div
                            onClick={() =>
                              setPreviewSigEmp({
                                name: emp.name,
                                id: emp.employeeId || emp.id,
                                signatureUrl: sigUrl,
                              })
                            }
                            className="w-36 h-12 border border-slate-200 bg-white rounded-xl p-1.5 flex items-center justify-center cursor-pointer hover:border-emerald-500 hover:shadow-xs transition-all group/thumb relative"
                            title="Click to view full signature"
                          >
                            <img src={sigUrl} alt={`${emp.name} signature`} className="max-h-full max-w-full object-contain" />
                            <div className="absolute inset-0 bg-emerald-900/10 opacity-0 group-hover/thumb:opacity-100 rounded-xl transition-opacity flex items-center justify-center">
                              <Eye className="w-4 h-4 text-emerald-800 bg-white p-0.5 rounded-full shadow-xs" />
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground/60 italic flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5" /> No signature uploaded
                          </div>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="p-4">
                        <div className="flex justify-end items-center gap-2">
                          {hasSig && sigUrl ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewSigEmp({
                                    name: emp.name,
                                    id: emp.employeeId || emp.id,
                                    signatureUrl: sigUrl,
                                  })
                                }
                                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                                title="View Full Signature"
                              >
                                <Eye className="w-3.5 h-3.5" /> View Signature
                              </button>

                              {isAdminOrHr && (
                                <button
                                  type="button"
                                  onClick={() => setSigToDelete(emp)}
                                  className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 font-bold text-xs rounded-xl transition-colors flex items-center justify-center shadow-xs"
                                  title="Delete Signature"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Pending Profile Add</span>
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

      {/* Signature Zoom Preview Dialog */}
      <Dialog open={!!previewSigEmp} onOpenChange={(open) => !open && setPreviewSigEmp(null)}>
        <DialogContent className="w-[calc(100vw-16px)] sm:max-w-md p-0 overflow-hidden rounded-3xl border border-border/60 shadow-2xl bg-background [&>button]:hidden">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-card">
            <div>
              <h3 className="text-base font-black text-foreground">{previewSigEmp?.name}</h3>
              <p className="text-xs text-muted-foreground">Digital Signature Preview</p>
            </div>
            <button
              onClick={() => setPreviewSigEmp(null)}
              className="p-1.5 border border-border/60 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-md w-full max-w-xs flex items-center justify-center min-h-[140px]">
              {previewSigEmp?.signatureUrl && (
                <img src={previewSigEmp.signatureUrl} alt={previewSigEmp.name} className="max-h-32 object-contain mx-auto" />
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium text-center">
              Official digital signature added by employee from profile.
            </p>
          </div>
          <div className="px-6 py-3 border-t border-border/60 bg-card flex justify-between items-center">
            {isAdminOrHr && previewSigEmp && (
              <button
                type="button"
                onClick={() => {
                  const targetEmp = employees.find(
                    (e) => e.id === previewSigEmp.id || e.employeeId === previewSigEmp.id
                  );
                  if (targetEmp) {
                    setSigToDelete(targetEmp);
                  }
                }}
                className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Signature
              </button>
            )}
            <button
              onClick={() => setPreviewSigEmp(null)}
              className="ml-auto px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal for Signature Deletion */}
      <ConfirmModal
        isOpen={!!sigToDelete}
        onClose={() => setSigToDelete(null)}
        onConfirm={handleDeleteSignature}
        title="Delete Digital Signature"
        description="Are you sure you want to delete this employee's digital signature? The employee will need to upload or draw their signature again."
        itemName={sigToDelete?.name}
        confirmText={isDeleting ? "Deleting..." : "Delete Signature"}
        variant="destructive"
      />
    </div>
  );
}
