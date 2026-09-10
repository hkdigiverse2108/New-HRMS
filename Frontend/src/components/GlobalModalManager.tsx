import { useState, useEffect } from "react";
import { X, Plus, ChevronDown, CalendarPlus, UserPlus, Briefcase, ListPlus } from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmployeeFormModal } from "@/components/employees/EmployeeFormModal";
import { CreateEventModal } from "@/components/schedule/CreateEventModal";
import { useGlobalModal } from "./GlobalModalContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { useSettingsContext } from "@/components/payroll/SettingsContext";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";

type Priority = "High" | "Medium" | "Low";

// ─── New Task Modal ───────────────────────────────────────────────────────────
function NewTaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [dueDate, setDueDate] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hrms_employees");
      if (saved) {
        try { setEmployees(JSON.parse(saved)); } catch {}
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("Task title is required"); return; }

    const assigneesList = assignees.length > 0
      ? assignees.map(name => ({ name, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}` }))
      : [{ name: "Me", avatar: "https://i.pravatar.cc/150?u=current" }];

    const newTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: title.trim(),
      description: desc,
      status: "Todo",
      priority,
      dueDate: dueDate || format(new Date(), "yyyy-MM-dd"),
      assignees: assigneesList,
      commentsCount: 0,
      attachmentsCount: 0,
    };

    const existing = JSON.parse(localStorage.getItem("hrms_tasks") || "[]");
    localStorage.setItem("hrms_tasks", JSON.stringify([newTask, ...existing]));
    window.dispatchEvent(new Event("storage"));
    toast.success("Task created successfully!");

    setTitle(""); setDesc(""); setPriority("Medium"); setDueDate(""); setAssignees([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ListPlus className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-lg font-black tracking-tight">Create New Task</h2>
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[70vh]">
          <div className="p-8 space-y-4 overflow-y-auto">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Task Title *</label>
              <input
                type="text" required autoFocus
                placeholder="e.g. Design Logo"
                value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Description</label>
              <textarea
                rows={3} placeholder="Task details..."
                value={desc} onChange={e => setDesc(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary font-semibold resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Priority</label>
                <SearchableSelect
                  value={priority} onChange={(v) => setPriority(v as Priority)}
                  options={[{ label: "High", value: "High" }, { label: "Medium", value: "Medium" }, { label: "Low", value: "Low" }]}
                  className="w-full h-[38px] px-3 bg-muted/50 border border-border/50 rounded-xl text-sm font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Due Date</label>
                <input
                  type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Assignees</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="flex h-[38px] w-full items-center justify-between whitespace-nowrap rounded-xl border border-border/50 bg-muted/50 px-3 py-2 text-sm font-bold focus:outline-none">
                    <span className="truncate">{assignees.length > 0 ? assignees.join(", ") : "Select Assignees..."}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-2 bg-card border border-border rounded-xl shadow-xl z-[300]" align="start">
                  <div className="px-1 py-1 border-b border-border/40 mb-1">
                    <input type="text" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} className="w-full px-2 py-1 text-xs border border-border rounded-lg bg-muted/30 focus:outline-none" />
                  </div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase())).map(emp => {
                      const checked = assignees.includes(emp.name);
                      return (
                        <label key={emp.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-lg cursor-pointer text-xs font-bold select-none text-foreground">
                          <input type="checkbox" checked={checked} onChange={() => setAssignees(checked ? assignees.filter(n => n !== emp.name) : [...assignees, emp.name])} className="rounded border-border w-3.5 h-3.5" />
                          {emp.name}
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="px-8 py-5 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-sm rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors shadow-sm">Create Task</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Apply Leave Modal ────────────────────────────────────────────────────────
function ApplyLeaveModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { leaveTypes } = useSettingsContext();
  const [leaveType, setLeaveType] = useState(leaveTypes[0] || "Sick Leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isConditional, setIsConditional] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) { toast.error("Please fill all required fields"); return; }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const newRequest = {
      id: `LR-${Math.random().toString(36).substr(2, 9)}`,
      employeeId: "EMP-CURRENT",
      employeeName: "Current User",
      avatar: "https://i.pravatar.cc/150?u=current",
      role: "Employee",
      department: "Engineering",
      type: leaveType,
      startDate,
      endDate,
      durationDays,
      reason,
      status: "Pending",
      appliedOn: new Date().toISOString().split("T")[0] || "",
      isConditional,
    };

    const existing = JSON.parse(localStorage.getItem("hrms_leave_requests") || "[]");
    localStorage.setItem("hrms_leave_requests", JSON.stringify([newRequest, ...existing]));
    window.dispatchEvent(new Event("storage"));
    toast.success("Leave request submitted successfully!");

    setLeaveType(leaveTypes[0] || "Sick Leave"); setStartDate(""); setEndDate(""); setReason(""); setIsConditional(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <CalendarPlus className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-lg font-black tracking-tight">Apply for Leave</h2>
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
          </DialogClose>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[75vh]">
          <div className="p-8 space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Leave Type</label>
              <SearchableSelect
                value={leaveType} onChange={setLeaveType}
                options={leaveTypes.map(t => ({ label: t, value: t }))}
                className="w-full px-4 h-[46px] bg-muted/50 border border-border/50 rounded-xl text-sm font-medium"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Start Date *</label>
                <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">End Date *</label>
                <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Reason *</label>
              <textarea required value={reason} onChange={e => setReason(e.target.value)} placeholder="Briefly explain your reason..." className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="gm-conditional" checked={isConditional} onChange={e => setIsConditional(e.target.checked)} className="w-4 h-4 text-primary rounded border-border/50 cursor-pointer" />
              <label htmlFor="gm-conditional" className="text-xs font-bold text-muted-foreground cursor-pointer uppercase tracking-widest">Conditional Leave (WFH)</label>
            </div>
          </div>
          <div className="px-8 py-5 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all">Submit Request</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Project Modal ────────────────────────────────────────────────────────
function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [clientName, setClientName] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Project name is required"); return; }

    const newProject = {
      id: `proj-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      description,
      category,
      priority,
      clientName: clientName || "Internal",
      clientId: `client-${Math.random().toString(36).substr(2, 6)}`,
      status: "active",
      dueDate: dueDate || "",
      startDate: format(new Date(), "yyyy-MM-dd"),
      team: [],
      modules: [],
      budget: 0,
      spent: 0,
      currency: "INR",
    };

    const existing = JSON.parse(localStorage.getItem("hrms_projects") || "[]");
    localStorage.setItem("hrms_projects", JSON.stringify([newProject, ...existing]));
    window.dispatchEvent(new Event("storage"));
    toast.success("Project created successfully!");

    setName(""); setDescription(""); setCategory("General"); setPriority("Medium"); setClientName(""); setDueDate("");
    onClose();
  };

  const CATEGORIES = ["General", "Digital Marketing", "Web Development", "Mobile App", "Design", "Consulting", "Sales", "HR", "Finance", "Operations"];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">New Project</h2>
              <p className="text-xs text-muted-foreground">Add project details below</p>
            </div>
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
          </DialogClose>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[75vh]">
          <div className="p-8 space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Project Name *</label>
              <input type="text" required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website Redesign" className="w-full px-4 h-[42px] bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief project description..." rows={3} className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Category</label>
                <SearchableSelect
                  value={category} onChange={setCategory}
                  options={CATEGORIES.map(c => ({ label: c, value: c }))}
                  className="w-full h-[42px] px-4 bg-muted/50 border border-border/50 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full h-[42px] px-4 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none font-semibold">
                  {["Low", "Medium", "High", "Critical"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Client Name</label>
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Acme Corp" className="w-full px-4 h-[42px] bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-4 h-[42px] bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
              </div>
            </div>
          </div>
          <div className="px-8 py-5 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-sm rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors shadow-sm">Create Project</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Lead Modal ───────────────────────────────────────────────────────────
function NewLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("Website");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) { toast.error("Company name is required"); return; }

    const newLead = {
      id: `lead-${Math.random().toString(36).substr(2, 9)}`,
      company: company.trim(),
      contactName: contactName || "Unknown",
      email,
      phone,
      source,
      notes,
      status: "New",
      value: 0,
      createdAt: new Date().toISOString(),
    };

    const existing = JSON.parse(localStorage.getItem("hrms_leads") || "[]");
    localStorage.setItem("hrms_leads", JSON.stringify([newLead, ...existing]));
    window.dispatchEvent(new Event("storage"));
    toast.success("Lead created successfully!");

    setCompany(""); setContactName(""); setEmail(""); setPhone(""); setSource("Website"); setNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">New Lead</h2>
              <p className="text-xs text-muted-foreground">Add a new sales lead</p>
            </div>
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
          </DialogClose>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[75vh]">
          <div className="p-8 space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Company Name *</label>
              <input type="text" required autoFocus value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Acme Corp" className="w-full px-4 h-[42px] bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Contact Name</label>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="John Doe" className="w-full px-4 h-[42px] bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Source</label>
                <select value={source} onChange={e => setSource(e.target.value)} className="w-full h-[42px] px-4 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none font-semibold">
                  {["Website", "Referral", "LinkedIn", "Email", "Cold Call", "Event", "Other"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@acme.com" className="w-full px-4 h-[42px] bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full px-4 h-[42px] bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any relevant notes..." rows={3} className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>
          </div>
          <div className="px-8 py-5 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-card border border-border text-foreground/80 hover:bg-muted font-bold text-sm rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors shadow-sm">Add Lead</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Root GlobalModalManager ──────────────────────────────────────────────────
export function GlobalModalManager() {
  const { activeModal, closeModal } = useGlobalModal();
  const { addEmployee } = useEmployeesContext();

  const handleAddEmployee = (data: any) => {
    addEmployee(data);
    closeModal();
  };

  return (
    <>
      <NewTaskModal open={activeModal === "newTask"} onClose={closeModal} />
      <ApplyLeaveModal open={activeModal === "applyLeave"} onClose={closeModal} />
      <NewProjectModal open={activeModal === "newProject"} onClose={closeModal} />
      <NewLeadModal open={activeModal === "newLead"} onClose={closeModal} />
      <EmployeeFormModal
        isOpen={activeModal === "addEmployee"}
        onClose={closeModal}
        onSubmit={handleAddEmployee}
      />
      <CreateEventModal
        isOpen={activeModal === "newMeeting"}
        onClose={closeModal}
        onSave={(_event) => closeModal()}
      />
    </>
  );
}
