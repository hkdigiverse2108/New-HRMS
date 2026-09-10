import { useState } from "react";
import { Search, Filter, Landmark, Download, FileText, IndianRupee, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

interface LedgerEntry {
  id: string;
  date: string;
  clientName: string;
  reference: string; // Invoice number or Payment ref
  type: "Invoice" | "Payment";
  amount: number;
}

const MOCK_LEDGER: LedgerEntry[] = [
  { id: "L1", date: "2024-03-01", clientName: "Acme Corp", reference: "INV-2024-001", type: "Invoice", amount: 150000 },
  { id: "L2", date: "2024-03-10", clientName: "TechFlow Solutions", reference: "INV-2024-002", type: "Invoice", amount: 275000 },
  { id: "L3", date: "2024-03-12", clientName: "Acme Corp", reference: "PAY-993812", type: "Payment", amount: -150000 },
  { id: "L4", date: "2024-03-15", clientName: "TechFlow Solutions", reference: "PAY-993845", type: "Payment", amount: -100000 },
  { id: "L5", date: "2024-03-20", clientName: "Stark Industries", reference: "INV-2024-004", type: "Invoice", amount: 500000 },
];

export function InvoiceLedger() {
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("All");

  const clients = Array.from(new Set(MOCK_LEDGER.map(entry => entry.clientName)));

  const filteredLedger = MOCK_LEDGER.filter(entry => {
    const matchesSearch = entry.reference.toLowerCase().includes(search.toLowerCase());
    const matchesClient = clientFilter === "All" || entry.clientName === clientFilter;
    return matchesSearch && matchesClient;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // sort newest first

  const { items: sortedLedger, requestSort, sortConfig } = useSortableData(filteredLedger, { key: "date", direction: "descending" });

  const totalInvoiced = filteredLedger.filter(e => e.type === "Invoice").reduce((acc, curr) => acc + curr.amount, 0);
  const totalReceived = filteredLedger.filter(e => e.type === "Payment").reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
  const totalOutstanding = totalInvoiced - totalReceived;

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Landmark className="w-8 h-8 text-primary" />
            Invoice Ledger
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Track financial transactions, invoices generated, and payments received.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2.5 bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center gap-2 shadow-sm">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 shadow-sm">
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Total Invoiced
          </div>
          <div className="text-3xl font-black text-emerald-700">₹ {totalInvoiced.toLocaleString()}</div>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 shadow-sm">
          <div className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Total Received
          </div>
          <div className="text-3xl font-black text-blue-700">₹ {totalReceived.toLocaleString()}</div>
        </div>
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6 shadow-sm">
          <div className="text-rose-600 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
            <IndianRupee className="w-4 h-4" /> Total Outstanding
          </div>
          <div className="text-3xl font-black text-rose-700">₹ {totalOutstanding.toLocaleString()}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by reference number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <SearchableSelect
              value={clientFilter}
              onChange={setClientFilter}
              options={[
                { label: "All Clients", value: "All" },
                ...clients.map(c => ({ label: c, value: c }))
              ]}
              className="w-full sm:w-[200px] pl-9 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Client" sortKey="clientName" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Reference" sortKey="reference" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Type" sortKey="type" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader align="right" label="Debit (Invoice)" sortKey="amount" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right" />
                <SortableHeader align="right" label="Credit (Payment)" sortKey="amount" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedLedger.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-bold text-sm text-foreground">{entry.date}</td>
                  <td className="p-4 font-bold text-sm text-foreground">{entry.clientName}</td>
                  <td className="p-4 text-sm font-medium text-muted-foreground">{entry.reference}</td>
                  <td className="p-4">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border",
                      entry.type === "Invoice" 
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20" 
                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    )}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-black text-foreground text-right">
                    {entry.type === "Invoice" ? `₹ ${entry.amount.toLocaleString()}` : "-"}
                  </td>
                  <td className="p-4 text-sm font-black text-emerald-600 text-right">
                    {entry.type === "Payment" ? `₹ ${Math.abs(entry.amount).toLocaleString()}` : "-"}
                  </td>
                </tr>
              ))}
              {filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Landmark className="w-12 h-12 mb-4 text-muted-foreground/30" />
                      <p className="font-bold">No ledger entries found</p>
                      <p className="text-sm">Try adjusting your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
