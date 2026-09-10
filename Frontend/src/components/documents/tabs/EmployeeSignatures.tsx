import { useState } from "react";
import { Search, PenTool, CheckCircle2, Clock, Send, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

type SignatureStatus = "Pending" | "Signed" | "Expired";

interface SignatureRequest {
  id: string;
  employeeName: string;
  documentName: string;
  sentDate: string;
  status: SignatureStatus;
  signedDate?: string;
}

const MOCK_SIGNATURES: SignatureRequest[] = [
  { id: "s1", employeeName: "Sarah Jenkins", documentName: "Employee Handbook Acknowledgement", sentDate: "2024-03-18", status: "Pending" },
  { id: "s2", employeeName: "Michael Chen", documentName: "Non-Disclosure Agreement", sentDate: "2024-03-14", status: "Signed", signedDate: "2024-03-15" },
  { id: "s3", employeeName: "David Kumar", documentName: "IT Policy 2024", sentDate: "2024-02-01", status: "Expired" },
  { id: "s4", employeeName: "Emma Watson", documentName: "Offer Letter", sentDate: "2024-03-10", status: "Signed", signedDate: "2024-03-11" },
];

export function EmployeeSignatures() {
  const [search, setSearch] = useState("");

  const filteredSignatures = MOCK_SIGNATURES.filter(sig => 
    sig.employeeName.toLowerCase().includes(search.toLowerCase()) || 
    sig.documentName.toLowerCase().includes(search.toLowerCase())
  );

  const { items: sortedSignatures, requestSort, sortConfig } = useSortableData(filteredSignatures);

  const getStatusIcon = (status: SignatureStatus) => {
    switch (status) {
      case "Signed": return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "Pending": return <Clock className="w-3.5 h-3.5" />;
      case "Expired": return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const getStatusColor = (status: SignatureStatus) => {
    switch (status) {
      case "Signed": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "Pending": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Expired": return "bg-rose-500/10 text-rose-600 border-rose-500/20";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search signatures..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
          />
        </div>
        <button className="w-full sm:w-auto px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
          <Send className="w-4 h-4" />
          New Signature Request
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 shadow-sm">
          <div className="text-amber-600 font-bold text-xs uppercase tracking-wider mb-1">Pending Signatures</div>
          <div className="text-3xl font-black text-amber-700">{MOCK_SIGNATURES.filter(c => c.status === "Pending").length}</div>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 shadow-sm">
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Completed (30 days)</div>
          <div className="text-3xl font-black text-emerald-700">{MOCK_SIGNATURES.filter(c => c.status === "Signed").length}</div>
        </div>
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 shadow-sm">
          <div className="text-rose-600 font-bold text-xs uppercase tracking-wider mb-1">Expired Requests</div>
          <div className="text-3xl font-black text-rose-700">{MOCK_SIGNATURES.filter(c => c.status === "Expired").length}</div>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader label="Employee" sortKey="employeeName" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Document Name" sortKey="documentName" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Timeline" sortKey="sentDate" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedSignatures.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No signature requests found.
                  </td>
                </tr>
              ) : (
                sortedSignatures.map((sig) => (
                  <tr key={sig.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{sig.employeeName}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                          <PenTool className="w-4 h-4" />
                        </div>
                        <div className="font-semibold text-sm">{sig.documentName}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border",
                        getStatusColor(sig.status)
                      )}>
                        {getStatusIcon(sig.status)}
                        {sig.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground">Sent: {sig.sentDate}</div>
                        {sig.signedDate && <div className="text-xs font-bold text-emerald-600">Signed: {sig.signedDate}</div>}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          title="View Document"
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {sig.status === "Pending" && (
                          <button 
                            title="Resend Reminder"
                            className="p-2 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                          >
                            <Send className="w-4 h-4" />
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
    </div>
  );
}
