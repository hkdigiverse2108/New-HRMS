import { useMemo } from "react";
import { HR_UPDATES, COMPANY_NEWS } from "../dashboard-data";
import { Gift, Award, CalendarDays, UserPlus, LogOut, CheckCircle2, ShieldAlert, Cake, Sparkles } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function parseDobToNextBirthday(dobStr: string): { diffDays: number; formatted: string } | null {
  if (!dobStr) return null;
  const parts = dobStr.includes("-") ? dobStr.split("-") : dobStr.split("/");
  if (parts.length < 3) return null;
  let month = 0;
  let day = 0;
  const p0 = parts[0] ?? "";
  const p1 = parts[1] ?? "";
  const p2 = parts[2] ?? "";
  if (p0.length === 4) {
    // YYYY-MM-DD
    month = parseInt(p1, 10) - 1;
    day = parseInt(p2, 10);
  } else {
    // DD-MM-YYYY or MM-DD-YYYY
    day = parseInt(p0, 10);
    month = parseInt(p1, 10) - 1;
  }
  if (isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) return null;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  let nextBday = new Date(currentYear, month, day);
  const todayReset = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (nextBday < todayReset) {
    nextBday = new Date(currentYear + 1, month, day);
  }
  
  const diffTime = nextBday.getTime() - todayReset.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatted = `${day} ${monthNames[month] ?? ""}`;
  return { diffDays, formatted };
}

