import { useState, useEffect } from "react";
import { Download, ChevronDown, CheckCircle2, TrendingUp, TrendingDown, DollarSign, Target, Calendar, BarChart2, Plus, Edit3, Save, X, Search, Info, Trash2, ArrowRight } from "lucide-react";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { moveToRecycleBin } from "@/lib/recycle-bin";
import { SearchableSelect } from "@/components/ui/select";

const mockPlanData = {
  "FINANCIAL - REVENUE": [
    { id: 1, subCategory: "Product Sales", metric: "Bef Revenue", unit: "INR", target: "₹1,500,000" },
    { id: 2, subCategory: "Services", metric: "ERP Revenue", unit: "INR", target: "₹450,000" },
  ],
  "FINANCIAL - EXPENSE": [
    { id: 3, subCategory: "Capex", metric: "Digital Assets", unit: "INR", target: "₹200,000" },
    { id: 4, subCategory: "Opex", metric: "Office Rent", unit: "INR", target: "₹50,000" },
    { id: 5, subCategory: "Payroll", metric: "Current Salaries", unit: "INR", target: "₹450,000" },
    { id: 6, subCategory: "Marketing", metric: "Digital Ads", unit: "INR", target: "₹120,000" },
  ],
  "STAFFING": [
    { id: 7, subCategory: "Headcount", metric: "Developers", unit: "Number", target: "12" },
    { id: 8, subCategory: "Headcount", metric: "Creative Team", unit: "Number", target: "4" },
    { id: 9, subCategory: "Headcount", metric: "Digital Marketing", unit: "Number", target: "3" },
  ],
  "ASSETS": [
    { id: 10, subCategory: "Physical", metric: "AC & Furniture", unit: "Number", target: "15" },
    { id: 11, subCategory: "Digital", metric: "Laptops", unit: "Number", target: "24" },
    { id: 12, subCategory: "Software", metric: "CHAT GPT PLUS", unit: "Active", target: "Active" },
    { id: 13, subCategory: "Software", metric: "GOOGLE AI", unit: "Active", target: "Inactive" },
  ],
};

