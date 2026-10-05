import { useState, useEffect, useCallback } from "react";
import { X, Search, Bell, Star, MessageSquareHeart, TrendingUp, Calendar, ChevronDown, CheckCircle2, Plus, Users, Building2, Send, Settings, GripVertical, Trash2, Eye, EyeOff, Pencil } from "lucide-react";
import { DialogClose, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn, formatDate } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthContext";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";

interface RemarkItem {
  id: string;
  employee_id: string;
  department?: string;
  rating: number;
  show_name: boolean;
  custom_answers?: Record<string, string>;
  submitted_by_id?: string | null;
  submitted_by_name?: string | null;
  created_at?: string | null;
  missing?: boolean;
}

interface Question {
  id: string;
  label: string;
  placeholder?: string;
  required: boolean;
}

interface Notif {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at?: string;
}

const renderStars = (score: number) => {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "w-4 h-4",
            star <= score ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200"
          )}
        />
      ))}
    </div>
  );
};

const fmtDate = (d?: string | null) => {
  if (!d) return "";
  try {
    return formatDate(new Date(d));
  } catch {
    return String(d).split("T")[0];
  }
};

export function Remarks() {
  const { user } = useAuth();
  const { employees } = useEmployeesContext();
  const myId = String((user as any)?.id || (user as any)?._id || "");
  const myName = String((user as any)?.name || "Employee");
  const myDept = String((user as any)?.department || "");
  const roleRaw = String((user as any)?.role || (user as any)?.work_details?.system_role || "").toLowerCase();
  const isAdmin = ["admin", "super admin", "superadmin"].includes(roleRaw) || myId === "default-admin-id";

  const [remarks, setRemarks] = useState<RemarkItem[]>([]);
  const [overview, setOverview] = useState({ total_employees: 0, submitted_count: 0, submission_rate_percent: 0, average_satisfaction: 0 });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const [isBellOpen, setIsBellOpen] = useState(false);

  // Submit / edit form
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [formEmpId, setFormEmpId] = useState("");
  const [newScore, setNewScore] = useState(5);
  const [showName, setShowName] = useState(false);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Admin manage questions
  const [isManageQOpen, setIsManageQOpen] = useState(false);
  const [newQLabel, setNewQLabel] = useState("");
  const [newQPlaceholder, setNewQPlaceholder] = useState("");
  const [newQRequired, setNewQRequired] = useState(false);

  // Reminder dialog
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<"department" | "employees">("department");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  const [reminderEmpSearch, setReminderEmpSearch] = useState("");
  const [isSending, setIsSending] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.get<any>("/remarks/overview", { showLoader: false, showErrorToast: false });
      if (res) setOverview({
        total_employees: res.total_employees || 0,
        submitted_count: res.submitted_count || 0,
        submission_rate_percent: res.submission_rate_percent || 0,
        average_satisfaction: res.average_satisfaction || 0,
      });
    } catch { /* silent */ }
  }, []);

  const fetchRemarks = useCallback(async (missing: boolean) => {
    try {
      const res = await api.get<any[]>(`/remarks${missing ? "?submission_rate=true" : ""}`, { showLoader: false, showErrorToast: false });
      const list = Array.isArray(res) ? res : [];
      setRemarks(list.map((r: any) => ({
        id: String(r.id || r._id),
        employee_id: String(r.employee_id || ""),
        department: r.department || "",
        rating: Number(r.rating) || 0,
        show_name: Boolean(r.show_name),
        custom_answers: r.custom_answers || {},
        submitted_by_id: r.submitted_by_id ? String(r.submitted_by_id) : null,
        submitted_by_name: r.submitted_by_name || "Anonymous",
        created_at: r.created_at || null,
        missing: String(r.id || r._id || "").startsWith("missing-"),
      })));
    } catch {
      setRemarks([]);
    }
  }, []);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await api.get<any[]>("/remarks/questions/all", { showLoader: false, showErrorToast: false });
      setQuestions(Array.isArray(res) ? res.map((q: any) => ({
        id: String(q.id || q._id),
        label: q.label || "",
        placeholder: q.placeholder || "",
        required: Boolean(q.required),
      })) : []);
    } catch {
      setQuestions([]);
    }
  }, []);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await api.get<any[]>("/notifications/me", { showLoader: false, showErrorToast: false });
      setNotifs(Array.isArray(res) ? res.map((n: any) => ({
        id: String(n.id || n._id),
        title: n.title || "Notification",
        message: n.message || "",
        type: n.type || "general",
        is_read: Boolean(n.is_read),
        created_at: n.created_at || "",
      })) : []);
    } catch {
      setNotifs([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchOverview(), fetchRemarks(showMissing), fetchQuestions(), fetchNotifs()]);
    setIsLoading(false);
  }, [fetchOverview, fetchRemarks, fetchQuestions, fetchNotifs, showMissing]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const unreadCount = notifs.filter(n => !n.is_read).length;

  const markRead = async (id: string) => {
    setNotifs(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await api.put(`/notifications/${id}/read`, {}, { showLoader: false, showErrorToast: false });
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await api.put("/notifications/read-all", {}, { showLoader: false, showErrorToast: false });
    } catch { /* silent */ }
  };

  const openNew = () => {
    setEditingId(null);
    setFormEmpId(isAdmin ? "" : myId);
    setNewScore(5);
    setShowName(false);
    setCustomAnswers({});
    setIsNewOpen(true);
  };

  const openEdit = (r: RemarkItem) => {
    setEditingId(r.id);
    setFormEmpId(r.employee_id);
    setNewScore(Math.max(1, Math.min(5, r.rating || 5)));
    setShowName(Boolean(r.show_name));
    const ans: Record<string, string> = {};
    Object.entries(r.custom_answers || {}).forEach(([k, v]) => { ans[k] = String(v ?? ""); });
    setCustomAnswers(ans);
    setIsNewOpen(true);
  };

  const handleSubmitRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    const empId = isAdmin ? formEmpId : myId;
    if (!empId) {
      toast.error("Please select an employee.");
      return;
    }
    for (const q of questions) {
      if (q.required && !(customAnswers[q.id] ?? "").trim() && !(customAnswers[q.label] ?? "").trim()) {
        toast.error(`"${q.label}" compulsory che.`);
        return;
      }
    }
    const empRec = employees.find(x => String(x.id) === String(empId));
    setIsSaving(true);
    try {
      const body: any = {
        employee_id: String(empId),
        department: empRec?.department || myDept || undefined,
        rating: newScore,
        show_name: showName,
        custom_answers: customAnswers,
      };
      if (editingId) {
        await api.put(`/remarks/${editingId}`, body);
        toast.success("Remark updated!");
      } else {
        await api.post("/remarks", body);
        toast.success("Remark submitted!");
      }
      setIsNewOpen(false);
      setEditingId(null);
      setCustomAnswers({});
      fetchRemarks(showMissing);
      fetchOverview();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save remark");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRemark = async (id: string) => {
    if (!window.confirm("Aa remark delete karvi?")) return;
    try {
      await api.delete(`/remarks/${id}`, { showErrorToast: false });
      toast.success("Remark deleted");
      fetchRemarks(showMissing);
      fetchOverview();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete remark");
    }
  };

  // Admin questions CRUD
  const addQuestion = async () => {
    if (!newQLabel.trim()) return;
    try {
      await api.post("/remarks/questions", {
        label: newQLabel.trim(),
        placeholder: newQPlaceholder.trim() || "Your answer...",
        required: newQRequired,
      });
      setNewQLabel("");
      setNewQPlaceholder("");
      setNewQRequired(false);
      fetchQuestions();
      toast.success("Question added — employees ne deshse");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add question");
    }
  };

  const removeQuestion = async (id: string) => {
    if (!window.confirm("Aa question delete karvi?")) return;
    try {
      await api.delete(`/remarks/questions/${id}`, { showErrorToast: false });
      fetchQuestions();
      toast.success("Question deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete question");
    }
  };

  // Reminders (admin) — dept-wise / person-wise → notification
  const allDepartments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort();
  const toggleDept = (dept: string) => {
    setSelectedDepts(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
  };
  const toggleEmp = (id: string) => {
    setSelectedEmps(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  const handleSendReminder = async () => {
    setIsSending(true);
    try {
      const body: any = reminderTarget === "department"
        ? { type: "department", departments: selectedDepts, employees: [] }
        : { type: "employee", departments: [], employees: selectedEmps };
      const res = await api.post<any>("/remarks/send-reminders", body);
      toast.success("Reminders Sent!", { description: res?.message || "Notifications sent." });
      setIsReminderOpen(false);
      setSelectedDepts([]);
      setSelectedEmps([]);
      setReminderEmpSearch("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send reminders");
    } finally {
      setIsSending(false);
    }
  };

  const filteredRemarks = remarks.filter(r => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const hay = `${r.submitted_by_name || ""} ${r.department || ""} ${Object.values(r.custom_answers || {}).join(" ")}`.toLowerCase();
    return hay.includes(q);
  });

  const answerLabel = (key: string) => {
    const q = questions.find(x => x.id === key || x.label === key);
    return q ? q.label : key;
  };

  return (
    <div className="space-y-5 h-[calc(100vh-4rem)] flex flex-col overflow-hidden pb-0">
      {/* Header/Stats */}
      <div className="shrink-0 bg-white border border-border rounded-3xl p-6 shadow-sm relative">
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className="absolute -top-12 -right-12 p-12 opacity-5 rotate-12">
            <MessageSquareHeart className="w-64 h-64 text-indigo-900" />
          </div>
        </div>

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight mb-2">Monthly Remarks & Feedback</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              {isAdmin ? "Review qualitative feedback and satisfaction scores." : "Submit your remarks here — admin questions will appear below."}
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap gap-4 items-center">
            <div className="bg-primary/10 border border-indigo-100 rounded-2xl p-4 flex items-center gap-4 min-w-[160px] flex-1 lg:flex-initial">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary/70 uppercase tracking-wider mb-0.5">Submission Rate</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-black text-primary leading-none">{overview.submission_rate_percent}%</p>
                  <span className="text-xs font-bold text-primary">{overview.submitted_count}/{overview.total_employees}</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-4 min-w-[160px] flex-1 lg:flex-initial">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-amber-500 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-0.5">Avg Satisfaction</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-black text-amber-700 leading-none">{overview.average_satisfaction}</p>
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                </div>
              </div>
            </div>

            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => setIsBellOpen(v => !v)}
                className="w-11 h-11 bg-white border border-border rounded-2xl shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {isBellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBellOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 w-[340px] max-h-[380px] overflow-hidden bg-card border border-border rounded-2xl shadow-2xl flex flex-col">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <span className="text-xs font-black uppercase tracking-wider">Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-[11px] font-bold text-primary hover:underline">Mark all read</button>
                      )}
                    </div>
                    <div className="overflow-y-auto">
                      {notifs.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">No notifications.</p>
                      )}
                      {notifs.map(n => (
                        <button
                          key={n.id}
                          onClick={() => markRead(n.id)}
                          className={cn("w-full text-left px-4 py-3 border-b border-border/40 hover:bg-muted/40 transition-colors", !n.is_read && "bg-primary/5")}
                        >
                          <p className="text-xs font-black text-foreground">{n.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{fmtDate(n.created_at)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-white border border-border rounded-3xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/50/50 shrink-0">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search feedback..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => { setShowMissing(v => !v); }}
                className={cn("px-4 py-2.5 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0 border",
                  showMissing ? "bg-amber-500 text-white border-amber-500" : "bg-white border-border text-foreground/80 hover:bg-muted/50")}
                        title="Those who have not submitted remarks"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">{showMissing ? "All Remarks" : "Missing"}</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setIsReminderOpen(true)}
                className="px-4 py-2.5 bg-white border border-border hover:bg-muted/50 text-foreground/80 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0"
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Send Reminders</span>
              </button>
            )}

            {/* Send Reminders Dialog */}
            {isReminderOpen && (
              <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsReminderOpen(false)}>
                <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-[480px] overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
                    <div>
                      <h3 className="text-lg font-black text-foreground tracking-tight">Send Reminders</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Department-wise / person-wise — notification jashe</p>
                    </div>
                    <button onClick={() => setIsReminderOpen(false)} className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex p-1.5 bg-muted/50 m-4 mb-0 rounded-2xl border border-border/40">
                    <button
                      onClick={() => setReminderTarget("department")}
                      className={cn("flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all",
                        reminderTarget === "department" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      By Department
                    </button>
                    <button
                      onClick={() => setReminderTarget("employees")}
                      className={cn("flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all",
                        reminderTarget === "employees" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      <Users className="w-3.5 h-3.5" />
                      By Employee
                    </button>
                  </div>

                  <div className="p-4 max-h-[300px] overflow-y-auto space-y-1.5">
                    {reminderTarget === "department" ? (
                      <>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider px-1 mb-2">
                          Select departments (leave empty = all)
                        </p>
                        {allDepartments.map(dept => {
                          const empCount = employees.filter(e => e.department === dept).length;
                          const isSelected = selectedDepts.includes(dept);
                          return (
                            <button
                              key={dept}
                              onClick={() => toggleDept(dept)}
                              className={cn(
                                "w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition-all duration-150",
                                isSelected
                                  ? "bg-primary/10 border-primary/30 text-primary"
                                  : "bg-background border-border/60 text-foreground hover:bg-muted/50"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                                  isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                                  <Building2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold">{dept}</p>
                                  <p className="text-[10px] text-muted-foreground">{empCount} employee{empCount !== 1 ? "s" : ""}</p>
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        <div className="relative mb-2">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search by name or department..."
                            value={reminderEmpSearch}
                            onChange={e => setReminderEmpSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-white border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider px-1 mb-2">
                          Select employees (leave empty = all)
                        </p>
                        {employees
                          .filter(emp =>
                            emp.name.toLowerCase().includes(reminderEmpSearch.toLowerCase()) ||
                            (emp.department || "").toLowerCase().includes(reminderEmpSearch.toLowerCase())
                          )
                          .map(emp => {
                            const isSelected = selectedEmps.includes(String(emp.id));
                            return (
                              <button
                                key={emp.id}
                                onClick={() => toggleEmp(String(emp.id))}
                                className={cn(
                                  "w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border text-left transition-all duration-150",
                                  isSelected
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "bg-background border-border/60 text-foreground hover:bg-muted/50"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <img src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random`} alt={emp.name} className="w-8 h-8 rounded-full border border-border shrink-0" />
                                  <div>
                                    <p className="text-sm font-bold">{emp.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{emp.department}</p>
                                  </div>
                                </div>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/20">
                    <p className="text-[11px] text-muted-foreground font-semibold">
                      {reminderTarget === "department"
                        ? selectedDepts.length > 0 ? `${selectedDepts.length} dept(s) selected` : "All departments"
                        : selectedEmps.length > 0 ? `${selectedEmps.length} employee(s) selected` : "All employees"
                      }
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsReminderOpen(false)} className="px-4 py-2 text-xs font-bold rounded-xl border border-border hover:bg-muted transition-colors">
                        Cancel
                      </button>
                      <button
                        onClick={handleSendReminder}
                        disabled={isSending}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isSending ? "Sending..." : "Send Now"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Dialog open={isNewOpen} onOpenChange={(open) => { setIsNewOpen(open); if (!open) setEditingId(null); }}>
              <DialogTrigger asChild>
                <button
                  onClick={openNew}
                  className="px-4 py-2.5 bg-primary hover:bg-primary text-primary-foreground font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">{isAdmin ? "Add Feedback" : "Submit Remark"}</span>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
                <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight">
                      {editingId ? "Edit Remark" : isAdmin ? "Add Manual Feedback/Remark" : "Submit Your Remark"}
                    </h2>
                    {!isAdmin && (
                      <p className="text-xs text-muted-foreground mt-1">As: <span className="font-bold text-foreground">{myName}</span></p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsManageQOpen(true)}
                        title="Manage feedback questions"
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}
                    <DialogClose asChild>
                      <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </DialogClose>
                  </div>
                </div>
                <form onSubmit={handleSubmitRemark} className="flex flex-col max-h-[70vh]">
                  <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                    {isAdmin && !editingId && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Employee (on behalf)</label>
                        <SearchableSelect
                          value={formEmpId}
                          onChange={setFormEmpId}
                          options={employees.map(emp => ({ label: `${emp.name} (${emp.department})`, value: String(emp.id) }))}
                          placeholder="Select Employee"
                          className="w-full h-[38px] px-3 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Satisfaction Score (1-5)</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setNewScore(score)}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-colors border",
                              newScore === score
                                ? "bg-amber-100 text-amber-700 border-amber-200 shadow-sm"
                                : "bg-white text-muted-foreground border-border hover:bg-muted/50"
                            )}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic questions from backend (admin adds → employee sees) */}
                    {questions.map(q => (
                      <div key={q.id} className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">
                          {q.label}{q.required && <span className="text-destructive ml-1">*</span>}
                        </label>
                        <textarea
                          required={q.required}
                          rows={2}
                          placeholder={q.placeholder || "Your answer..."}
                          value={customAnswers[q.id] ?? customAnswers[q.label] ?? ""}
                          onChange={e => setCustomAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                      </div>
                    ))}
                    {questions.length === 0 && (
                      <p className="text-xs text-muted-foreground/70 italic">No questions yet — admin will add them from Manage Questions.</p>
                    )}

                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-foreground/80">
                      <input
                        type="checkbox"
                        checked={showName}
                        onChange={e => setShowName(e.target.checked)}
                        className="rounded border-border w-4 h-4"
                      />
                      {showName ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      Show my name (na to Anonymous)
                    </label>

                    {/* Manage Questions inline panel (admin only) */}
                    {isAdmin && isManageQOpen && (
                      <div className="border border-border rounded-2xl overflow-hidden bg-muted/20">
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                          <span className="text-xs font-black uppercase tracking-wider text-foreground">Manage Questions</span>
                          <button type="button" onClick={() => setIsManageQOpen(false)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
                          {questions.map((q) => (
                            <div key={q.id} className="flex items-center gap-2 px-3 py-2 bg-white border border-border/60 rounded-xl">
                              <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">{q.label}</p>
                                <p className="text-[10px] text-muted-foreground">{q.required ? "Required" : "Optional"}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeQuestion(q.id)}
                                className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {questions.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-2">No questions yet.</p>
                          )}
                        </div>
                        <div className="p-3 border-t border-border space-y-2">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Add New Question</p>
                          <input
                            type="text"
                            placeholder="Question label e.g. Team collaboration"
                            value={newQLabel}
                            onChange={e => setNewQLabel(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <input
                            type="text"
                            placeholder="Placeholder text (optional)"
                            value={newQPlaceholder}
                            onChange={e => setNewQPlaceholder(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newQRequired}
                                onChange={e => setNewQRequired(e.target.checked)}
                                className="rounded border-border"
                              />
                              Required field
                            </label>
                            <button
                              type="button"
                              onClick={addQuestion}
                              disabled={!newQLabel.trim()}
                              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl disabled:opacity-40 transition-colors hover:bg-primary/90 flex items-center gap-1.5"
                            >
                              <Plus className="w-3 h-3" />
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => { setIsNewOpen(false); setEditingId(null); }}
                      className="px-4 py-2 bg-white border border-border text-foreground/80 hover:bg-muted/50 font-bold text-sm rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : editingId ? "Update" : "Save Feedback"}
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Grid List */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/50/30">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-16">Loading remarks...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRemarks.length > 0 ? filteredRemarks.map(record => {
                const canEdit = isAdmin || (record.submitted_by_id && record.submitted_by_id === myId);
                return (
                  <div key={record.id} className="bg-white p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(record.submitted_by_name || "U")}&background=random`}
                          alt={record.submitted_by_name || "User"}
                          className="w-10 h-10 rounded-full border border-border object-cover"
                        />
                        <div>
                          <h3 className="font-bold text-foreground leading-tight">{record.submitted_by_name || "Anonymous"}</h3>
                          <p className="text-xs text-muted-foreground">{record.department || ""}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
                          {fmtDate(record.created_at)}
                        </div>
                        {record.missing && (
                          <div className="text-[10px] font-black text-amber-600 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                            PENDING
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      {renderStars(record.rating)}
                    </div>

                    <div className="flex-1 space-y-3">
                      {Object.entries(record.custom_answers || {}).map(([k, v]) => (
                        <div key={k}>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{answerLabel(String(k))}</h4>
                          <p className="text-sm text-foreground/80 leading-relaxed">"{String(v)}"</p>
                        </div>
                      ))}
                      {Object.keys(record.custom_answers || {}).length === 0 && record.rating === 0 && (
                        <p className="text-xs text-muted-foreground italic">Not submitted yet.</p>
                      )}
                    </div>

                    {canEdit && !record.missing && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/40">
                        <button
                          onClick={() => openEdit(record)}
                          className="flex-1 px-3 py-1.5 text-xs font-bold rounded-xl border border-border hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRemark(record.id)}
                          className="flex-1 px-3 py-1.5 text-xs font-bold rounded-xl border border-border hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-border/50 text-muted-foreground">
                    <MessageSquareHeart className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground/80 mb-1">No feedback found</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">No remarks match your current search.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