export function HRAndNews() {
  const { employees } = useEmployeesContext();
  const { user } = useAuth();

  // Role-based access control for sensitive Offboarding / Last Working Date data
  const canViewOffboarding = Boolean(
    isUserAdmin(user) ||
    ["Admin", "HR", "Manager", "Sub-Admin", "Team Lead", "CEO", "CTO"].includes(
      (user as any)?.role || (user as any)?.work_details?.system_role || ""
    )
  );

  const realBirthdays = useMemo(() => {
    if (!employees || employees.length === 0) {
      return HR_UPDATES.birthdays.map(b => ({ ...b, diffDays: null }));
    }
    const withDob = employees
      .map(e => {
        const parsed = parseDobToNextBirthday(e.dob || "");
        return {
          name: e.name,
          date: parsed ? parsed.formatted : (e.dob || ""),
          diffDays: parsed ? parsed.diffDays : 999,
        };
      })
      .filter(e => e.date)
      .sort((a, b) => (a.diffDays ?? 999) - (b.diffDays ?? 999));

    if (withDob.length === 0) {
      return HR_UPDATES.birthdays.map(b => ({ ...b, diffDays: null }));
    }
    return withDob.slice(0, 6);
  }, [employees]);

  const realExits = useMemo(() => {
    if (!employees || employees.length === 0) return HR_UPDATES.exit;
    const exiting = employees.filter(e => 
      e.hasResignation || 
      (e as any).last_working_date || 
      (e as any).work_details?.last_working_date ||
      (e.role && e.role.toLowerCase().includes("intern") && (e as any).bondEndDate) ||
      (e.department === "Intern" && (e as any).employmentEndDate)
    );
    if (exiting.length === 0) return [];
    
    return exiting.slice(0, 6).map(e => {
      const rawDate = (e as any).last_working_date || 
        (e as any).work_details?.last_working_date || 
        (e.resignationDate ? e.resignationDate : (e as any).bondEndDate || "Upcoming Exit");
      
      const isIntern = e.role?.toLowerCase().includes("intern") || e.department === "Intern";
      let diffDaysText = "";
      if (rawDate && rawDate !== "Upcoming Exit") {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          const now = new Date();
          const todayReset = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const targetReset = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const diff = Math.round((targetReset.getTime() - todayReset.getTime()) / (1000 * 60 * 60 * 24));
          if (diff === 0) diffDaysText = "Today";
          else if (diff > 0) diffDaysText = `In ${diff}d`;
          else diffDaysText = "Completed";
        }
      }

      return {
        name: e.name,
        role: e.role || "Employee",
        isIntern,
        date: rawDate,
        diffDaysText,
      };
    });
  }, [employees]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
      {/* SECTION 11: HR Updates */}
      <div>
        <CollapsibleSection section="Section 11" title="HR Updates">

        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Gift className="h-4 w-4 text-rose-500" />
                <h3 className="text-[13px] font-bold text-foreground">Upcoming Birthdays</h3>
              </div>
              <ul className="space-y-2">
                {realBirthdays.map((item, i) => {
                  const isToday = item.diffDays === 0;
                  const isSoon = item.diffDays !== null && item.diffDays > 0 && item.diffDays <= 7;
                  return (
                    <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        {isToday ? <Cake className="w-3.5 h-3.5 text-rose-500 animate-bounce shrink-0" /> : <Sparkles className="w-3 h-3 text-muted-foreground shrink-0" />}
                        <span className="font-semibold text-foreground/90 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-muted-foreground">{item.date}</span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white animate-pulse">
                            Today!
                          </span>
                        )}
                        {isSoon && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                            In {item.diffDays}d
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Award className="h-4 w-4 text-amber-500" />
                <h3 className="text-[13px] font-bold text-foreground">Work Anniversaries</h3>
              </div>
              <ul className="space-y-2">
                {HR_UPDATES.anniversaries.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                    <span className="font-semibold text-foreground/90">{item.name}</span>
                    <span className="text-muted-foreground font-medium">{item.tenure}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="h-px bg-border/60"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-blue-500" />
                <h3 className="text-[13px] font-bold text-foreground">Interview Schedule</h3>
              </div>
              <ul className="space-y-2">
                {HR_UPDATES.interviews.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                    <span className="font-semibold text-foreground/90">{item.role}</span>
                    <span className="text-muted-foreground font-medium">{item.time}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-bold text-foreground">New Joining</h3>
              </div>
              <ul className="space-y-2">
                {HR_UPDATES.joining.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                    <span className="font-semibold text-foreground/90">{item.name}</span>
                    <span className="text-muted-foreground font-medium">{item.date}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="h-px bg-border/60"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4 text-rose-500" />
                  <h3 className="text-[13px] font-bold text-foreground">Employee / Intern Last Date</h3>
                </div>
                {!canViewOffboarding && (
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider bg-muted px-2 py-0.5 rounded-md">
                    HR Only
                  </span>
                )}
              </div>
              
              {!canViewOffboarding ? (
                <div className="p-4 rounded-2xl bg-muted/30 border border-dashed border-border text-center">
                  <ShieldAlert className="w-5 h-5 text-muted-foreground mx-auto mb-1.5 opacity-60" />
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Offboarding & Last working date details are restricted to HR & Admin.
                  </p>
                </div>
              ) : realExits.length === 0 ? (
                <div className="p-4 rounded-2xl bg-muted/20 border border-dashed border-border/50 text-center">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    No pending offboardings or intern departures. 🎉
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {realExits.map((item: any, i: number) => (
                    <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground/90 truncate">{item.name}</span>
                          {item.isIntern && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-700">
                              Intern
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{item.role}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-muted-foreground font-medium">{item.date}</span>
                        {item.diffDaysText && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-md text-[9px] font-black",
                            item.diffDaysText === "Today" ? "bg-rose-500 text-white animate-pulse" :
                            item.diffDaysText === "Completed" ? "bg-muted text-muted-foreground" :
                            "bg-amber-100 text-amber-800"
                          )}>
                            {item.diffDaysText}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-bold text-foreground">Probation Ending</h3>
              </div>
              <ul className="space-y-2">
                {HR_UPDATES.probation.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                    <span className="font-semibold text-foreground/90">{item.name}</span>
                    <span className="text-muted-foreground font-medium">{item.date}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="h-px bg-border/60"></div>

          {/* Document Expiry + Policy Updates — REMOVED per Audio PDF */}
        </div>
        </CollapsibleSection>
      </div>

      {/* SECTION 12: Company News */}
      <div>
        <CollapsibleSection section="Section 12" title="Company News">

        <div className="space-y-4 mb-6">
          {COMPANY_NEWS.map((news, i) => (
            <div key={i} className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm">
              <h3 className="text-[15px] font-bold text-foreground mb-1">{news.title}</h3>
              <p className="text-[12px] text-muted-foreground">{news.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-3xl p-8 text-white shadow-sm relative overflow-hidden flex flex-col justify-between h-48">
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Today's motivation</h3>
            <p className="text-xl font-bold leading-snug">“Discipline compounds faster than talent. Show up, ship, repeat.”</p>
          </div>
        </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
