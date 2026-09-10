import { useState, useMemo } from "react";
import { 
  Search, 
  Calendar, 
  ChevronRight,
  TrendingUp,
  History,
  ShieldCheck,
  Users,
  IndianRupee,
  Activity,
  AlertCircle,
  X,
  Plus,
  CheckCircle2,
  Edit2,
  FileText,
  Download,
  RefreshCcw
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { SearchableSelect } from "@/components/ui/select";
import { MOCK_EMPLOYEES, formatCurrency } from "./payroll-data";

export function SalaryStructure() {
  const [employees, setEmployees] = useState(MOCK_EMPLOYEES);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(employees[0]?.id || null); // Default to Ananya Sharma
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.empId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { items: sortedEmployees, requestSort, sortConfig } = useSortableData(filteredEmployees);

  const selectedEmp = useMemo(() => {
    return selectedEmpId ? employees.find(e => e.id === selectedEmpId) : null;
  }, [selectedEmpId, employees]);

  const earnings = selectedEmp ? selectedEmp.components.filter(c => c.type === "earnings") : [];
  const deductions = selectedEmp ? selectedEmp.components.filter(c => c.type === "deductions") : [];
  
  const handleEditClick = () => {
    if (!selectedEmp) return;
    setEditForm({
      components: JSON.parse(JSON.stringify(selectedEmp.components)),
      reason: "Annual appraisal",
      date: new Date().toISOString().split('T')[0]
    });
    setIsEditing(true);
  };

  const handleSaveRevision = () => {
    if (!selectedEmp || !editForm) return;

    const newGross = editForm.components
      .filter((c: any) => c.type === "earnings")
      .reduce((sum: number, c: any) => sum + Number(c.amount), 0);

    const newHistoryEntry = {
      date: formatDate(editForm.date),
      amount: newGross,
      reason: editForm.reason,
      actionBy: "HR Admin", 
      type: newGross > selectedEmp.grossSalary ? "Increase" : "Promotion"
    };

    setEmployees(prev => prev.map(emp => {
      if (emp.id === selectedEmp.id) {
        return {
          ...emp,
          grossSalary: newGross,
          components: editForm.components.map((c: any) => ({ ...c, amount: Number(c.amount) })),
          history: [newHistoryEntry, ...emp.history]
        };
      }
      return emp;
    }));

    setIsEditing(false);
  };

  const updateEditComponent = (id: string, amount: string) => {
    setEditForm((prev: any) => ({
      ...prev,
      components: prev.components.map((c: any) => c.id === id ? { ...c, amount: amount } : c)
    }));
  };

  // Helper to get initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px] space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight">Salary Structure</h1>
        <p className="mt-1 text-sm text-muted-foreground">Salary is auto-fetched from the employee profile and applied by effective date</p>
      </div>

      {/* Top Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Employees on payroll</p>
            <p className="text-3xl font-black mt-2">8</p>
          </div>
          <div className="rounded-lg bg-emerald-100/50 p-3 text-emerald-600">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total monthly gross</p>
            <p className="text-3xl font-black mt-2">₹4,22,000</p>
          </div>
          <div className="rounded-lg bg-blue-100/50 p-3 text-blue-600">
            <IndianRupee className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Revisions this year</p>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-3xl font-black">5</p>
              <p className="text-xs font-medium text-muted-foreground mb-1">Append-only history</p>
            </div>
          </div>
          <div className="rounded-lg bg-purple-100/50 p-3 text-purple-600">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Pending revisions</p>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-3xl font-black text-amber-950">1</p>
              <p className="text-xs font-medium text-amber-700 mb-1">Awaiting CEO approval</p>
            </div>
          </div>
          <div className="rounded-lg bg-amber-200/50 p-3 text-amber-700">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-6 items-start">
        
        {/* Left Pane - Employee Table */}
        <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-white">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search employee, ID, department..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border-none bg-transparent py-2 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white text-muted-foreground/70 border-b border-border">
                <tr>
                  <SortableHeader label="Employee" sortKey="name" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider" />
                  <SortableHeader label="Department" sortKey="department" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider" />
                  <SortableHeader label="Joining" sortKey="joiningDate" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider" />
                  <SortableHeader label="Type" sortKey="type" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider" />
                  <SortableHeader label="Effective From" sortKey="effectiveDate" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedEmployees.map(emp => {
                  const isSelected = selectedEmpId === emp.id;
                  return (
                    <tr 
                      key={emp.id} 
                      className={cn(
                        "transition-colors cursor-pointer",
                        isSelected ? "bg-emerald-50/60" : "hover:bg-muted/30"
                      )}
                      onClick={() => setSelectedEmpId(emp.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white text-xs font-bold">
                            {getInitials(emp.name)}
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.empId} · {emp.designation}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground/80 font-medium">{emp.department}</td>
                      <td className="px-6 py-4 text-foreground/80 font-medium">
                        {emp.joiningDate.split(' ').slice(0,2).join(' ')}<br/>
                        {emp.joiningDate.split(' ')[2]}
                      </td>
                      <td className="px-6 py-4 text-foreground/80 font-medium">{emp.type}</td>
                      <td className="px-6 py-4 text-foreground/80 font-medium">
                        {emp.effectiveDate.split(' ').slice(0,2).join(' ')}<br/>
                        {emp.effectiveDate.split(' ')[2]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Pane - Salary Details */}
        {selectedEmp && (
          <div className="rounded-2xl border border-border bg-white shadow-sm p-8 sticky top-8">
            <div className="flex items-start justify-between mb-8 pb-6 border-b border-border/60">
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedEmp.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{selectedEmp.empId} · {selectedEmp.designation}</p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button 
                    onClick={handleEditClick}
                    className="flex items-center gap-2 text-sm font-bold bg-white border border-border text-foreground/80 px-4 py-2 rounded-lg hover:bg-muted/50 transition-colors shadow-sm"
                  >
                    <Plus className="h-4 w-4" /> Revise Salary
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-2 text-sm font-bold bg-muted text-muted-foreground px-4 py-2 rounded-lg hover:bg-muted/80 transition-colors shadow-sm"
                  >
                    <X className="h-4 w-4" /> Cancel Revision
                  </button>
                )}
              </div>
            </div>

            {/* Salary Components & Tables */}
            <div className="space-y-8 flex-1 overflow-y-auto pr-2 pb-8">
              
              <div className="rounded-2xl bg-emerald-900 p-6 text-white flex items-center justify-between shadow-md">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Net In-hand Salary</p>
                  <p className="text-3xl font-black mt-1">{formatCurrency(selectedEmp.grossSalary - deductions.reduce((s,c)=>s+c.amount,0))}</p>
                </div>
                <div className="text-right text-sm space-y-1 text-emerald-100 font-medium">
                  <p>Gross: {formatCurrency(selectedEmp.grossSalary)}</p>
                  <p className="text-emerald-300">Deductions: -{formatCurrency(deductions.reduce((s,c)=>s+c.amount,0))}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 font-bold">
                  <TrendingUp className="h-4 w-4 text-emerald-600" /> Earnings
                </h3>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-border">
                      {(isEditing ? editForm.components.filter((c:any) => c.type === "earnings") : earnings).map((c: any) => (
                        <tr key={c.id}>
                          <td className="px-3 py-2.5 font-medium">{c.name}</td>
                          <td className="px-3 py-2.5 text-right">
                            {isEditing ? (
                              <input 
                                type="number" 
                                value={c.amount} 
                                onChange={(e) => updateEditComponent(c.id, e.target.value)}
                                className="w-24 text-right border border-border rounded p-1 outline-none focus:border-emerald-500"
                              />
                            ) : (
                              formatCurrency(c.amount)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/50">
                      <tr>
                        <td className="px-3 py-2.5 font-bold">Total Gross</td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-600">
                          {formatCurrency(isEditing 
                            ? editForm.components.filter((c:any)=>c.type==="earnings").reduce((s:number,c:any)=>s+Number(c.amount),0) 
                            : selectedEmp.grossSalary)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 font-bold">
                  <ShieldCheck className="h-4 w-4 text-rose-600" /> Deductions
                </h3>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-border">
                      {(isEditing ? editForm.components.filter((c:any) => c.type === "deductions") : deductions).map((c: any) => (
                        <tr key={c.id}>
                          <td className="px-3 py-2.5 font-medium">{c.name}</td>
                          <td className="px-3 py-2.5 text-right">
                            {isEditing ? (
                              <input 
                                type="number" 
                                value={c.amount} 
                                onChange={(e) => updateEditComponent(c.id, e.target.value)}
                                className="w-24 text-right border border-border rounded p-1 outline-none focus:border-emerald-500"
                              />
                            ) : (
                              formatCurrency(c.amount)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/50">
                      <tr>
                        <td className="px-3 py-2.5 font-bold">Total Deductions</td>
                        <td className="px-3 py-2.5 text-right font-bold text-rose-600">
                          {formatCurrency(isEditing 
                            ? editForm.components.filter((c:any)=>c.type==="deductions").reduce((s:number,c:any)=>s+Number(c.amount),0) 
                            : deductions.reduce((s,c)=>s+c.amount,0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 font-bold">
                  <History className="h-4 w-4 text-primary" /> Salary Revision History
                </h3>
                {isEditing ? (
                  <div className="rounded-xl border border-border p-5 bg-emerald-50/50 space-y-4">
                    <p className="text-sm font-bold text-emerald-900">Finalize Revision</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground flex gap-1">
                          Effective Date <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          type="date" 
                          required
                          value={editForm.date}
                          onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                          className="mt-1 w-full rounded-md border border-border p-2 text-sm outline-none focus:border-emerald-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground flex gap-1">
                          Reason for change <span className="text-rose-500">*</span>
                        </label>
                        <SearchableSelect 
                          value={editForm.reason}
                          onChange={(val) => setEditForm({ ...editForm, reason: val })}
                          options={[
                            { label: "Annual appraisal", value: "Annual appraisal" },
                            { label: "Promotion", value: "Promotion" },
                            { label: "Mid-year adjustment", value: "Mid-year adjustment" },
                            { label: "Correction", value: "Correction" }
                          ]}
                          placeholder="Select reason..."
                          className="mt-1 w-full h-[38px] px-2 rounded-md border border-border text-sm outline-none focus:border-emerald-500 bg-white"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (!editForm.date || !editForm.reason) {
                          alert("Effective date and Reason are required!");
                          return;
                        }
                        handleSaveRevision();
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg transition-colors mt-2"
                    >
                      Save & Apply Revision
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border p-5">
                    <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-2 before:w-px before:bg-border">
                      {selectedEmp.history.map((hist, i) => (
                        <div key={i} className="relative pl-6">
                          <div className={cn(
                            "absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white",
                            hist.type === "Initial" ? "bg-slate-400" :
                            hist.type === "Promotion" ? "bg-primary" : "bg-emerald-500"
                          )} />
                          <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" /> {hist.date}
                          </p>
                          <p className="mt-1 text-lg font-black">{formatCurrency(hist.amount)}</p>
                          <div className="mt-1.5 inline-flex items-center rounded-md bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                            {hist.type} · {hist.reason}
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">Authorized by {hist.actionBy}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
