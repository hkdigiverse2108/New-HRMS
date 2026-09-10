import { useState, useMemo } from "react";
import { Check, X, Calendar, Clock, ChevronDown, Filter, CalendarDays, Activity, Plus, Edit2 } from "lucide-react";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger  } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/ui/select";
import { useSettingsContext } from "../payroll/SettingsContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type LeaveStatus = "Pending" | "Approved" | "Rejected";

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  avatar: string;
  role: string;
  department: string;
  type: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  isConditional?: boolean;
}

const MOCK_REQUESTS: LeaveRequest[] = [
  {
    id: "LR-001",
    employeeId: "EMP-012",
    employeeName: "Sneha Rao",
    avatar: "https://i.pravatar.cc/150?u=sneha",
    role: "UX Designer",
    department: "Design",
    type: "Sick Leave",
    startDate: "2026-08-14",
    endDate: "2026-08-15",
    durationDays: 2,
    reason: "Fever and cold, doctor advised rest.",
    status: "Pending",
    appliedOn: "2026-08-10",
  },
  {
    id: "LR-002",
    employeeId: "EMP-004",
    employeeName: "David Chen",
    avatar: "https://i.pravatar.cc/150?u=david",
    role: "Product Manager",
    department: "Product",
    type: "Annual Leave",
    startDate: "2026-09-01",
    endDate: "2026-09-07",
    durationDays: 5,
    reason: "Family vacation to Hawaii.",
    status: "Pending",
    appliedOn: "2026-08-09",
  },
  {
    id: "LR-003",
    employeeId: "EMP-028",
    employeeName: "Amit Patel",
    avatar: "https://i.pravatar.cc/150?u=amit",
    role: "Frontend Developer",
    department: "Engineering",
    type: "Casual Leave",
    startDate: "2026-08-18",
    endDate: "2026-08-18",
    durationDays: 1,
    reason: "Personal errands to attend to.",
    status: "Pending",
    appliedOn: "2026-08-08",
  },
  {
    id: "LR-004",
    employeeId: "EMP-041",
    employeeName: "Sarah Smith",
    avatar: "https://i.pravatar.cc/150?u=sarah",
    role: "Marketing Specialist",
    department: "Marketing",
    type: "Sick Leave",
    startDate: "2026-08-12",
    endDate: "2026-08-13",
    durationDays: 2,
    reason: "Dental surgery appointment.",
    status: "Pending",
    appliedOn: "2026-08-07",
  },
  {
    id: "LR-005",
    employeeId: "EMP-005",
    employeeName: "Elena Rodriguez",
    avatar: "https://i.pravatar.cc/150?u=elena",
    role: "HR Manager",
    department: "Human Resources",
    type: "Annual Leave",
    startDate: "2026-07-20",
    endDate: "2026-07-24",
    durationDays: 5,
    reason: "Summer vacation.",
    status: "Approved",
    appliedOn: "2026-07-01",
  },
  {
    id: "LR-006",
    employeeId: "EMP-019",
    employeeName: "Vikram Singh",
    avatar: "https://i.pravatar.cc/150?u=vikram",
    role: "Backend Engineer",
    department: "Engineering",
    type: "Unpaid Leave",
    startDate: "2026-08-01",
    endDate: "2026-08-02",
    durationDays: 2,
    reason: "Extended travel delay.",
    status: "Rejected",
    appliedOn: "2026-07-28",
  },
];

const getLeaveTypeColor = (type: string) => {
  switch (type) {
    case "Sick Leave": return "text-rose-600 bg-rose-50 border-rose-100";
    case "Casual Leave": return "text-amber-600 bg-amber-50 border-amber-100";
    case "Annual Leave": return "text-primary bg-primary/10 border-indigo-100";
    case "Unpaid Leave": return "text-foreground/80 bg-muted/50 border-border";
    default: return "text-teal-600 bg-teal-50 border-teal-100";
  }
};

const getLeaveTypeIcon = (type: string) => {
  switch (type) {
    case "Sick Leave": return <Activity className="w-3.5 h-3.5" />;
    case "Casual Leave": return <Clock className="w-3.5 h-3.5" />;
    case "Annual Leave": return <CalendarDays className="w-3.5 h-3.5" />;
    case "Unpaid Leave": return <X className="w-3.5 h-3.5" />;
    default: return <Calendar className="w-3.5 h-3.5" />;
  }
};

