import { useState } from "react";
import { formatCurrency, MOCK_PAYROLL_RUNS, type PayrollRun } from "./payroll-data";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Users, Gift, MinusCircle, PlayCircle, CheckCircle2, Lock, FileSpreadsheet, FileText, Send, Search, Filter } from "lucide-react";
import { SearchableSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PayrollStage = "not_generated" | "generated" | "approved" | "locked";

export function PayrollProcessing() {
  const [searchTerm, setSearchTerm] = useState("");
  const [month, setMonth] = useState("July");
  const [year, setYear] = useState("2026");
  const [stage, setStage] = useState<PayrollStage>("not_generated");

  const filteredRuns = (MOCK_PAYROLL_RUNS as any[]).filter(r => 
    r.employee.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.empId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { items: sortedRuns, requestSort, sortConfig } = useSortableData(filteredRuns);

  const handleGenerate = () => {
    setStage("generated");
    toast.success(`Payroll generated for ${month} ${year} — ${MOCK_PAYROLL_RUNS.length} employees processed.`);
  };

  const handleApprove = () => {
    setStage("approved");
    toast.success("Payroll approved. Ready to lock and disburse.");
  };

  const handleLock = () => {
    setStage("locked");
    toast.success("Payroll locked. No further edits allowed.");
  };

  const handleExcelExport = () => {
    if (stage === "not_generated") {
      toast.error("Generate payroll first before exporting.");
      return;
    }
    toast.success("Payroll exported to Excel (Mock Mode).");
  };

  const handlePdfExport = () => {
    if (stage === "not_generated") {
      toast.error("Generate payroll first before exporting.");
      return;
    }
    toast.success("Payroll exported to PDF (Mock Mode).");
  };

  const handleSendPayslips = () => {
    if (stage === "not_generated") {
      toast.error("Generate and approve payroll first before sending payslips.");
      return;
    }
    if (stage === "generated") {
      toast.error("Approve payroll before sending payslips.");
      return;
    }
    toast.success(`Payslips sent to ${MOCK_PAYROLL_RUNS.length} employees via email (Mock Mode).`);
  };

  const statusLabel: Record<PayrollStage, string> = {
    not_generated: "Not Generated",
    generated: "Generated",
    approved: "Approved",
    locked: "Locked 🔒",
  };

  const statusColor: Record<PayrollStage, string> = {
    not_generated: "bg-muted/50 text-foreground/80 border border-border",
    generated: "bg-amber-100 text-amber-700 border border-amber-200",
    approved: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    locked: "bg-slate-100 text-slate-600 border border-slate-200",
  };

  const processedCount = stage === "not_generated" ? 0 : MOCK_PAYROLL_RUNS.length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px]">
      
      {/* Header */}
      <div className="mb-8 flex items-end justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll Processing</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">{month} {year} · Attendance, leave, OT, bonuses and recoveries fetched automatically</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <SearchableSelect
              value={month}
              onChange={(val) => { setMonth(val); setStage("not_generated"); }}
              options={[
                { label: "July", value: "July" },
                { label: "August", value: "August" }
              ]}
              className="w-[120px] bg-white border border-border/80 rounded-lg text-[13px] font-semibold text-foreground/80 focus:border-emerald-500 shadow-sm"
            />
          </div>
          <div className="relative">
            <SearchableSelect
              value={year}
              onChange={(val) => { setYear(val); setStage("not_generated"); }}
              options={[
                { label: "2026", value: "2026" },
                { label: "2027", value: "2027" }
              ]}
              className="w-[100px] bg-white border border-border/80 rounded-lg text-[13px] font-semibold text-foreground/80 focus:border-emerald-500 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0b6c4b] rounded-2xl p-5 shadow-sm relative text-white">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-emerald-50">Company Payroll Expense</p>
            <span className="text-[14px] font-bold text-emerald-100">₹</span>
          </div>
          <p className="text-[32px] font-black">₹4,69,330</p>
          <p className="text-[12px] text-emerald-100 mt-1">Gross + OT + bonus</p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm relative">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Employees Processed</p>
            <Users className="h-4 w-4 text-[#0b6c4b]" />
          </div>
          <p className="text-[32px] font-black text-foreground">{processedCount}</p>
          <p className="text-[12px] text-muted-foreground mt-1">{MOCK_PAYROLL_RUNS.length} eligible</p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm relative">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Total Bonus</p>
            <Gift className="h-4 w-4 text-[#0b6c4b]" />
          </div>
          <p className="text-[32px] font-black text-foreground">₹31,000</p>
        </div>
        <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm relative">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[12px] font-medium text-muted-foreground">Total Deduction</p>
            <MinusCircle className="h-4 w-4 text-[#0b6c4b]" />
          </div>
          <p className="text-[32px] font-black text-foreground">₹52,349</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white border border-border/60 p-2 rounded-2xl shadow-sm">
        <div className={cn("px-4 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap ml-2", statusColor[stage])}>
          Status: {statusLabel[stage]}
        </div>
        <div className="w-px h-6 bg-border/60 mx-1 hidden sm:block"></div>

        {/* Generate — always available unless locked */}
        <button
          onClick={handleGenerate}
          disabled={stage === "locked"}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold shadow-sm transition-colors whitespace-nowrap",
            stage === "locked"
              ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
              : "bg-primary hover:bg-[#00925e] text-primary-foreground"
          )}
        >
          <PlayCircle className="h-4 w-4" /> {stage === "generated" || stage === "approved" ? "Re-Generate" : "Generate Payroll"}
        </button>

        {/* Approve — enabled only after generated */}
        <button
          onClick={handleApprove}
          disabled={stage !== "generated"}
          className={cn(
            "flex items-center gap-2 border px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap",
            stage === "generated"
              ? "bg-white border-emerald-400 text-emerald-700 hover:bg-emerald-50"
              : "bg-white border-border/60 text-muted-foreground opacity-50 cursor-not-allowed"
          )}
        >
          <CheckCircle2 className="h-4 w-4" /> Approve Payroll
        </button>

        {/* Lock — enabled only after approved */}
        <button
          onClick={handleLock}
          disabled={stage !== "approved"}
          className={cn(
            "flex items-center gap-2 border px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap",
            stage === "approved"
              ? "bg-white border-slate-400 text-slate-700 hover:bg-slate-50"
              : "bg-white border-border/60 text-muted-foreground opacity-50 cursor-not-allowed"
          )}
        >
          <Lock className="h-4 w-4" /> Lock Payroll
        </button>

        <button
          onClick={handleExcelExport}
          className="flex items-center gap-2 bg-white border border-border/80 px-4 py-2 rounded-lg text-foreground/80 text-[13px] font-semibold hover:bg-muted/50 transition-colors shadow-sm whitespace-nowrap"
        >
          <FileSpreadsheet className="h-4 w-4" /> Export Excel
        </button>
        <button
          onClick={handlePdfExport}
          className="flex items-center gap-2 bg-white border border-border/80 px-4 py-2 rounded-lg text-foreground/80 text-[13px] font-semibold hover:bg-muted/50 transition-colors shadow-sm whitespace-nowrap"
        >
          <FileText className="h-4 w-4" /> Export PDF
        </button>
        <button
          onClick={handleSendPayslips}
          className="flex items-center gap-2 bg-white border border-border/80 px-4 py-2 rounded-lg text-foreground/80 text-[13px] font-semibold hover:bg-muted/50 transition-colors shadow-sm whitespace-nowrap"
        >
          <Send className="h-4 w-4" /> Send Payslips
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-border/60 bg-white flex justify-between items-center">
          <div>
            <h2 className="text-[15px] font-bold text-foreground">Payroll Preview</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Computed from effective salary as on 01 {month} {year}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search employees..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-border/80 rounded-lg text-[13px] w-64 outline-none focus:border-emerald-500 bg-muted/50 focus:bg-white transition-colors"
              />
            </div>
            <button className="flex items-center gap-2 border border-border/80 bg-white px-3 py-1.5 rounded-lg text-[13px] font-semibold text-foreground/80 hover:bg-muted/50 transition-colors">
              <Filter className="h-4 w-4" /> Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/50/50">
                <SortableHeader label="Employee" sortKey="employee" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest" />
                <SortableHeader label="Working" sortKey="working" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center" />
                <SortableHeader label="Present" sortKey="present" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center" />
                <SortableHeader label="Absent" sortKey="absent" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center" />
                <SortableHeader label="Leave" sortKey="leave" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center" />
                <SortableHeader label="OT Hrs" sortKey="otHrs" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center" />
                <SortableHeader label="Gross" sortKey="gross" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right" />
                <SortableHeader label="Deduction" sortKey="deduction" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right" />
                <SortableHeader label="Net Salary" sortKey="netSalary" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right" />
                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="py-4 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sortedRuns.map((run) => (
                <tr key={run.id} className="hover:bg-muted/50/50 transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#0b6c4b] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                        {run.employee.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-foreground leading-tight">{run.employee}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{run.empId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-center text-[13px] text-foreground/80">{run.working}</td>
                  <td className="py-4 px-5 text-center text-[13px] text-foreground/80">{run.present}</td>
                  <td className="py-4 px-5 text-center text-[13px] text-foreground/80">{run.absent}</td>
                  <td className="py-4 px-5 text-center text-[13px] text-foreground/80">{run.leave}</td>
                  <td className="py-4 px-5 text-center text-[13px] text-foreground/80">{run.otHrs}</td>
                  <td className="py-4 px-5 text-right text-[13px] font-medium text-foreground/80">{formatCurrency(run.gross)}</td>
                  <td className="py-4 px-5 text-right text-[13px] font-medium text-rose-500">-{formatCurrency(run.deduction)}</td>
                  <td className="py-4 px-5 text-right text-[14px] font-bold text-foreground">{formatCurrency(run.netSalary)}</td>
                  <td className="py-4 px-5 text-center">
                    <span className={cn(
                      "inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide",
                      stage === "locked" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                      stage === "approved" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                      stage === "generated" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                      "bg-white text-foreground/80 border border-border/80"
                    )}>
                      {stage === "locked" ? "Locked" : stage === "approved" ? "Approved" : stage === "generated" ? "Generated" : run.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRuns.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground text-sm">
                    No employees found matching "{searchTerm}"
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

