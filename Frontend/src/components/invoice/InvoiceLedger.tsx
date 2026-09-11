import { useState } from "react";
import { Landmark, Download, FileText, IndianRupee, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { SearchInput } from "@/components/common/SearchInput";
import { EmptyState } from "@/components/common/EmptyState";

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
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const clients = Array.from(new Set(MOCK_LEDGER.map(entry => entry.clientName)));

  const filteredLedger = MOCK_LEDGER.filter(entry => {
    const matchesSearch = entry.reference.toLowerCase().includes(search.toLowerCase()) ||
                          entry.clientName.toLowerCase().includes(search.toLowerCase());
    const matchesClient = clientFilter === "All" || entry.clientName === clientFilter;
    
    let matchesDate = true;
    if (dateRange.from) {
      const eDate = new Date(entry.date);
      matchesDate = eDate >= dateRange.from;
      if (matchesDate && dateRange.to) {
        const toInclusive = new Date(dateRange.to);
        toInclusive.setHours(23, 59, 59, 999);
        matchesDate = eDate <= toInclusive;
      }
    }

    return matchesSearch && matchesClient && matchesDate;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // sort newest first

  const { items: sortedLedger, requestSort, sortConfig } = useSortableData(filteredLedger, { key: "date", direction: "descending" });

  const totalInvoiced = filteredLedger.filter(e => e.type === "Invoice").reduce((acc, curr) => acc + curr.amount, 0);
  const totalReceived = filteredLedger.filter(e => e.type === "Payment").reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
  const totalOutstanding = totalInvoiced - totalReceived;

  return (
    <div className="w-full space-y-6 sm:space-y-8 animate-in fade-in duration-500 min-w-0">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Landmark className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            Invoice Ledger
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
            Track financial transactions, invoices generated, and payments received.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button className="w-full sm:w-auto px-4 py-2 sm:py-2.5 bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Total Invoiced
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700">₹ {totalInvoiced.toLocaleString()}</div>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Total Received
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-700">₹ {totalReceived.toLocaleString()}</div>
        </div>
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="text-rose-600 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
            <IndianRupee className="w-4 h-4" /> Total Outstanding
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-700">₹ {totalOutstanding.toLocaleString()}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 justify-between items-stretch lg:items-center bg-card border border-border/50 p-3 sm:p-4 rounded-2xl shadow-sm">
        <SearchInput
          placeholder="Search by reference or client..."
          value={search}
          onChange={setSearch}
          className="w-full lg:max-w-md"
        />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <DateRangeFilter
            dateRange={dateRange}
            onChange={setDateRange}
            placeholder="Filter by ledger date"
            className="w-full sm:w-auto"
          />
          <div className="relative w-full sm:w-auto">
            <SearchableSelect
              value={clientFilter}
              onChange={setClientFilter}
              options={[
                { label: "All Clients", value: "All" },
                ...clients.map(c => ({ label: c, value: c }))
              ]}
              className="w-full sm:w-[180px] h-[40px] px-3 bg-background border border-border/50 rounded-xl text-sm font-bold cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-card border border-border/50 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} onSort={requestSort} className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Client" sortKey="clientName" currentSort={sortConfig} onSort={requestSort} className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Reference" sortKey="reference" currentSort={sortConfig} onSort={requestSort} className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Type" sortKey="type" currentSort={sortConfig} onSort={requestSort} className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader align="right" label="Debit (Invoice)" sortKey="amount" currentSort={sortConfig} onSort={requestSort} className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right" />
                <SortableHeader align="right" label="Credit (Payment)" sortKey="amount" currentSort={sortConfig} onSort={requestSort} className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedLedger.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 sm:p-4 font-medium text-xs sm:text-sm text-muted-foreground">{entry.date}</td>
                  <td className="p-3 sm:p-4 font-bold text-xs sm:text-sm text-foreground">{entry.clientName}</td>
                  <td className="p-3 sm:p-4 font-medium text-xs sm:text-sm text-primary">{entry.reference}</td>
                  <td className="p-3 sm:p-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border",
                      entry.type === "Invoice" 
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20" 
                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    )}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="p-3 sm:p-4 text-right font-bold text-xs sm:text-sm text-foreground">
                    {entry.type === "Invoice" ? `₹ ${entry.amount.toLocaleString()}` : "-"}
                  </td>
                  <td className="p-3 sm:p-4 text-right font-bold text-xs sm:text-sm text-emerald-600">
                    {entry.type === "Payment" ? `₹ ${Math.abs(entry.amount).toLocaleString()}` : "-"}
                  </td>
                </tr>
              ))}
              {filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 sm:p-12">
                    <EmptyState
                      icon={Landmark}
                      title="No ledger entries found"
                      description="Try adjusting your search query, client filter, or date range."
                      actionLabel="Reset Filters"
                      onAction={() => {
                        setSearch("");
                        setClientFilter("All");
                        setDateRange({ from: undefined, to: undefined });
                      }}
                    />
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
