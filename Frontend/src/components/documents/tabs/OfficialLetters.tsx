import { useState } from "react";
import { Search, Plus, Filter, FileText, CheckCircle2, Clock, X, Download, Eye, Upload, Printer, Mail, FilePlus, Send, ChevronDown } from "lucide-react";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EMPLOYEES } from "@/components/employees/employee-data";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

type RequestStatus = "Pending" | "Approved" | "Sent" | "Rejected";

interface LetterRequest {
  id: string;
  employeeName: string;
  letterType: string;
  reason: string;
  requestDate: string;
  neededByDate: string;
  status: RequestStatus;
}

const MOCK_REQUESTS: LetterRequest[] = [
  { id: "1", employeeName: "Sarah Jenkins", letterType: "Relieving Letter", reason: "Resignation completion", requestDate: "2024-03-10", neededByDate: "2024-03-20", status: "Pending" },
  { id: "2", employeeName: "Michael Chen", letterType: "Salary Certificate", reason: "Bank Loan", requestDate: "2024-03-14", neededByDate: "2024-03-16", status: "Sent" },
  { id: "3", employeeName: "David Kumar", letterType: "Employment Proof", reason: "Visa Application", requestDate: "2024-03-11", neededByDate: "2024-03-15", status: "Approved" },
  { id: "4", employeeName: "Emma Watson", letterType: "Offer Letter", reason: "New Hire", requestDate: "2024-03-05", neededByDate: "2024-03-06", status: "Sent" },
];

export function OfficialLetters({ onNavigate }: { onNavigate?: ((path: string) => void) | undefined }) {
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<LetterRequest[]>(MOCK_REQUESTS);
  
  const [isAddMode, setIsAddMode] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newLetterType, setNewLetterType] = useState("Relieving Letter");
  const [newReason, setNewReason] = useState("");
  const [newNeededBy, setNewNeededBy] = useState("");

  const filteredRequests = requests.filter(req => 
    req.employeeName.toLowerCase().includes(search.toLowerCase()) || 
    req.letterType.toLowerCase().includes(search.toLowerCase())
  );

  const { items: sortedRequests, requestSort, sortConfig } = useSortableData(filteredRequests);

  const handleCreateRequest = () => {
    if (!newEmployeeName.trim() || !newReason.trim() || !newNeededBy) return;
    
    const newRequest: LetterRequest = {
      id: `req_${Date.now()}`,
      employeeName: newEmployeeName.trim(),
      letterType: newLetterType,
      reason: newReason.trim(),
      requestDate: new Date().toISOString().split('T')[0] || "",
      neededByDate: newNeededBy,
      status: "Pending"
    };
    
    setRequests([newRequest, ...requests]);
    setIsAddMode(false);
    setNewEmployeeName("");
    setNewReason("");
    setNewNeededBy("");
  };

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case "Sent": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "Approved": return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
      case "Pending": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Rejected": return "bg-rose-500/10 text-rose-600 border-rose-500/20";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
          />
        </div>
        <button 
          onClick={() => setIsAddMode(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      <Dialog open={isAddMode} onOpenChange={setIsAddMode}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between p-6 border-b border-border/50">
              <h2 className="text-xl font-bold">New Letter Request</h2>
              <button 
                onClick={() => setIsAddMode(false)}
                className="p-2 text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Employee Name</label>
                <div className="relative">
                  <SearchableSelect
                    value={newEmployeeName}
                    onChange={(val) => setNewEmployeeName(val)}
                    options={EMPLOYEES.map(emp => ({ label: emp.name, value: emp.name }))}
                    placeholder="Select Employee"
                    className="w-full h-[38px] px-4 rounded-xl border border-border/50 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium appearance-none pr-8"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Letter Type</label>
                <SearchableSelect
                  value={newLetterType}
                  onChange={(val) => setNewLetterType(val)}
                  options={[
                    { label: "Relieving Letter", value: "Relieving Letter" },
                    { label: "Salary Certificate", value: "Salary Certificate" },
                    { label: "Employment Proof", value: "Employment Proof" },
                    { label: "Offer Letter", value: "Offer Letter" }
                  ]}
                  className="w-full h-[38px] px-4 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Needed By Date</label>
                <input
                  type="date"
                  value={newNeededBy}
                  onChange={(e) => setNewNeededBy(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Reason for Request</label>
                <textarea
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g. Visa application processing"
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
                disabled={!newEmployeeName.trim() || !newReason.trim() || !newNeededBy}
                className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
              >
                Submit Request
              </button>
            </div>
        </DialogContent>
      </Dialog>

      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader label="Employee" sortKey="employeeName" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Letter Type" sortKey="letterType" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Reason" sortKey="reason" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Dates" sortKey="requestDate" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No requests found matching your search.
                  </td>
                </tr>
              ) : (
                sortedRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{req.employeeName}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="font-semibold text-sm">{req.letterType}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-muted-foreground truncate max-w-[200px]" title={req.reason}>
                        {req.reason}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground">Req: {req.requestDate}</div>
                        <div className="text-xs font-bold text-foreground">Due: {req.neededByDate}</div>
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
                      <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                        <button 
                          title="Generate Letter"
                          onClick={() => onNavigate && onNavigate("/employees/documents/generate")}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <FilePlus className="w-4 h-4" />
                        </button>
                        <button 
                          title="Send to Employee"
                          disabled={req.status !== "Approved"}
                          className="p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <Send className="w-4 h-4" />
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