export function LeaveRequests({ isNew }: { isNew?: boolean }) {
  const { leaveTypes } = useSettingsContext();
  const [requests, setRequests] = useState<LeaveRequest[]>(MOCK_REQUESTS);
  const [activeTab, setActiveTab] = useState<LeaveStatus>("Pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(isNew || false);
  
  // New leave form state
  const [newLeaveType, setNewLeaveType] = useState<string>(leaveTypes[0] || "Sick Leave");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newIsConditional, setNewIsConditional] = useState(false);

  const handleAction = (id: string, action: "Approved" | "Rejected" | "Pending", isConditional?: boolean) => {
    setRequests(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, status: action };
      if (isConditional !== undefined) updated.isConditional = isConditional;
      return updated;
    }));
    if (action === "Pending") {
      toast.success(`Leave request reverted to pending for review`);
    } else {
      toast.success(`Leave request ${action.toLowerCase()}${isConditional ? ' conditionally (WFH)' : ''} successfully`);
    }
  };

  const handleAddLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStartDate || !newEndDate || !newReason) {
      toast.error("Please fill all required fields");
      return;
    }

    const start = new Date(newStartDate);
    const end = new Date(newEndDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates

    const newRequest: LeaveRequest = {
      id: `LR-${Math.random().toString(36).substr(2, 9)}`,
      employeeId: "EMP-NEW", // Mock ID for demo
      employeeName: "Current User", // Mock name
      avatar: "https://i.pravatar.cc/150?u=current",
      role: "Software Engineer",
      department: "Engineering",
      type: newLeaveType,
      startDate: newStartDate,
      endDate: newEndDate,
      durationDays,
      reason: newReason,
      status: "Pending",
      appliedOn: new Date().toISOString().split("T")[0] || "",
      isConditional: newIsConditional,
    };

    setRequests(prev => [newRequest, ...prev]);
    setIsAddOpen(false);
    toast.success("Leave request submitted successfully");
    
    // Reset form
    setNewLeaveType(leaveTypes[0] || "Sick Leave");
    setNewStartDate("");
    setNewEndDate("");
    setNewReason("");
    setNewIsConditional(false);
  };

  const filteredRequests = useMemo(() => {
    return requests
      .filter(r => r.status === activeTab)
      .filter(r => 
        r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.department.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => new Date(b.appliedOn).getTime() - new Date(a.appliedOn).getTime());
  }, [requests, activeTab, searchQuery]);

  const pendingCount = requests.filter(r => r.status === "Pending").length;

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Leave Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and review employee time off</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <input 
              type="text" 
              placeholder="Search employee..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
          <button className="px-4 py-2 bg-white border border-border rounded-xl text-sm font-bold text-foreground/80 hover:bg-muted/50 shadow-sm flex items-center gap-2">
            Filter <ChevronDown className="w-4 h-4" />
          </button>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <button className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" /> Add Leave
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] md:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
              <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Request Leave</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
              <form onSubmit={handleAddLeave} className="flex flex-col max-h-[70vh]">
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Leave Type</label>
                    <SearchableSelect 
                      value={newLeaveType}
                      onChange={setNewLeaveType}
                      options={leaveTypes.map(type => ({ label: type, value: type }))}
                      className="w-full px-4 h-[46px] bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Start Date</label>
                      <input 
                        type="date" 
                        required
                        value={newStartDate}
                        onChange={e => setNewStartDate(e.target.value)}
                        className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">End Date</label>
                      <input 
                        type="date" 
                        required
                        value={newEndDate}
                        onChange={e => setNewEndDate(e.target.value)}
                        className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Reason</label>
                    <textarea 
                      required
                      value={newReason}
                      onChange={e => setNewReason(e.target.value)}
                      placeholder="Briefly explain your reason..."
                      className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input 
                      type="checkbox" 
                      id="conditionalLeave"
                      checked={newIsConditional}
                      onChange={e => setNewIsConditional(e.target.checked)}
                      className="w-4 h-4 text-primary rounded border-border/50 focus:ring-primary/20 cursor-pointer"
                    />
                    <label htmlFor="conditionalLeave" className="text-sm font-bold text-muted-foreground cursor-pointer uppercase tracking-widest">
                      Conditional Leave (WFH)
                    </label>
                  </div>
                </div>

                <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsAddOpen(false)}
                    className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex border-b border-border">
        {(["Pending", "Approved", "Rejected"] as LeaveStatus[]).map(status => (
          <button
            key={status}
            onClick={() => setActiveTab(status)}
            className={cn(
              "px-6 py-3 text-sm font-bold border-b-2 transition-colors relative",
              activeTab === status 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground/80 hover:border-border"
            )}
          >
            {status}
            {status === "Pending" && pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto pb-6">
        {filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-muted/50/50 rounded-3xl border border-dashed border-border">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <CalendarDays className="w-8 h-8 text-border" />
            </div>
            <h3 className="text-foreground font-bold">No {activeTab.toLowerCase()} requests</h3>
            <p className="text-muted-foreground text-sm mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRequests.map(request => (
              <div 
                key={request.id} 
                className="bg-white border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden"
              >
                {/* Top header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <img src={request.avatar} alt={request.employeeName} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                    <div>
                      <h3 className="font-bold text-foreground leading-tight">{request.employeeName}</h3>
                      <p className="text-xs text-muted-foreground">{request.role} • {request.department}</p>
                    </div>
                  </div>
                  <div className={cn("px-2.5 py-1 rounded-full border text-[11px] font-bold flex items-center gap-1", getLeaveTypeColor(request.type))}>
                    {getLeaveTypeIcon(request.type)}
                    {request.type}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3 bg-muted/50/50 rounded-xl p-4 border border-border/50">
                  {request.isConditional && (
                    <div className="mb-1 inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 text-indigo-700 text-[11px] font-black uppercase rounded-lg border border-indigo-500/20">
                      <Clock className="w-3.5 h-3.5" /> Working From Home
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-foreground/80">{request.startDate} to {request.endDate}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">{request.durationDays} {request.durationDays === 1 ? 'Day' : 'Days'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-4 h-4 rounded-full bg-slate-200/50 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-black text-muted-foreground">i</span>
                    </div>
                    <p className="text-sm text-foreground/80 italic line-clamp-2">"{request.reason}"</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground font-medium">Applied on {request.appliedOn}</p>
                  
                  {request.status === "Pending" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button 
                        onClick={() => handleAction(request.id, "Rejected")}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Reject"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleAction(request.id, "Approved", true)}
                        className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                        title="Approve as Work From Home"
                      >
                        <Clock className="w-4 h-4" /> WFH
                      </button>
                      <button 
                        onClick={() => handleAction(request.id, "Approved")}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                    </div>
                  )}
                  {request.status !== "Pending" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1.5 hover:bg-muted/50 p-1 -m-1 rounded-lg transition-colors outline-none focus:ring-2 focus:ring-primary/20">
                          <div className={cn(
                            "px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5",
                            request.status === "Approved" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          )}>
                            {request.status}
                            <ChevronDown className="w-3 h-3 opacity-50" />
                          </div>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px] rounded-xl p-1.5 shadow-xl border-border/60">
                        <DropdownMenuItem onClick={() => handleAction(request.id, "Approved", false)} className="text-emerald-600 font-medium cursor-pointer rounded-lg mb-1">
                          <Check className="w-4 h-4 mr-2" /> Approve Leave
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction(request.id, "Approved", true)} className="text-indigo-600 font-medium cursor-pointer rounded-lg mb-1">
                          <Clock className="w-4 h-4 mr-2" /> Approve as WFH
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction(request.id, "Rejected", false)} className="text-rose-600 font-medium cursor-pointer rounded-lg mb-1">
                          <X className="w-4 h-4 mr-2" /> Reject Leave
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction(request.id, "Pending", false)} className="text-amber-600 font-medium cursor-pointer rounded-lg">
                          <Activity className="w-4 h-4 mr-2" /> Revert to Pending
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