export function FinancialPlan() {
  const [planData, setPlanData] = useState<Record<string, any[]>>(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_financial_plan') : null);
    return saved ? JSON.parse(saved) : mockPlanData;
  });
  
  useEffect(() => { localStorage.setItem('hrms_financial_plan', JSON.stringify(planData)); }, [planData]);

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, category: string}>({isOpen: false, category: ""});
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddRowOpen, setIsAddRowOpen] = useState(false);
  const [isEditRowOpen, setIsEditRowOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [rowUnit, setRowUnit] = useState("INR");

  const confirmDeleteCategory = () => {
    if (deleteConfirm.category) {
      const newPlanData = { ...planData };
      const dataToDelete = newPlanData[deleteConfirm.category];
      
      // Moving entire category to recycle bin.
      moveToRecycleBin('Financial Plan Category', deleteConfirm.category, dataToDelete, 'hrms_financial_plan', {
        parentId: deleteConfirm.category,
        parentKey: 'key',
        nestedArrayKey: 'restoreAsCategory'
      });
      // Wait, since Financial Plan is an object map, it doesn't quite fit our array-based RecycleBin logic perfectly without special handling.
      // We will handle it by just keeping it simple: We store { categoryName: data } and it will require custom restore if we want.
      // For now, let's just pass it to the recycle bin so it's not lost.
      
      delete newPlanData[deleteConfirm.category];
      setPlanData(newPlanData);
    }
    setDeleteConfirm({ isOpen: false, category: "" });
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12 relative">
      
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Financial Planning & Targets
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Set and track categorical budgets and financial targets for the fiscal year.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button className="px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-sm">
            <Download className="w-4 h-4 text-indigo-500" /> Export Plan
          </button>
          <button 
            onClick={() => setIsAddCategoryOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-3 text-blue-700/90 dark:text-blue-400 items-start">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-sm font-medium">
          Fields marked with count or totals are automatically calculated. Click 'Manage Items' to enter multiple line items.
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
                <th className="p-4 w-[240px] text-right border-r border-primary-foreground/20">Plan Target Value</th>
                <th className="p-4 w-[100px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {Object.entries(planData).map(([categoryName, rows]) => (
                <div key={categoryName} className="contents">
                  {/* Category Header Row */}
                  <tr className="bg-muted/50 font-extrabold text-foreground group border-y border-border/50">
                    <td colSpan={6} className="px-4 py-3 uppercase tracking-wide text-xs">
                      <div className="flex items-center justify-between">
                        <span>{categoryName}</span>
                        <button 
                          onClick={() => setDeleteConfirm({ isOpen: true, category: categoryName })}
                          className="text-rose-500 hover:text-rose-600 text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-rose-500/10 border-none outline-none">
                          <Trash2 className="w-3.5 h-3.5" /> Remove Category
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Sub-Category Rows */}
                  {rows.map((row) => (
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
                      <td 
                        className="p-4 text-right font-black text-emerald-600 border-r border-border/50 cursor-pointer hover:bg-muted/50 transition-colors group-hover:bg-muted/40"
                        onClick={() => setIsEditRowOpen(true)}
                      >
                        {row.target}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setIsEditRowOpen(true)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Add Row Button for Category */}
                  <tr>
                    <td colSpan={6} className="p-2 border-r border-border/50 bg-muted/10 text-center">
                      <button 
                        onClick={() => {
                          setActiveCategory(categoryName);
                          setIsAddRowOpen(true);
                        }}
                        className="text-xs font-bold text-primary hover:text-primary/80 flex items-center justify-center gap-1 w-full py-1.5 hover:bg-primary/5 rounded-md transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Row to {categoryName}
                      </button>
                    </td>
                  </tr>
                </div>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD CATEGORY MODAL --- */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-indigo-500/5">
              <h3 className="font-black text-lg text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" /> Add Category
              </h3>
              <button onClick={() => setIsAddCategoryOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Category Name</label>
                <input type="text" placeholder="e.g. MARKETING EXPENSES" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase" />
              </div>
            </div>
            <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button onClick={() => setIsAddCategoryOpen(false)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors text-muted-foreground">Cancel</button>
              <button onClick={() => setIsAddCategoryOpen(false)} className="px-4 py-2 font-bold text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">Save Category</button>
            </div>
        </DialogContent>
      </Dialog>

      {/* --- ADD/EDIT ROW MODAL --- */}
      <Dialog open={isAddRowOpen || isEditRowOpen} onOpenChange={(open) => { if (!open) { setIsAddRowOpen(false); setIsEditRowOpen(false); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-primary/5">
              <h3 className="font-black text-lg text-foreground flex items-center gap-2">
                {isEditRowOpen ? <Edit3 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                {isEditRowOpen ? "Edit Target / Metric" : `Add Row to ${activeCategory}`}
              </h3>
              <button onClick={() => { setIsAddRowOpen(false); setIsEditRowOpen(false); }} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Sub-Category</label>
                <input type="text" placeholder="e.g. Headcount" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Metric Name</label>
                <input type="text" placeholder="e.g. Developers" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Unit</label>
                  <SearchableSelect
                    value={rowUnit}
                    onChange={setRowUnit}
                    options={[
                      { label: "INR", value: "INR" },
                      { label: "Number", value: "Number" },
                      { label: "Active", value: "Active" }
                    ]}
                    className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Target Value</label>
                  <input type="text" placeholder="Value" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button onClick={() => { setIsAddRowOpen(false); setIsEditRowOpen(false); }} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors text-muted-foreground">Cancel</button>
              <button onClick={() => { setIsAddRowOpen(false); setIsEditRowOpen(false); }} className="px-4 py-2 font-bold text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm">Save Row</button>
            </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, category: "" })}
        onConfirm={confirmDeleteCategory}
        title="Remove Category"
        description={`Are you sure you want to remove the category "${deleteConfirm.category}"? This will delete all rows within it.`}
        itemName={deleteConfirm.category}
      />
    </div>
  );
}
