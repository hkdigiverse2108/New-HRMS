import { useState } from "react";
import { formatCurrency, MOCK_EMPLOYEES } from "./payroll-data";
import { 
  Download, 
  Mail, 
  Printer, 
  ChevronDown, 
  FileText, 
  MessageCircle,
  ShieldCheck,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";

const PAY_PERIODS = [
  { id: "2026-01", label: "January 2026", period: "01 Jan 2026 – 31 Jan 2026" },
  { id: "2026-02", label: "February 2026", period: "01 Feb 2026 – 28 Feb 2026" },
  { id: "2026-03", label: "March 2026", period: "01 Mar 2026 – 31 Mar 2026" },
  { id: "2026-04", label: "April 2026", period: "01 Apr 2026 – 30 Apr 2026" },
  { id: "2026-05", label: "May 2026", period: "01 May 2026 – 31 May 2026" },
  { id: "2026-06", label: "June 2026", period: "01 Jun 2026 – 30 Jun 2026" },
  { id: "2026-07", label: "July 2026", period: "01 Jul 2026 – 31 Jul 2026" },
  { id: "2026-08", label: "August 2026", period: "01 Aug 2026 – 31 Aug 2026" },
];

export function Payslips() {
  const [selectedEmpId, setSelectedEmpId] = useState(MOCK_EMPLOYEES[0]?.id || "");
  const [selectedPeriodId, setSelectedPeriodId] = useState("2026-07");
  const [additionalDeductions, setAdditionalDeductions] = useState<{ id: string; name: string; amount: number }[]>([
    { id: "1", name: "Trip Expense (Office Tour)", amount: 3500 },
  ]);
  const [isAddDeductionOpen, setIsAddDeductionOpen] = useState(false);
  const [newDeduction, setNewDeduction] = useState({ name: "", amount: "" });
  
  const selectedEmp = MOCK_EMPLOYEES.find(e => e.id === selectedEmpId) || MOCK_EMPLOYEES[0];
  const selectedPeriod = PAY_PERIODS.find(p => p.id === selectedPeriodId) || PAY_PERIODS[6];

  if (!selectedEmp || !selectedPeriod) return null;

  const totalEarnings = 105304;
  const standardDeductions = 11708;
  const additionalDeductionsTotal = additionalDeductions.reduce((acc, curr) => acc + curr.amount, 0);
  const totalDeductions = standardDeductions + additionalDeductionsTotal;
  const netPayable = totalEarnings - totalDeductions;

  const handleAddDeduction = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newDeduction.amount);
    if (!newDeduction.name.trim() || isNaN(amt) || amt <= 0) return;
    setAdditionalDeductions(prev => [
      ...prev,
      { id: Date.now().toString(), name: newDeduction.name.trim(), amount: amt }
    ]);
    setNewDeduction({ name: "", amount: "" });
    setIsAddDeductionOpen(false);
  };

  const handleRemoveDeduction = (id: string) => {
    setAdditionalDeductions(prev => prev.filter(d => d.id !== id));
  };

  // Extract initials
  const initials = selectedEmp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 min-w-0">
      
      {/* Top Page Header */}
      <div className="mb-6 sm:mb-8 flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Payslip</h1>
          <p className="mt-1 text-xs sm:text-[14px] text-muted-foreground">Pay period: {selectedPeriod.period}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full xl:w-auto">
          <SearchableSelect 
            value={selectedPeriodId} 
            onChange={setSelectedPeriodId}
            options={PAY_PERIODS.map(p => ({ label: p.label, value: p.id }))}
            placeholder="Select month"
            className="w-full sm:w-[160px] bg-white border border-border/80 text-[13px] font-semibold text-foreground/80 rounded-lg h-[38px] shadow-sm focus:ring-emerald-500"
          />

          <SearchableSelect 
            value={selectedEmpId} 
            onChange={setSelectedEmpId}
            options={MOCK_EMPLOYEES.map(emp => ({ label: emp.name, value: emp.id }))}
            placeholder="Select employee"
            className="w-full sm:w-[220px] bg-white border border-border/80 text-[13px] font-semibold text-foreground/80 rounded-lg h-[38px] shadow-sm focus:ring-emerald-500"
          />
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-white border border-border/80 px-3 sm:px-4 py-2 rounded-lg text-foreground/80 text-xs sm:text-[13px] font-semibold hover:bg-muted/50 transition-colors shadow-sm">
              <FileText className="h-4 w-4" /> PDF
            </button>
            <button className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-white border border-border/80 px-3 sm:px-4 py-2 rounded-lg text-foreground/80 text-xs sm:text-[13px] font-semibold hover:bg-muted/50 transition-colors shadow-sm">
              <Mail className="h-4 w-4" /> Email
            </button>
            <button className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-white border border-border/80 px-3 sm:px-4 py-2 rounded-lg text-foreground/80 text-xs sm:text-[13px] font-semibold hover:bg-muted/50 transition-colors shadow-sm">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </button>
            <button className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-white border border-border/80 px-3 sm:px-4 py-2 rounded-lg text-foreground/80 text-xs sm:text-[13px] font-semibold hover:bg-muted/50 transition-colors shadow-sm">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0c7851] hover:bg-[#00925e] text-white px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-[13px] font-semibold shadow-sm transition-colors">
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
        </div>
      </div>

      {/* Payslip Document */}
      <div className="bg-white rounded-t-3xl rounded-b-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden mx-auto border border-border/40 min-w-0">
        
        {/* Document Header (Green) */}
        <div className="bg-[#0c7851] px-4 sm:px-8 py-4 sm:py-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-white/30 flex items-center justify-center bg-white/10 shrink-0">
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-[22px] font-bold tracking-tight">HK DigiVerse Pvt. Ltd.</h2>
              <p className="text-[11px] sm:text-[12px] text-white/80 mt-0.5">3rd Floor, Cyber Park, Pune 411045 · GSTIN 27AABCH1234K1Z9</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80 mb-0.5">PAYSLIP</p>
            <h3 className="text-xl sm:text-2xl font-bold">{selectedPeriod.label}</h3>
          </div>
        </div>

        {/* Employee Details Grid */}
        <div className="px-4 sm:px-8 py-6 sm:py-8 flex flex-col sm:flex-row gap-4 sm:gap-8 border-b border-border/60">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0c7851] text-white flex items-center justify-center text-lg sm:text-xl font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 sm:gap-y-6 gap-x-4 sm:gap-x-8">
            <div>
              <p className="text-[12px] text-muted-foreground mb-1">Employee Name</p>
              <p className="text-[14px] font-semibold text-foreground">{selectedEmp.name}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-1">Employee ID</p>
              <p className="text-[14px] font-semibold text-foreground">{selectedEmp.empId}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-1">Department</p>
              <p className="text-[14px] font-semibold text-foreground">{selectedEmp.department}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-1">Designation</p>
              <p className="text-[14px] font-semibold text-foreground">{selectedEmp.designation}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-1">Joining Date</p>
              <p className="text-[14px] font-semibold text-foreground">{selectedEmp.joiningDate}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-1">Employment Type</p>
              <p className="text-[14px] font-semibold text-foreground">{selectedEmp.type}</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-1">Bank Account</p>
              <p className="text-[14px] font-semibold text-foreground">HDFC Bank ••••4821</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-1">PAN</p>
              <p className="text-[14px] font-semibold text-foreground">AXQPS4412J</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground mb-1">UAN</p>
              <p className="text-[14px] font-semibold text-foreground">100234556711</p>
            </div>
          </div>
        </div>

        {/* Salary Breakdown */}
        <div className="px-4 sm:px-8 py-6 sm:py-8 grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-16">
          
          {/* Earnings */}
          <div>
            <h4 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 sm:mb-6">Earnings & Allowances</h4>
            <div className="space-y-3 sm:space-y-4 mb-6">
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Basic Salary</span>
                <span className="font-semibold text-foreground">₹36,800</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">HRA</span>
                <span className="font-semibold text-foreground">₹18,400</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Special Allowance</span>
                <span className="font-semibold text-foreground">₹12,880</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Medical Allowance</span>
                <span className="font-semibold text-foreground">₹4,600</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Travel Allowance</span>
                <span className="font-semibold text-foreground">₹4,600</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Internet Allowance</span>
                <span className="font-semibold text-foreground">₹2,760</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Food Allowance</span>
                <span className="font-semibold text-foreground">₹3,680</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Performance Allowance</span>
                <span className="font-semibold text-foreground">₹5,520</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Other Allowance</span>
                <span className="font-semibold text-foreground">₹2,760</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Overtime (6 hrs)</span>
                <span className="font-semibold text-foreground">₹5,304</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Bonus</span>
                <span className="font-semibold text-foreground">₹8,000</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <h4 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 sm:mb-6">Deductions</h4>
            <div className="space-y-3 sm:space-y-4 mb-6">
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Professional Tax</span>
                <span className="font-semibold text-foreground">₹200</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">TDS</span>
                <span className="font-semibold text-foreground">₹5,520</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Provident Fund</span>
                <span className="font-semibold text-foreground">₹1,800</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">ESIC</span>
                <span className="font-semibold text-foreground">₹0</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Health Insurance</span>
                <span className="font-semibold text-foreground">₹650</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Loan Recovery</span>
                <span className="font-semibold text-foreground">₹0</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Advance Salary Recovery</span>
                <span className="font-semibold text-foreground">₹0</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Penalty</span>
                <span className="font-semibold text-foreground">₹0</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Late Coming Deduction</span>
                <span className="font-semibold text-foreground">₹0</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Leave Deduction</span>
                <span className="font-semibold text-foreground">₹3,538</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Other Deduction</span>
                <span className="font-semibold text-foreground">₹0</span>
              </div>

              {/* Custom Additional Deductions (e.g. Office Trip ₹3,500) */}
              <div className="pt-4 border-t border-dashed border-border/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Additional Deductions
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddDeductionOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#0c7851] hover:text-[#00925e] bg-emerald-50 px-2 py-0.5 rounded-md transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Deduction
                  </button>
                </div>

                {additionalDeductions.length > 0 ? (
                  <div className="space-y-2">
                    {additionalDeductions.map((ded) => (
                      <div key={ded.id} className="flex justify-between items-center text-[13px] bg-muted/20 hover:bg-muted/40 p-2 rounded-lg transition-colors group">
                        <span className="text-foreground/90 font-medium">{ded.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-rose-600">-₹{ded.amount.toLocaleString("en-IN")}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDeduction(ded.id)}
                            title="Remove deduction"
                            className="text-muted-foreground hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground italic">No additional deductions applied.</p>
                )}
              </div>
            </div>
          </div>
          
        </div>

        {/* Totals Border Row */}
        <div className="px-4 sm:px-8 pb-6 sm:pb-8 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-16 border-t border-border/40 mt-auto">
          <div className="flex justify-between items-center">
            <span className="text-[14px] font-bold text-foreground">Total Earnings</span>
            <span className="text-[14px] font-bold text-foreground">{formatCurrency(totalEarnings)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[14px] font-bold text-foreground">Total Deductions</span>
            <span className="text-[14px] font-bold text-foreground">{formatCurrency(totalDeductions)}</span>
          </div>
        </div>

        {/* Footer Area: Net Salary (Green) */}
        <div className="mx-3 sm:mx-6 mb-4 sm:mb-6 mt-2 bg-[#0c7851] rounded-2xl p-4 sm:p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <p className="text-[11px] sm:text-[12px] font-semibold text-white/80 uppercase tracking-wider mb-1">NET SALARY PAYABLE</p>
            <p className="text-2xl sm:text-[32px] font-black leading-none">{formatCurrency(netPayable)}</p>
          </div>
          <div className="bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[#0c7851] text-xs sm:text-[13px] font-bold shadow-sm">
            Credited to HDFC Bank ••••4821
          </div>
        </div>

      </div>

      {/* Add Custom Deduction Dialog */}
      <Dialog open={isAddDeductionOpen} onOpenChange={setIsAddDeductionOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-xl font-black tracking-tight">Add Additional Deduction</h2>
              <p className="text-xs text-muted-foreground mt-0.5">e.g. Office Trip Expense, Asset Damage</p>
            </div>
            <DialogClose asChild>
              <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <form onSubmit={handleAddDeduction} className="flex flex-col">
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                  Deduction Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Trip Expense / Tour Deduction"
                  value={newDeduction.name}
                  onChange={(e) => setNewDeduction({ ...newDeduction, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0c7851]/20 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="3500"
                  value={newDeduction.amount}
                  onChange={(e) => setNewDeduction({ ...newDeduction, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0c7851]/20 font-medium"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button
                type="button"
                onClick={() => setIsAddDeductionOpen(false)}
                className="px-4 py-2 bg-background border border-border text-foreground/80 hover:bg-muted font-bold text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#0c7851] hover:bg-[#00925e] text-white font-bold text-sm rounded-xl transition-colors"
              >
                Add Deduction
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
