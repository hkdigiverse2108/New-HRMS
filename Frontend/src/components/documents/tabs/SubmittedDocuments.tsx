import { useState } from "react";
import { Search, Filter, FileText, CheckCircle2, Clock, AlertCircle, Eye, Download } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

type DocStatus = "Accepted" | "Pending Review" | "Pending Submission" | "Rejected";

interface EmployeeDoc {
  id: string;
  employeeName: string;
  documentName: string;
  status: DocStatus;
  submittedAt?: string;
  fileSize?: string;
}

const MOCK_DOCS: EmployeeDoc[] = [
  { id: "1", employeeName: "Sarah Jenkins", documentName: "Aadhaar Card", status: "Accepted", submittedAt: "2024-03-15", fileSize: "1.2 MB" },
  { id: "2", employeeName: "Michael Chen", documentName: "Degree Certificate", status: "Pending Review", submittedAt: "2024-03-14", fileSize: "3.4 MB" },
  { id: "3", employeeName: "David Kumar", documentName: "Relieving Letter", status: "Pending Submission" },
  { id: "4", employeeName: "Emma Watson", documentName: "PAN Card", status: "Rejected", submittedAt: "2024-03-12", fileSize: "0.8 MB" },
  { id: "5", employeeName: "Sarah Jenkins", documentName: "Security Deposit Agreement", status: "Accepted", submittedAt: "2024-03-15", fileSize: "2.1 MB" },
];

export function SubmittedDocuments() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "All">("All");

  const filteredDocs = MOCK_DOCS.filter(doc => {
    const matchesSearch = doc.employeeName.toLowerCase().includes(search.toLowerCase()) || doc.documentName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { items: sortedDocs, requestSort, sortConfig } = useSortableData(filteredDocs);

  const getStatusIcon = (status: DocStatus) => {
    switch (status) {
      case "Accepted": return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "Pending Review": return <Clock className="w-3.5 h-3.5" />;
      case "Pending Submission": return <FileText className="w-3.5 h-3.5" />;
      case "Rejected": return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };

  const getStatusColor = (status: DocStatus) => {
    switch (status) {
      case "Accepted": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "Pending Review": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Pending Submission": return "bg-slate-500/10 text-slate-600 border-slate-500/20";
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
            placeholder="Search employees or documents..."
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
                { label: "Accepted", value: "Accepted" },
                { label: "Pending Review", value: "Pending Review" },
                { label: "Pending Submission", value: "Pending Submission" },
                { label: "Rejected", value: "Rejected" }
              ]}
              className="w-full sm:w-[200px] pl-9 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader label="Employee" sortKey="employeeName" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Document" sortKey="documentName" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Submitted On" sortKey="submittedAt" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No documents found matching your filters.
                  </td>
                </tr>
              ) : (
                sortedDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{doc.employeeName}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{doc.documentName}</div>
                          {doc.fileSize && <div className="text-xs text-muted-foreground">{doc.fileSize}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border",
                        getStatusColor(doc.status)
                      )}>
                        {getStatusIcon(doc.status)}
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground font-medium">
                      {doc.submittedAt ? formatDate(doc.submittedAt) : "-"}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          disabled={doc.status === "Pending Submission"}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          disabled={doc.status === "Pending Submission"}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <Download className="w-4 h-4" />
                        </button>
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
