import { useState } from "react";
import { FileText, Download, Filter, Info, Eye } from "lucide-react";
import { SearchableSelect } from "@/components/ui/select";

const mockSummaryData = {
  "FINANCIAL - REVENUE": [
    { id: 1, subCategory: "Product Sales", metric: "Bef Revenue", unit: "INR", plan: 150000, actual: 165000 },
    { id: 2, subCategory: "Services", metric: "ERP Revenue", unit: "INR", plan: 50000, actual: 48000 },
  ],
  "FINANCIAL - EXPENSE": [
    { id: 3, subCategory: "Payroll", metric: "Current Salaries", unit: "INR", plan: 85000, actual: 85000 },
    { id: 4, subCategory: "Opex", metric: "Office Rent", unit: "INR", plan: 15000, actual: 14200 },
  ],
  "STAFFING": [
    { id: 5, subCategory: "Headcount", metric: "Developers", unit: "Number", plan: 12, actual: 10 },
    { id: 6, subCategory: "Recruitment", metric: "Open Positions", unit: "Number", plan: 2, actual: 4 },
  ],
};

export function FinancialSummary() {
  const [selectedMonth, setSelectedMonth] = useState("Oct 2023");

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Financial Summary & Actuals
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Compare planned budgets against actual spending and revenue across all categories.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button className="px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-sm">
            <Download className="w-4 h-4 text-indigo-500" /> Export Summary
          </button>
        </div>
      </div>

      <div className="bg-background border border-border/50 rounded-2xl p-3 flex flex-wrap items-center gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground pl-2">
          <Filter className="w-4 h-4" /> View Period:
        </div>
        <SearchableSelect 
          value={selectedMonth}
          onChange={setSelectedMonth}
          options={[
            { label: "Oct 2023", value: "Oct 2023" },
            { label: "Nov 2023", value: "Nov 2023" },
            { label: "Dec 2023", value: "Dec 2023" },
            { label: "Q4 2023 Combined", value: "Q4 2023 Combined" }
          ]}
          className="w-[180px] h-[34px] pl-3 pr-3 bg-background border border-border/50 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
        />
      </div>

      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex gap-3 text-rose-700/90 dark:text-rose-400 items-start">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-sm font-medium">
          Hover or click highlighted values (e.g., Headcount, Assets, OPEX Items) to view live employee listings, vacancies, or planned item breakdowns.
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-primary text-primary-foreground font-extrabold uppercase tracking-widest text-[10px]">
              <tr>
                <th className="p-4 border-r border-primary-foreground/20">Category</th>
                <th className="p-4 border-r border-primary-foreground/20">Sub-Category</th>
                <th className="p-4 border-r border-primary-foreground/20">Metric</th>
                <th className="p-4 border-r border-primary-foreground/20">Unit</th>
                <th className="p-4 w-[180px] text-right border-r border-primary-foreground/20">{selectedMonth} Plan</th>
                <th className="p-4 w-[180px] text-right border-r border-primary-foreground/20">{selectedMonth} Actual</th>
                <th className="p-4 w-[100px] text-center">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {Object.entries(mockSummaryData).map(([categoryName, rows]) => (
                <div key={categoryName} className="contents">
                  {/* Category Header Row */}
                  <tr className="bg-muted/50 font-extrabold text-foreground border-y border-border/50">
                    <td colSpan={7} className="px-4 py-3 uppercase tracking-wide text-xs">
                      {categoryName}
                    </td>
                  </tr>
                  {/* Sub-Category Rows */}
                  {rows.map((row) => {
                    const variance = row.actual - row.plan;
                    const isPositive = variance >= 0;
                    const isExpense = categoryName.includes("Expense");
                    
                    // For expenses, positive variance (actual > plan) is bad (red)
                    // For revenue, positive variance (actual > plan) is good (green)
                    const isGood = isExpense ? !isPositive : isPositive;

                    return (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="p-4 border-r border-border/50 bg-muted/10"></td>
                        <td className="p-4 text-sm font-bold text-foreground border-r border-border/50">
                          {row.subCategory}
                        </td>
                        <td className="p-4 text-sm font-medium text-muted-foreground border-r border-border/50">
                          {row.metric}
                        </td>
                        <td className="p-4 text-xs font-bold text-muted-foreground border-r border-border/50">
                          <span className="px-2 py-0.5 rounded bg-background border border-border/50">{row.unit}</span>
                        </td>
                        <td className="p-4 text-right font-black text-slate-500 border-r border-border/50">
                          ₹{row.plan.toLocaleString('en-IN')}
                        </td>
                        <td className="p-4 text-right font-black text-foreground border-r border-border/50">
                          <button className="flex items-center gap-1.5 justify-end w-full group-hover:text-primary transition-colors cursor-pointer outline-none">
                            ₹{row.actual.toLocaleString('en-IN')}
                            <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>
                        <td className="p-4 text-center font-bold">
                          {variance === 0 ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <span className={`px-2 py-1 rounded text-xs ${isGood ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                              {variance > 0 ? '+' : ''}₹{variance.toLocaleString('en-IN')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </div>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
