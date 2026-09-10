import { useState } from "react";
import { Search, Filter, Stamp, CheckCircle2, AlertCircle, Clock, Eye, Download, FileText } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

type ContractStatus = "Pending" | "Verified" | "Rejected";

interface Contract {
  id: string;
  employeeName: string;
  contractType: string;
  uploadedAt: string;
  status: ContractStatus;
  fileSize: string;
}

const MOCK_CONTRACTS: Contract[] = [
  { id: "c1", employeeName: "Sarah Jenkins", contractType: "Employment Contract", uploadedAt: "2024-03-15", status: "Pending", fileSize: "2.4 MB" },
  { id: "c2", employeeName: "Michael Chen", contractType: "Non-Disclosure Agreement", uploadedAt: "2024-03-14", status: "Verified", fileSize: "1.1 MB" },
  { id: "c3", employeeName: "David Kumar", contractType: "Contractor Agreement", uploadedAt: "2024-03-12", status: "Rejected", fileSize: "3.2 MB" },
  { id: "c4", employeeName: "Emma Watson", contractType: "Employment Contract", uploadedAt: "2024-03-10", status: "Verified", fileSize: "2.1 MB" },
];

export function VerifyContracts() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "All">("All");

  const filteredContracts = MOCK_CONTRACTS.filter(doc => {
    const matchesSearch = doc.employeeName.toLowerCase().includes(search.toLowerCase()) || doc.contractType.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { items: sortedContracts, requestSort, sortConfig } = useSortableData(filteredContracts);

  const getStatusIcon = (status: ContractStatus) => {
    switch (status) {
      case "Verified": return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "Pending": return <Clock className="w-3.5 h-3.5" />;
      case "Rejected": return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };

  const getStatusColor = (status: ContractStatus) => {
    switch (status) {
      case "Verified": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "Pending": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Rejected": return "bg-rose-500/10 text-rose-600 border-rose-500/20";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employees or contracts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <SearchableSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
                { label: "All Statuses", value: "All" },
                { label: "Pending Verification", value: "Pending" },
                { label: "Verified", value: "Verified" },
                { label: "Rejected", value: "Rejected" }
              ]}
              className="w-full sm:w-[200px] pl-9 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1">Total Contracts</div>
          <div className="text-3xl font-black">{MOCK_CONTRACTS.length}</div>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 shadow-sm">
          <div className="text-amber-600 font-bold text-xs uppercase tracking-wider mb-1">Pending Verification</div>
          <div className="text-3xl font-black text-amber-700">{MOCK_CONTRACTS.filter(c => c.status === "Pending").length}</div>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 shadow-sm">
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Verified Contracts</div>
          <div className="text-3xl font-black text-emerald-700">{MOCK_CONTRACTS.filter(c => c.status === "Verified").length}</div>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader label="Employee" sortKey="employeeName" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Contract Type" sortKey="contractType" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Uploaded On" sortKey="uploadedAt" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedContracts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No contracts found matching your filters.
                  </td>
                </tr>
              ) : (
                sortedContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{contract.employeeName}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                          <Stamp className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{contract.contractType}</div>
                          <div className="text-xs text-muted-foreground">{contract.fileSize}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border",
                        getStatusColor(contract.status)
                      )}>
                        {getStatusIcon(contract.status)}
                        {contract.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground font-medium">
                      {formatDate(contract.uploadedAt)}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button 
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="View Document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {contract.status === "Pending" && (
                          <>
                            <button 
                              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs font-bold rounded-lg transition-colors"
                            >
                              Verify
                            </button>
                            <button 
                              className="px-3 py-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-xs font-bold rounded-lg transition-colors"
                            >
                              Reject
                            </button>
                          </>
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
    </div>
  );
}
