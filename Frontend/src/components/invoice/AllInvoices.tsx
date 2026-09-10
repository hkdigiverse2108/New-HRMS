import { useState } from "react";
import { Search, Filter, Plus, FileText, Download, MoreVertical, Trash2, Edit2, ReceiptText, ArrowUpRight } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { moveToRecycleBin } from "@/lib/recycle-bin";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";

type InvoiceStatus = "Draft" | "Pending" | "Paid" | "Overdue";

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
}

const MOCK_INVOICES: Invoice[] = [
  { id: "i1", invoiceNumber: "INV-2024-001", clientName: "Acme Corp", amount: "₹ 1,50,000", date: "2024-03-01", dueDate: "2024-03-15", status: "Paid" },
  { id: "i2", invoiceNumber: "INV-2024-002", clientName: "TechFlow Solutions", amount: "₹ 2,75,000", date: "2024-03-10", dueDate: "2024-03-24", status: "Pending" },
  { id: "i3", invoiceNumber: "INV-2024-003", clientName: "Global Logistics", amount: "₹ 85,000", date: "2024-02-15", dueDate: "2024-03-01", status: "Overdue" },
  { id: "i4", invoiceNumber: "INV-2024-004", clientName: "Stark Industries", amount: "₹ 5,00,000", date: "2024-03-20", dueDate: "2024-04-05", status: "Draft" },
];

export function AllInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "All">("All");
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null, name: string}>({isOpen: false, id: null, name: ""});

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || 
                          inv.clientName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { items: sortedInvoices, requestSort, sortConfig } = useSortableData(filteredInvoices);

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case "Paid": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "Pending": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Overdue": return "bg-rose-500/10 text-rose-600 border-rose-500/20";
      case "Draft": return "bg-muted/50 text-muted-foreground border-border/50";
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm.id) {
      setInvoices(invoices.filter(inv => inv.id !== deleteConfirm.id));
    }
    setDeleteConfirm({ isOpen: false, id: null, name: "" });
  };

  const totalAmount = invoices.reduce((acc, curr) => {
    const val = parseInt(curr.amount.replace(/[^0-9]/g, ''));
    return acc + val;
  }, 0);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <ReceiptText className="w-8 h-8 text-primary" />
            All Invoices
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage your billing, track payments, and generate new invoices.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2.5 bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center gap-2 shadow-sm">
            <Download className="w-4 h-4" />
            Export List
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1">Total Invoices</div>
          <div className="text-3xl font-black">{MOCK_INVOICES.length}</div>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 shadow-sm">
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Total Billed</div>
          <div className="text-3xl font-black text-emerald-700">₹ {totalAmount.toLocaleString()}</div>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 shadow-sm">
          <div className="text-amber-600 font-bold text-xs uppercase tracking-wider mb-1">Pending Value</div>
          <div className="text-3xl font-black text-amber-700">₹ 2,75,000</div>
        </div>
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6 shadow-sm">
          <div className="text-rose-600 font-bold text-xs uppercase tracking-wider mb-1">Overdue Value</div>
          <div className="text-3xl font-black text-rose-700">₹ 85,000</div>
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
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <SearchableSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
                { label: "All Statuses", value: "All" },
                { label: "Draft", value: "Draft" },
                { label: "Pending", value: "Pending" },
                { label: "Paid", value: "Paid" },
                { label: "Overdue", value: "Overdue" }
              ]}
              className="w-full sm:w-[200px] pl-9 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader label="Invoice Info" sortKey="invoiceNumber" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Client" sortKey="clientName" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Amount" sortKey="amount" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Dates" sortKey="date" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-foreground">{inv.invoiceNumber}</div>
                        <div className="text-xs text-muted-foreground">ID: {inv.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-sm text-foreground">{inv.clientName}</td>
                  <td className="p-4 font-black text-sm text-foreground">{inv.amount}</td>
                  <td className="p-4">
                    <div className="text-sm font-medium text-foreground">Billed: {inv.date}</div>
                    <div className="text-xs text-muted-foreground">Due: {inv.dueDate}</div>
                  </td>
                  <td className="p-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider border",
                      getStatusColor(inv.status)
                    )}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="View Details">
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Download PDF">
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({ isOpen: true, id: inv.id, name: inv.invoiceNumber })}
                        className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="w-12 h-12 mb-4 text-muted-foreground/30" />
                      <p className="font-bold">No invoices found</p>
                      <p className="text-sm">Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: "" })}
        onConfirm={confirmDelete}
        title="Delete Invoice"
        description={`Are you sure you want to completely delete invoice ${deleteConfirm.name}?`}
        itemName={deleteConfirm.name}
      />
    </div>
  );
}
