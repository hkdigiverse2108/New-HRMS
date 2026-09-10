import { HR_UPDATES, COMPANY_NEWS } from "../dashboard-data";
import { Gift, Award, CalendarDays, UserPlus, LogOut, CheckCircle2, FileText, Megaphone } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";

export function HRAndNews() {
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
                {HR_UPDATES.birthdays.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px]">
                    <span className="font-medium text-foreground/80">{item.name}</span>
                    <span className="text-muted-foreground">{item.date}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Award className="h-4 w-4 text-amber-500" />
                <h3 className="text-[13px] font-bold text-foreground">Work Anniversaries</h3>
              </div>
              <ul className="space-y-2">
                {HR_UPDATES.anniversaries.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px]">
                    <span className="font-medium text-foreground/80">{item.name}</span>
                    <span className="text-muted-foreground">{item.tenure}</span>
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
                  <li key={i} className="flex justify-between items-center text-[11px]">
                    <span className="font-medium text-foreground/80">{item.role}</span>
                    <span className="text-muted-foreground">{item.time}</span>
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
                  <li key={i} className="flex justify-between items-center text-[11px]">
                    <span className="font-medium text-foreground/80">{item.name}</span>
                    <span className="text-muted-foreground">{item.date}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="h-px bg-border/60"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <LogOut className="h-4 w-4 text-rose-500" />
                <h3 className="text-[13px] font-bold text-foreground">Employee Exit</h3>
              </div>
              <ul className="space-y-2">
                {HR_UPDATES.exit.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px]">
                    <span className="font-medium text-foreground/80">{item.name}</span>
                    <span className="text-muted-foreground">{item.date}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-bold text-foreground">Probation Ending</h3>
              </div>
              <ul className="space-y-2">
                {HR_UPDATES.probation.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px]">
                    <span className="font-medium text-foreground/80">{item.name}</span>
                    <span className="text-muted-foreground">{item.date}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="h-px bg-border/60"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-amber-500" />
                <h3 className="text-[13px] font-bold text-foreground">Document Expiry</h3>
              </div>
              <ul className="space-y-2">
                {HR_UPDATES.document.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px]">
                    <span className="font-medium text-foreground/80">{item.name}</span>
                    <span className="text-muted-foreground">{item.date}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="h-4 w-4 text-blue-500" />
                <h3 className="text-[13px] font-bold text-foreground">Policy Updates</h3>
              </div>
              <ul className="space-y-2">
                {HR_UPDATES.policies.map((item, i) => (
                  <li key={i} className="flex justify-between items-center text-[11px]">
                    <span className="font-medium text-foreground/80">{item.name}</span>
                    <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 rounded">{item.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
