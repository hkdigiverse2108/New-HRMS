import { useState } from "react";
import { Search, Filter, CheckCircle2, Clock, Check, X, FileText, Download, Building2 } from "lucide-react";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ApprovalStatus = "Pending" | "Approved" | "Rejected";

interface InvoiceApproval {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: string;
  submittedBy: string;
  submittedAt: string;
  status: ApprovalStatus;
  notes?: string;
}

const MOCK_APPROVALS: InvoiceApproval[] = [
  { id: "ia1", invoiceNumber: "INV-2024-105", clientName: "Acme Corp", amount: "₹ 1,50,000", submittedBy: "Sarah Jenkins", submittedAt: "Today, 10:30 AM", status: "Pending" },
  { id: "ia2", invoiceNumber: "INV-2024-106", clientName: "TechFlow Solutions", amount: "₹ 4,20,000", submittedBy: "Michael Chen", submittedAt: "Yesterday, 04:15 PM", status: "Pending" },
  { id: "ia3", invoiceNumber: "INV-2024-104", clientName: "Stark Industries", amount: "₹ 2,75,000", submittedBy: "Sarah Jenkins", submittedAt: "Mar 10, 02:00 PM", status: "Approved" },
  { id: "ia4", invoiceNumber: "INV-2024-103", clientName: "Global Logistics", amount: "₹ 85,000", submittedBy: "David Kumar", submittedAt: "Mar 09, 11:45 AM", status: "Rejected", notes: "Incorrect tax rate applied." },
];

export function InvoiceApprovals() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "All">("All");
  const [approvals, setApprovals] = useState<InvoiceApproval[]>(MOCK_APPROVALS);

  // Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceApproval | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const filteredApprovals = approvals.filter(app => {
    const matchesSearch = app.clientName.toLowerCase().includes(search.toLowerCase()) || app.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = approvals.filter(a => a.status === "Pending").length;
  const approvedCount = approvals.filter(a => a.status === "Approved").length;

  const handleOpenReview = (invoice: InvoiceApproval) => {
    setSelectedInvoice(invoice);
    setReviewNotes(invoice.notes || "");
    setReviewModalOpen(true);
  };

  const handleAction = (status: "Approved" | "Rejected") => {
    if (!selectedInvoice) return;
    
    setApprovals(approvals.map(app => {
      if (app.id === selectedInvoice.id) {
        return { ...app, status, notes: reviewNotes };
      }
      return app;
    }));
    
    setReviewModalOpen(false);
    setSelectedInvoice(null);
    setReviewNotes("");
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-primary" />
            Invoice Approvals
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Review and approve invoices before they are finalized and sent to clients.
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 shadow-sm">
          <div className="text-amber-600 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pending Review
          </div>
          <div className="text-4xl font-black text-amber-700">{pendingCount}</div>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 shadow-sm">
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Approved Recently
          </div>
          <div className="text-4xl font-black text-emerald-700">{approvedCount}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by client or invoice number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
            <SearchableSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
                { label: "All Statuses", value: "All" },
                { label: "Pending", value: "Pending" },
                { label: "Approved", value: "Approved" },
                { label: "Rejected", value: "Rejected" }
              ]}
              className="w-[200px] h-[42px] pl-9 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredApprovals.map((invoice) => (
          <div key={invoice.id} className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
            <div className="p-5 border-b border-border/50 bg-muted/10">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-foreground leading-tight">{invoice.invoiceNumber}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{invoice.clientName}</div>
                  </div>
                </div>
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border",
                  invoice.status === "Approved" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                  invoice.status === "Rejected" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                  "bg-amber-500/10 text-amber-600 border-amber-500/20"
                )}>
                  {invoice.status}
                </span>
              </div>
              <div className="text-2xl font-black text-foreground mt-4 mb-1">{invoice.amount}</div>
              <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Submitted {invoice.submittedAt} by {invoice.submittedBy}
              </div>
            </div>

            <div className="p-4 bg-muted/5 flex-grow flex items-center justify-center">
               <button className="px-4 py-2 border border-border/50 bg-background hover:bg-muted text-foreground text-sm font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm w-full justify-center">
                 <Download className="w-4 h-4" />
                 View Draft PDF
               </button>
            </div>

            <div className="p-4 border-t border-border/50 bg-muted/10">
              {invoice.status === "Pending" ? (
                <button 
                  onClick={() => handleOpenReview(invoice)}
                  className="w-full px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-colors shadow-sm"
                >
                  Review Invoice
                </button>
              ) : (
                <div className="text-sm font-medium text-muted-foreground">
                  {invoice.notes ? <span className="italic text-foreground">"{invoice.notes}"</span> : "No remarks left."}
                </div>
              )}
            </div>
          </div>
        ))}
        {filteredApprovals.length === 0 && (
          <div className="col-span-full p-12 text-center text-muted-foreground bg-card border border-dashed border-border/50 rounded-2xl">
            No invoice approvals match your search criteria.
          </div>
        )}
      </div>

      {/* Review Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={(open) => !open && setReviewModalOpen(false)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between p-6 border-b border-border/50">
            <div>
              <h2 className="text-xl font-bold">Review {selectedInvoice?.invoiceNumber}</h2>
              <p className="text-sm text-muted-foreground">{selectedInvoice?.clientName}</p>
            </div>
              <button 
                onClick={() => setReviewModalOpen(false)}
                className="p-2 text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-border/50">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Invoice Amount</div>
                  <div className="text-2xl font-black text-foreground">{selectedInvoice?.amount}</div>
                </div>
                <button className="p-3 bg-card border border-border/50 text-foreground rounded-xl hover:bg-muted/50 transition-colors shadow-sm" title="Download Draft PDF">
                  <Download className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Reviewer Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Please correct the GST percentage."
                  className="w-full h-32 px-4 py-3 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium resize-none"
                />
              </div>
            </div>

            <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button 
                onClick={() => setReviewModalOpen(false)}
                className="px-4 py-2.5 font-bold text-muted-foreground hover:bg-muted/50 rounded-xl transition-colors w-full sm:w-auto text-center"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleAction("Rejected")}
                className="px-6 py-2.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <X className="w-4 h-4" /> Reject
              </button>
              <button 
                onClick={() => handleAction("Approved")}
                className="px-6 py-2.5 bg-emerald-500 text-emerald-50 hover:bg-emerald-600 font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Check className="w-4 h-4" /> Approve
              </button>
            </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
