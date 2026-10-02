import { useState, useEffect } from "react";
import { UserPlus, CheckSquare, Briefcase, Receipt, Clock, Settings, X, Plus, Search, BellRing } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin } from "@/lib/permissions";
import { SendUrgentMeetingModal } from "@/components/common/SendUrgentMeetingModal";

import { navItems } from "@/components/nav-data";
import { Link2 } from "lucide-react";

const DEFAULT_QUICK_ACTIONS = [
  { id: "employees", title: "Employees", icon: UserPlus, url: "/employees/list", hint: "People" },
  { id: "tasks", title: "Tasks", icon: CheckSquare, url: "/tasks", hint: "Work" },
  { id: "clients", title: "Clients", icon: Briefcase, url: "/work/sales/leads", hint: "Sales" },
  { id: "invoices", title: "Invoices", icon: Receipt, url: "/invoice/create", hint: "Finance" },
  { id: "meetings", title: "Meetings", icon: Clock, url: "/schedule", hint: "Collaboration" },
  { id: "projects", title: "Projects", icon: Briefcase, url: "/work/projects", hint: "Work" },
  { id: "reports", title: "Reports", icon: Receipt, url: "/reports/overview", hint: "Analytics" },
  { id: "attendance", title: "Attendance", icon: Clock, url: "/employees/attendance", hint: "People" },
];

const DASHBOARD_QUICK_ACTIONS = [...DEFAULT_QUICK_ACTIONS];
const existingUrls = new Set(DASHBOARD_QUICK_ACTIONS.map(a => a.url));

navItems.forEach(item => {
  if (item.url && !existingUrls.has(item.url)) {
    DASHBOARD_QUICK_ACTIONS.push({
      id: item.url,
      title: item.title,
      icon: item.icon || Link2,
      url: item.url,
      hint: item.section || "Page"
    });
    existingUrls.add(item.url);
  }
  if (item.children) {
    item.children.forEach(child => {
      if (child.url && !existingUrls.has(child.url)) {
        DASHBOARD_QUICK_ACTIONS.push({
          id: child.url,
          title: child.title,
          icon: item.icon || Link2,
          url: child.url,
          hint: item.title
        });
        existingUrls.add(child.url);
      }
    });
  }
});

