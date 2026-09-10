import { useState } from "react";
import { X, Search, AlertTriangle, MessageSquareWarning, ThumbsUp, ShieldAlert, Plus, IndianRupee, CheckCircle2, XCircle, Filter, FileText, ChevronDown, Trophy } from "lucide-react";
import { DialogClose, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { EMPLOYEES } from "@/components/employees/employee-data";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { useSettingsContext } from "../payroll/SettingsContext";
import { SearchableSelect } from "@/components/ui/select";

type RecordType = "Penalty" | "Warning";
type RecordStatus = "Active" | "Resolved" | "Waived";

interface DisciplinaryRecord {
  id: string;
  employee: {
    name: string;
    role: string;
    avatar: string;
  };
  type: RecordType;
  date: string;
  description: string;
  status: RecordStatus;
  amount: number | null;
  impactPayroll: boolean;
  resolutionReason?: string;
}

const MOCK_RECORDS: DisciplinaryRecord[] = [
  {
    id: "REC-001",
    employee: { name: "Sarah Connor", role: "Frontend Developer", avatar: "https://i.pravatar.cc/150?u=sarah" },
    type: "Penalty",
    date: "Aug 10, 2026",
    description: "Repeated late arrivals (more than 3 times this month) without prior notice.",
    status: "Active",
    amount: 50,
    impactPayroll: true,
  },
  {
    id: "REC-002",
    employee: { name: "John Smith", role: "Backend Developer", avatar: "https://i.pravatar.cc/150?u=john" },
    type: "Warning",
    date: "Aug 05, 2026",
    description: "Missed mandatory security training deadline.",
    status: "Resolved",
    amount: null,
    impactPayroll: false,
  },
  {
    id: "REC-004",
    employee: { name: "Michael Chang", role: "DevOps Engineer", avatar: "https://i.pravatar.cc/150?u=michael" },
    type: "Penalty",
    date: "Jul 15, 2026",
    description: "Unauthorized access to production database.",
    status: "Waived",
    amount: 150,
    impactPayroll: true,
  }
];

export function Penalties() {
  const { penaltyTemplates } = useSettingsContext();
  const [records, setRecords] = useState<DisciplinaryRecord[]>(MOCK_RECORDS);
  const [activeTab, setActiveTab] = useState<"All" | RecordType>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [leaderboardSort, setLeaderboardSort] = useState<"violations" | "amount">("violations");
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // New Record State
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newType, setNewType] = useState<RecordType>("Penalty");
  const [newEmpName, setNewEmpName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newImpact, setNewImpact] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState("Custom (Manual Entry)");

  // Update Status State
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<"Waived" | "Resolved">("Resolved");
  const [updateRecordId, setUpdateRecordId] = useState<string | null>(null);
  const [updateReason, setUpdateReason] = useState("");

  // Edit Amount State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const filteredRecords = records.filter(rec => {
    const matchesTab = activeTab === "All" || rec.type === activeTab;
    const matchesSearch = rec.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          rec.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const openUpdateDialog = (id: string, action: "Waived" | "Resolved") => {
    setUpdateRecordId(id);
    setUpdateAction(action);
    setUpdateReason("");
    setIsUpdateOpen(true);
  };

  const handleConfirmUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateReason.trim() || !updateRecordId) {
      toast.error("Please provide a reason.");
      return;
    }
    
    setRecords(records.map(rec => rec.id === updateRecordId ? { 
      ...rec, 
      status: updateAction,
      resolutionReason: updateReason 
    } : rec));
    
    toast.success(`Record marked as ${updateAction}`);
    setIsUpdateOpen(false);
  };

  const openEditDialog = (record: DisciplinaryRecord) => {
    setEditRecordId(record.id);
    setEditAmount(record.amount?.toString() || "0");
    setIsEditOpen(true);
  };

  const handleEditAmount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecordId) return;

    setRecords(records.map(rec => rec.id === editRecordId ? {
      ...rec,
      amount: parseFloat(editAmount) || 0
    } : rec));

    toast.success("Penalty amount updated");
    setIsEditOpen(false);
  };


  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim() || !newDesc.trim()) {
      toast.error("Please fill in required fields.");
      return;
    }

    const newRecord: DisciplinaryRecord = {
      id: `REC-${Math.floor(Math.random() * 1000)}`,
      employee: {
        name: newEmpName,
        role: "Team Member",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newEmpName)}&background=random`
      },
      type: newType,
      date: formatDate(new Date()),
      description: newDesc,
      status: "Active",
      amount: newType === "Penalty" ? parseFloat(newAmount) || 0 : null,
      impactPayroll: newType === "Penalty" ? newImpact : false,
    };

    setRecords([newRecord, ...records]);
    setIsNewOpen(false);
    toast.success(`${newType} record created for ${newEmpName}`);
    
    // Reset
    setNewEmpName("");
    setNewDesc("");
    setNewAmount("");
    setNewType("Penalty");
    setNewImpact(true);
    setSelectedTemplate("Custom (Manual Entry)");
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedTemplate(val);
    const template = penaltyTemplates.find(p => p.label === val);
    if (template && val !== "Custom (Manual Entry)") {
      setNewType(template.type as RecordType);
      setNewDesc(template.description);
      setNewAmount(template.amount);
    }
  };

  const activePenaltiesCount = records.filter(r => r.type === "Penalty" && r.status === "Active").length;
  const totalDeductions = records.filter(r => r.type === "Penalty" && r.status === "Active" && r.impactPayroll).reduce((sum, r) => sum + (r.amount || 0), 0);

  // Group by employee for KPIs
  const employeeStats = records.reduce((acc, rec) => {
    if (!acc[rec.employee.name]) {
      acc[rec.employee.name] = { violations: 0, penaltyAmount: 0 };
    }
    acc[rec.employee.name]!.violations += 1;
    if (rec.type === "Penalty" && rec.amount) {
      acc[rec.employee.name]!.penaltyAmount += rec.amount;
    }
    return acc;
  }, {} as Record<string, { violations: number, penaltyAmount: number }>);

  let maxViolations = 0;
  let maxViolationsEmp = "None";
  let maxPenaltyAmount = 0;
  let maxPenaltyEmp = "None";

  Object.entries(employeeStats).forEach(([empName, stats]) => {
    if (stats.violations > maxViolations) {
      maxViolations = stats.violations;
      maxViolationsEmp = empName;
    }
    if (stats.penaltyAmount > maxPenaltyAmount) {
      maxPenaltyAmount = stats.penaltyAmount;
      maxPenaltyEmp = empName;
    }
  });

  const leaderboardData = Object.entries(employeeStats).map(([name, stats]) => {
    const record = records.find(r => r.employee.name === name);
    return {
      name,
      role: record?.employee.role || "Team Member",
      avatar: record?.employee.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
      violations: stats.violations,
      penaltyAmount: stats.penaltyAmount
    };
  }).sort((a, b) => {
    if (leaderboardSort === "violations") {
      return b.violations - a.violations || b.penaltyAmount - a.penaltyAmount;
    } else {
      return b.penaltyAmount - a.penaltyAmount || b.violations - a.violations;
    }
  });

  return (
    <div className="space-y-5 h-[calc(100vh-4rem)] flex flex-col overflow-hidden pb-0">
      {/* Header/Stats */}
      <div className="shrink-0 bg-card border border-border rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <ShieldAlert className="w-64 h-64 text-foreground" />
        </div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight mb-2">Penalties & Warnings</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Track disciplinary actions and warnings. Active penalties marked for payroll will automatically be deducted in the next cycle.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-center gap-4 min-w-[160px]">
              <div className="w-10 h-10 bg-background rounded-xl shadow-sm flex items-center justify-center text-destructive shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-destructive/70 uppercase tracking-wider mb-0.5">Active</p>
                <p className="text-2xl font-black text-destructive leading-none">{activePenaltiesCount}</p>
              </div>
            </div>
            
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 min-w-[160px]">
              <div className="w-10 h-10 bg-background rounded-xl shadow-sm flex items-center justify-center text-primary shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary/70 uppercase tracking-wider mb-0.5">Payroll Impact</p>
                <p className="text-2xl font-black text-primary leading-none">₹{totalDeductions}</p>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 min-w-[160px] flex-1 sm:flex-none">
              <div className="w-10 h-10 bg-background rounded-xl shadow-sm flex items-center justify-center text-amber-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-600/80 uppercase tracking-wider mb-0.5 truncate" title={maxViolationsEmp}>{maxViolationsEmp}</p>
                <p className="text-lg font-black text-amber-700 leading-none truncate">{maxViolations} Violations</p>
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-4 min-w-[160px] flex-1 sm:flex-none">
              <div className="w-10 h-10 bg-background rounded-xl shadow-sm flex items-center justify-center text-rose-600 shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-rose-600/80 uppercase tracking-wider mb-0.5 truncate" title={maxPenaltyEmp}>{maxPenaltyEmp}</p>
                <p className="text-lg font-black text-rose-700 leading-none truncate">₹{maxPenaltyAmount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-6">
        {/* Left Column: Records List */}
        <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
          {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            {(["All", "Penalty", "Warning"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 border",
                  activeTab === tab 
                    ? "bg-primary text-primary-foreground border-primary shadow-md" 
                    : "bg-background text-muted-foreground border-border hover:border-border hover:bg-muted"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search records..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            
            <button 
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className={cn("px-4 py-2.5 rounded-xl border border-border bg-white text-foreground hover:bg-muted font-bold text-sm transition-all flex items-center gap-2 shadow-sm shrink-0", 
                showLeaderboard && "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100")}
            >
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Leaderboard</span>
            </button>
            
            <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
              <DialogTrigger asChild>
                <button className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Record</span>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
                <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Add Disciplinary Record</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
                <form onSubmit={handleCreateRecord} className="flex flex-col max-h-[70vh]">
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Pre-defined Template</label>
                    <SearchableSelect 
                      value={selectedTemplate}
                      onChange={(val) => {
                        const fakeEvent = { target: { value: val } } as React.ChangeEvent<HTMLSelectElement>;
                        handleTemplateChange(fakeEvent);
                      }}
                      options={penaltyTemplates.map(t => ({ label: t.label, value: t.label }))}
                      className="w-full h-[38px] px-3 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Record Type</label>
                    <SearchableSelect 
                      value={newType}
                      onChange={(val) => setNewType(val as RecordType)}
                      options={[
                        { label: "Penalty (Financial impact possible)", value: "Penalty" },
                        { label: "Warning (Written notice)", value: "Warning" }
                      ]}
                      className="w-full h-[38px] px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Employee Name</label>
                    <div className="relative">
                      <SearchableSelect 
                        value={newEmpName}
                        onChange={setNewEmpName}
                        options={EMPLOYEES.map(emp => ({ label: emp.name, value: emp.name }))}
                        placeholder="Select Employee"
                        className="w-full h-[38px] px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                  
                  {newType === "Penalty" && (
                    <div className="flex gap-4">
                      <div className="space-y-2 flex-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Deduction Amount (₹)</label>
                        <input 
                          type="number" 
                          placeholder="e.g. 50"
                          value={newAmount}
                          onChange={e => setNewAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-2 flex-1 flex flex-col justify-end pb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={newImpact}
                            onChange={e => setNewImpact(e.target.checked)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-bold text-foreground/80">Affect Payroll</span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Description / Reason</label>
                    <textarea 
                      required
                      rows={3}
                      placeholder="Provide details..."
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>
                  </div>
<div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                    <button 
                      type="button" 
                      onClick={() => setIsNewOpen(false)}
                      className="px-4 py-2 bg-background border border-border text-foreground/80 hover:bg-muted font-bold text-sm rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors"
                    >
                      Save Record
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
              <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
                <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">{updateAction === "Waived" ? "Waive Penalty" : "Resolve Issue"}</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
                <form onSubmit={handleConfirmUpdate} className="flex flex-col max-h-[70vh]">
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">
                      Reason for {updateAction === "Waived" ? "Waiving" : "Resolving"}
                    </label>
                    <textarea 
                      required
                      rows={3}
                      placeholder={`Why is this being ${updateAction.toLowerCase()}?`}
                      value={updateReason}
                      onChange={e => setUpdateReason(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>
                  </div>
<div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                    <button 
                      type="button" 
                      onClick={() => setIsUpdateOpen(false)}
                      className="px-4 py-2 bg-background border border-border text-foreground/80 hover:bg-muted font-bold text-sm rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors"
                    >
                      Confirm
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
                <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Edit Penalty Amount</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
                <form onSubmit={handleEditAmount} className="flex flex-col max-h-[70vh]">
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">
                      New Amount (₹)
                    </label>
                    <input 
                      type="number"
                      required
                      min="0"
                      value={editAmount}
                      onChange={e => setEditAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  </div>
<div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                    <button 
                      type="button" 
                      onClick={() => setIsEditOpen(false)}
                      className="px-4 py-2 bg-background border border-border text-foreground/80 hover:bg-muted font-bold text-sm rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors"
                    >
                      Update
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {filteredRecords.length > 0 ? filteredRecords.map(record => (
              <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/50 hover:border-border bg-card transition-all shadow-sm hover:shadow-md group">
                <div className="flex items-start gap-4 flex-1">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                    record.type === "Penalty" ? "bg-destructive/10 text-destructive border-destructive/20" :
                    "bg-amber-50 text-amber-500 border-amber-100"
                  )}>
                    {record.type === "Penalty" ? <AlertTriangle className="w-5 h-5" /> : 
                     <MessageSquareWarning className="w-5 h-5" />}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-foreground">{record.employee.name}</span>
                      <span className="text-border">•</span>
                      <span className="text-xs font-medium text-muted-foreground">{record.date}</span>
                    </div>
                    <p className="text-sm text-foreground/80 mb-2">{record.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider",
                        record.type === "Penalty" ? "bg-destructive/10 text-destructive" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {record.type}
                      </span>
                      
                      {record.type === "Penalty" && record.amount !== null && (
                        <span className="text-xs font-bold text-foreground/80 bg-muted px-2 py-0.5 rounded-md">
                          Amount: ₹{record.amount}
                        </span>
                      )}
                      
                      {record.impactPayroll && record.status === "Active" && (
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Affects Payroll
                        </span>
                      )}
                    </div>
                    
                    {record.resolutionReason && (
                      <div className="mt-3 bg-muted/50 border border-border/50 rounded-lg p-3">
                        <p className="text-xs font-bold text-foreground/80 mb-1">Reason for {record.status}:</p>
                        <p className="text-sm text-foreground/80">{record.resolutionReason}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 pt-3 sm:pt-0 border-t border-border/50 sm:border-0 mt-3 sm:mt-0">
                  <div className={cn(
                    "text-xs font-bold px-3 py-1 rounded-full border",
                    record.status === "Active" ? "bg-primary text-primary-foreground border-primary" :
                    record.status === "Resolved" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                    record.status === "Waived" ? "bg-muted text-muted-foreground border-border" :
                    "bg-muted/50 text-muted-foreground border-border"
                  )}>
                    {record.status}
                  </div>
                  
                  {record.status === "Active" && (record.type === "Penalty" || record.type === "Warning") && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {record.type === "Penalty" && (
                        <button 
                          onClick={() => openEditDialog(record)}
                          className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      <button 
                        onClick={() => openUpdateDialog(record.id, "Waived")}
                        className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                      >
                        Waive
                      </button>
                      <button 
                        onClick={() => openUpdateDialog(record.id, "Resolved")}
                        className="px-3 py-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/20 rounded-2xl border border-border/50 border-dashed">
                <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-border/50 text-muted-foreground">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground/80 mb-1">No records found</h3>
                <p className="text-muted-foreground text-sm max-w-sm">No disciplinary actions or warnings match your current filters.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Leaderboard Card */}
      {showLeaderboard && (
        <div className="w-full lg:w-80 bg-card border border-border rounded-3xl shadow-sm flex flex-col overflow-hidden shrink-0 animate-in slide-in-from-right duration-300">
        <div className="p-5 border-b border-border bg-muted/30 shrink-0 text-left">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-black text-foreground tracking-tight">Disciplinary Leaderboard</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Top infractions and penalty totals</p>
          
          {/* Sorting Switcher */}
          <div className="flex p-0.5 bg-muted rounded-xl border border-border/40 mt-3.5">
            <button 
              onClick={() => setLeaderboardSort("violations")}
              className={cn("flex-1 py-1 text-[10px] font-bold rounded-lg transition-all", 
                leaderboardSort === "violations" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              Violations
            </button>
            <button 
              onClick={() => setLeaderboardSort("amount")}
              className={cn("flex-1 py-1 text-[10px] font-bold rounded-lg transition-all", 
                leaderboardSort === "amount" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              Penalty Amt
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-left">
          {leaderboardData.length > 0 ? leaderboardData.map((item, idx) => {
            const rank = idx + 1;
            return (
              <div key={item.name} className="flex items-center justify-between gap-3 p-2 hover:bg-muted/30 rounded-2xl transition-all border border-transparent hover:border-border/40">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank Badge */}
                  <span className={cn("grid h-6 w-6 place-items-center rounded-lg text-[10px] font-black border",
                    rank === 1 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                    rank === 2 ? "bg-slate-400/10 text-slate-500 border-slate-400/20" :
                    rank === 3 ? "bg-orange-700/10 text-orange-700 border-orange-700/20" :
                    "bg-muted text-muted-foreground border-border/50"
                  )}>
                    {rank}
                  </span>
                  
                  {/* Avatar */}
                  <img src={item.avatar} alt={item.name} className="w-8 h-8 rounded-full border border-border shadow-sm shrink-0" />
                  
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground truncate leading-snug">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">{item.role}</p>
                  </div>
                </div>

                {/* Value Pill */}
                <span className={cn("px-2.5 py-1 text-[10px] font-black rounded-xl shrink-0 uppercase tracking-wider", 
                  leaderboardSort === "violations" 
                    ? "bg-amber-50 text-amber-700 border border-amber-100" 
                    : "bg-rose-50 text-rose-700 border border-rose-100"
                )}>
                  {leaderboardSort === "violations" ? `${item.violations} Violations` : `₹${item.penaltyAmount}`}
                </span>
              </div>
            );
          }) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-xs text-muted-foreground">No disciplinary data available.</p>
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  </div>
  );
}
