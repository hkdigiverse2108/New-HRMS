import React, { useState } from "react";
import { Search, Filter, Stamp, CheckCircle2, AlertCircle, Clock, Eye, FileText, UserCheck, X, ShieldCheck } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { Employee } from "@/components/employees/employee-data";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

export type ContractStatus = "Pending" | "Verified" | "Rejected";

export interface EmployeeContractItem {
  id: string;
  employeeId: string;
  employeeName: string;
  avatar: string;
  department: string;
  designation: string;
  contractType: string;
  uploadedAt: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  hasBond: boolean;
  hasNoticePeriod: boolean;
  hasResignation: boolean;
  employeeObj: Employee;
}

export function VerifyContracts() {
  const { employees, updateEmployee, refreshEmployees } = useEmployeesContext();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "All">("All");

  // Local state for immediate status overrides
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ContractStatus>>({});

  // Selected contract modal for viewing details
  const [selectedContract, setSelectedContract] = useState<EmployeeContractItem | null>(null);

  // Derive real contracts from employee list (only employees with active bond, employment contract, or bond dates)
  const contractItems: EmployeeContractItem[] = employees
    .filter((emp) => emp.hasBond || emp.hasEmployment || emp.bondStartDate || emp.bondEndDate)
    .map((emp) => {
      let status: ContractStatus = statusOverrides[emp.id] || (emp as any).contractStatus || "Pending";

      const type = emp.hasBond
        ? "Employment Bond Agreement"
        : emp.hasEmployment
        ? "Employment Contract"
        : "Service Agreement";

      const start = emp.bondStartDate || emp.employmentStartDate || emp.joinDate || "2026-01-01";
      const end = emp.bondEndDate || "2027-01-01";

      return {
        id: emp.id,
        employeeId: emp.employeeId || emp.id,
        employeeName: emp.name,
        avatar: emp.avatar || emp.profile_photo || "",
        department: emp.department || "Development",
        designation: emp.designation || emp.role || "Employee",
        contractType: type,
        uploadedAt: start,
        startDate: start,
        endDate: end,
        status: status,
        hasBond: !!emp.hasBond,
        hasNoticePeriod: !!emp.hasNoticePeriod,
        hasResignation: !!emp.hasResignation,
        employeeObj: emp,
      };
    });

  // Filtering
  const filteredContracts = contractItems.filter((item) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      item.employeeName.toLowerCase().includes(searchLower) ||
      item.contractType.toLowerCase().includes(searchLower) ||
      item.department.toLowerCase().includes(searchLower) ||
      item.employeeId.toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { items: sortedContracts, requestSort, sortConfig } = useSortableData(filteredContracts);

  // Handlers for verifying / rejecting
  const handleUpdateStatus = async (item: EmployeeContractItem, newStatus: ContractStatus) => {
    // 1. Instant UI update
    setStatusOverrides((prev) => ({ ...prev, [item.id]: newStatus }));
    if (selectedContract?.id === item.id) {
      setSelectedContract({ ...selectedContract, status: newStatus });
    }

    try {
      // 2. Persist to backend MongoDB
      await updateEmployee(item.id, {
        ...(item.employeeObj as any),
        contractStatus: newStatus,
      });
      toast.success(`Contract for ${item.employeeName} marked as ${newStatus}!`);
      if (refreshEmployees) await refreshEmployees();
    } catch {
      toast.error("Failed to sync contract status to server.");
    }
  };

  // Stats
  const totalContracts = contractItems.length;
  const pendingCount = contractItems.filter((c) => c.status === "Pending").length;
  const verifiedCount = contractItems.filter((c) => c.status === "Verified").length;
  const rejectedCount = contractItems.filter((c) => c.status === "Rejected").length;

  const getStatusIcon = (status: ContractStatus) => {
    switch (status) {
      case "Verified":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "Pending":
        return <Clock className="w-3.5 h-3.5" />;
      case "Rejected":
        return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };

  const getStatusColor = (status: ContractStatus) => {
    switch (status) {
      case "Verified":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
      case "Pending":
        return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      case "Rejected":
        return "bg-rose-500/10 text-rose-700 border-rose-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employee or contract type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/60 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm font-medium shadow-xs"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="py-2.5 px-4 bg-card border border-border/60 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
          >
            <option value="All">All Statuses ({totalContracts})</option>
            <option value="Pending">Pending Verification ({pendingCount})</option>
            <option value="Verified">Verified ({verifiedCount})</option>
            <option value="Rejected">Rejected ({rejectedCount})</option>
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">Total Active Contracts</div>
            <div className="text-3xl font-black text-slate-800">{totalContracts}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
            <Stamp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">Pending Verification</div>
            <div className="text-3xl font-black text-amber-700">{pendingCount}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-emerald-700 font-bold text-xs uppercase tracking-wider mb-1">Verified Contracts</div>
            <div className="text-3xl font-black text-emerald-700">{verifiedCount}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <SortableHeader
                  label="Employee"
                  sortKey="employeeName"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap"
                />
                <SortableHeader
                  label="Contract Type"
                  sortKey="contractType"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap"
                />
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap"
                />
                <SortableHeader
                  label="Bond Period / Date"
                  sortKey="startDate"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap"
                />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">
                  Verification & Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedContracts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-muted-foreground">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Stamp className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                      <p className="font-bold text-sm">No employee contracts found</p>
                      <p className="text-xs text-muted-foreground">
                        Select "Employee has an active bond" or "Employment Contract" in an employee's profile under Bonds & Exit tab to show them here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-muted/30 transition-colors group">
                    {/* Employee */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 font-black flex items-center justify-center overflow-hidden shrink-0">
                          {contract.avatar ? (
                            <img src={contract.avatar} alt={contract.employeeName} className="w-full h-full object-cover" />
                          ) : (
                            contract.employeeName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate max-w-[180px]">{contract.employeeName}</div>
                          <div className="text-xs text-muted-foreground font-medium">
                            {contract.employeeId ? `ID: ${contract.employeeId} · ` : ""}
                            {contract.department}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contract Type */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                          <Stamp className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{contract.contractType}</div>
                          <div className="text-xs text-muted-foreground font-medium">
                            {contract.hasBond ? "Legal Active Bond" : "Employment Agreement"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border",
                          getStatusColor(contract.status)
                        )}
                      >
                        {getStatusIcon(contract.status)}
                        {contract.status}
                      </span>
                    </td>

                    {/* Bond Period / Date */}
                    <td className="p-4 text-xs font-bold text-foreground">
                      {contract.startDate} {contract.endDate ? ` to ${contract.endDate}` : ""}
                    </td>

                    {/* Actions */}
                    <td className="p-4">
                      <div className="flex flex-wrap justify-end items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedContract(contract)}
                          className="p-2 border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors"
                          title="View Contract Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {contract.status !== "Verified" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(contract, "Verified")}
                            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-bold rounded-xl transition-colors"
                          >
                            Verify
                          </button>
                        )}

                        {contract.status !== "Rejected" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(contract, "Rejected")}
                            className="px-3 py-1.5 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-bold rounded-xl transition-colors"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract View Details Dialog */}
      <Dialog open={!!selectedContract} onOpenChange={(open) => !open && setSelectedContract(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border border-border/60 shadow-2xl bg-background [&>button]:hidden">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-card">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                <Stamp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">{selectedContract?.employeeName}</h3>
                <p className="text-xs text-muted-foreground">{selectedContract?.contractType}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedContract(null)}
              className="p-1.5 border border-border/60 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <div className="p-4 bg-muted/30 rounded-2xl border border-border/40 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-border/40">
                <span className="text-muted-foreground font-bold">Employee ID:</span>
                <span className="font-bold text-foreground">{selectedContract?.employeeId}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/40">
                <span className="text-muted-foreground font-bold">Department / Role:</span>
                <span className="font-bold text-foreground">
                  {selectedContract?.department} ({selectedContract?.designation})
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/40">
                <span className="text-muted-foreground font-bold">Bond Start Date:</span>
                <span className="font-bold text-foreground">{selectedContract?.startDate || "—"}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/40">
                <span className="text-muted-foreground font-bold">Bond End Date:</span>
                <span className="font-bold text-foreground">{selectedContract?.endDate || "—"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-bold">Verification Status:</span>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg font-bold border",
                    getStatusColor(selectedContract?.status || "Pending")
                  )}
                >
                  {selectedContract?.status}
                </span>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 border-t border-border/60 bg-card flex justify-end gap-2">
            {selectedContract?.status !== "Verified" && (
              <button
                onClick={() => selectedContract && handleUpdateStatus(selectedContract, "Verified")}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors"
              >
                Verify Contract
              </button>
            )}
            <button
              onClick={() => setSelectedContract(null)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