export function DashboardHeader({ setActive, onAction }: { setActive?: ((url: string) => void) | undefined; onAction?: ((action: string) => void) | undefined }) {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());

  // Live IST clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hour = istNow.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const firstName = (user?.name || "User").split(" ")[0];
  const timeStr = istNow.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase();
  const monthName = istNow.toLocaleString("default", { month: "long" });

  // Working day: Mon-Sat counted (live)
  const y = istNow.getFullYear();
  const m = istNow.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const isWorkday = (d: number) => {
    const wd = new Date(y, m, d).getDay();
    return wd !== 0; // Sunday off
  };
  const totalWorkdays = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(isWorkday).length;
  const passedWorkdays = Array.from({ length: istNow.getDate() }, (_, i) => i + 1).filter(isWorkday).length;
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isSummonOpen, setIsSummonOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isLeaderOrAdmin = Boolean(
    isUserAdmin(user) || 
    ["Admin", "HR", "Manager", "Sub-Admin", "Team Lead", "CEO", "CTO"].includes((user as any)?.role || (user as any)?.work_details?.system_role || "")
  );
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("hrms_dashboard_actions");
      if (stored) {
        try { return JSON.parse(stored); } catch (e) {}
      }
    }
    return ["employees", "tasks", "clients", "invoices", "meetings"];
  });

  const toggleAction = (id: string) => {
    setSelectedActionIds(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      if (typeof window !== "undefined") {
        localStorage.setItem("hrms_dashboard_actions", JSON.stringify(next));
      }
      return next;
    });
  };

  const activeActions = DASHBOARD_QUICK_ACTIONS.filter(a => selectedActionIds.includes(a.id));
  return (
    <>
      <div className="bg-white rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8 border border-border/60 shadow-sm relative overflow-hidden mb-8 sm:mb-12">
      <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
        <div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">CEO Command Center</p>
          <h1 className="text-2xl sm:text-3xl md:text-[34px] font-black text-foreground tracking-tight flex items-center gap-2 mb-2 leading-tight">
            {greeting}, {firstName} <span className="text-2xl sm:text-3xl">👋</span>
          </h1>
          <p className="text-xs sm:text-[14px] text-muted-foreground">Today's overview — everything moving across the company, in one screen.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 justify-start lg:justify-end w-full lg:max-w-xl items-center">
          {isLeaderOrAdmin && (
            <button
              type="button"
              onClick={() => setIsSummonOpen(true)}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-[12px] font-bold shadow-md shadow-rose-200 transition-all cursor-pointer animate-pulse hover:animate-none group"
              title="Instant Emergency Meeting Summon to Team"
            >
              <BellRing className="h-3.5 w-3.5 text-white group-hover:rotate-12 transition-transform" />
              <span>Urgent Summon</span>
            </button>
          )}
          {activeActions.map(action => (
            <button key={action.id} onClick={() => setActive?.(action.url)} className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white border border-border/80 rounded-full text-[12px] font-bold text-foreground/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:bg-muted/50 transition-colors cursor-pointer group">
              <action.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" /> {action.title}
            </button>
          ))}
          <button 
            onClick={() => setIsCustomizeOpen(true)} 
            className="flex items-center justify-center w-[38px] h-[38px] bg-white border border-border/80 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:bg-muted/50 transition-colors cursor-pointer group"
            title="Customize Shortcuts"
          >
            <Settings className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 sm:mt-8">
        <div className="bg-muted/50/40 rounded-2xl p-4 sm:p-5 border border-border/40">
          <p className="text-[10px] font-bold text-muted-foreground mb-1">Current Time (IST)</p>
          <p className="text-xl sm:text-[22px] font-black text-primary truncate">{timeStr}</p>
        </div>
        <div className="bg-muted/50/40 rounded-2xl p-4 sm:p-5 border border-border/40">
          <p className="text-[10px] font-bold text-muted-foreground mb-1">Today's Date</p>
          <p className="text-xl sm:text-[22px] font-black text-blue-500 truncate">{formatDate(istNow)}</p>
        </div>
        <div className="bg-muted/50/40 rounded-2xl p-4 sm:p-5 border border-border/40">
          <p className="text-[10px] font-bold text-muted-foreground mb-1">Working Day</p>
          <p className="text-xl sm:text-[22px] font-black text-amber-500 truncate">Day {passedWorkdays} of {totalWorkdays}</p>
        </div>
        <div className="bg-muted/50/40 rounded-2xl p-4 sm:p-5 border border-border/40">
          <p className="text-[10px] font-bold text-muted-foreground mb-1">Financial Month</p>
          <p className="text-xl sm:text-[22px] font-black text-primary truncate">{monthName}</p>
        </div>
      </div>
    </div>

    <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
        <DialogContent className="max-w-[425px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card z-[9999]">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-lg font-black tracking-tight">Customize Shortcuts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Select which shortcuts appear on the dashboard</p>
            </div>
            <DialogClose asChild>
              <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>
          <div className="p-4 border-b border-border/50 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-border/60 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              />
            </div>
          </div>
          <div className="p-4 max-h-[60vh] overflow-y-auto space-y-1 bg-white">
            {DASHBOARD_QUICK_ACTIONS.filter(a => 
              a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
              a.hint.toLowerCase().includes(searchQuery.toLowerCase())
            ).map((a) => {
              const isSelected = selectedActionIds.includes(a.id);
              return (
                <label key={a.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/50">
                  <div className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input bg-background")}>
                    {isSelected && <Plus className="w-3.5 h-3.5 rotate-45" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={isSelected}
                    onChange={() => toggleAction(a.id)}
                  />
                  <div className="flex items-center gap-2.5 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <a.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{a.hint}</p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="px-6 py-4 border-t border-border/50 bg-muted/30">
            <button onClick={() => setIsCustomizeOpen(false)} className="w-full px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/95 transition-colors">
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <SendUrgentMeetingModal
        isOpen={isSummonOpen}
        onClose={() => setIsSummonOpen(false)}
      />
    </>
  );
}
