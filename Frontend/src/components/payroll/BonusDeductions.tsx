import { useState } from "react";
import { formatCurrency, MOCK_BONUS_DEDUCTIONS } from "./payroll-data";
import { Search, Plus, Filter, Gift, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

export function BonusDeductions() {
  const [activeTab, setActiveTab] = useState<"All" | "Bonuses" | "Deductions">("All");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEntries = MOCK_BONUS_DEDUCTIONS.filter((entry: any) => {
    const matchesTab = 
      activeTab === "All" || 
      (activeTab === "Bonuses" && entry.type === "Bonus") ||
      (activeTab === "Deductions" && entry.type === "Deduction");
      
    const matchesSearch = 
      entry.typeLabel.toLowerCase().includes(searchTerm.toLowerCase()) || 
      entry.appliedTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.ref.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchesTab && matchesSearch;
  });

  const { items: sortedEntries, requestSort, sortConfig } = useSortableData(filteredEntries);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px]">
      
      {/* We keep the header for consistency, though it's scrolled out in the screenshot */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bonus & Deductions</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground/80">Apply to an individual, a department or the entire company</p>
        </div>
        <button className="flex items-center gap-2 bg-card hover:bg-primary text-primary-foreground px-5 py-2 rounded-lg text-[13px] font-bold shadow-sm transition-colors">
          <Plus className="h-4 w-4" /> Add Entry
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0b6c4b] rounded-2xl p-5 shadow-sm relative text-white">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-emerald-50">Total Bonus (July)</p>
            <Gift className="h-4 w-4 text-emerald-100" />
          </div>
          <p className="text-[32px] font-black">₹36,000</p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm relative">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Total Deduction (July)</p>
            <MinusCircle className="h-4 w-4 text-[#0b6c4b]" />
          </div>
          <p className="text-[32px] font-black text-foreground">₹6,000</p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm relative">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Entries This Cycle</p>
          </div>
          <p className="text-[32px] font-black text-foreground">8</p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm relative">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Pending Approval</p>
          </div>
          <p className="text-[32px] font-black text-foreground">1</p>
          <p className="text-[12px] text-muted-foreground mt-1">Requires CEO sign-off</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="inline-flex bg-muted/50 border border-border/60 p-1 rounded-full gap-1">
          {(["All", "Bonuses", "Deductions"] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 text-[13px] font-semibold rounded-full transition-colors",
                activeTab === tab 
                  ? "bg-white text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search entries..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 border border-border/80 rounded-lg text-[13px] w-64 outline-none focus:border-emerald-500 bg-white shadow-sm"
            />
          </div>
          <button className="flex items-center gap-2 border border-border/80 bg-white px-3 py-1.5 rounded-lg text-[13px] font-semibold text-foreground/80 hover:bg-muted/50 shadow-sm transition-colors">
            <Filter className="h-4 w-4" /> Filter
          </button>
        </div>
      </div>

      <div className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60">
                <SortableHeader label="Ref" sortKey="ref" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest" />
                <SortableHeader label="Type" sortKey="typeLabel" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest" />
                <SortableHeader label="Applied To" sortKey="appliedTo" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest" />
                <SortableHeader label="Reason" sortKey="reason" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest" />
                <SortableHeader label="Created By" sortKey="creator" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest" />
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest" />
                <SortableHeader label="Amount" sortKey="amount" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right" />
                <SortableHeader label="Approval" sortKey="state" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sortedEntries.map((entry: any) => (
                <tr key={entry.ref} className="hover:bg-muted/50/50 transition-colors">
                  <td className="py-4 px-5">
                    <span className="text-[13px] font-bold text-foreground">{entry.ref}</span>
                  </td>
                  <td className="py-4 px-5">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold",
                      entry.type === "Bonus" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-foreground/80 border border-border"
                    )}>
                      {entry.typeLabel}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <p className="text-[13px] font-bold text-foreground/80">{entry.appliedTo}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">{entry.appliedToSub}</p>
                  </td>
                  <td className="py-4 px-5">
                    <p className="text-[13px] text-muted-foreground font-medium">{entry.reason}</p>
                  </td>
                  <td className="py-4 px-5">
                    <p className="text-[13px] text-muted-foreground font-medium">{entry.creator}</p>
                  </td>
                  <td className="py-4 px-5">
                    <p className="text-[13px] text-muted-foreground font-medium">{entry.date}</p>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <p className={cn(
                      "text-[14px] font-bold",
                      entry.type === "Bonus" ? "text-foreground" : "text-rose-600"
                    )}>
                      {entry.type === "Bonus" ? "+" : "-"}{formatCurrency(Math.abs(entry.amount))}
                    </p>
                  </td>
                  <td className="py-4 px-5 text-center">
                    <span className={cn(
                      "inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-bold",
                      entry.state === "Approved" 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-white text-foreground/80 border border-border/80"
                    )}>
                      {entry.state}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                    No entries found matching "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <p className="mt-4 text-[11px] text-muted-foreground px-1 font-medium">
        History entries are permanent — reason, creator, date and approval state are retained forever.
      </p>

    </div>
  );
}
