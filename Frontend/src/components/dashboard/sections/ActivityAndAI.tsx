import { ACTIVITY_FEED, AI_SUMMARY } from "../dashboard-data";
import { cn } from "@/lib/utils";
import { Sparkles, ArrowRight, UserPlus, CheckCircle, CheckSquare, IndianRupee, Briefcase, Rocket, Banknote } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";

const IconMap: Record<string, any> = {
  UserPlus, CheckCircle, CheckSquare, IndianRupee, Briefcase, Rocket, Banknote
};

export function ActivityAndAI() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
      {/* SECTION 13: Calendar */}
      <div>
        <CollapsibleSection section="Section 13" title="Today's Calendar">
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm h-[320px] overflow-y-auto">
          <p className="text-[11px] text-muted-foreground mb-6">Meetings · birthdays · leaves · interviews · deadlines</p>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[13px] font-bold text-foreground">Board sync</p>
                <p className="text-[11px] text-muted-foreground">Meeting</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[13px] font-bold text-foreground">Frontend Engineer</p>
                <p className="text-[11px] text-muted-foreground">Interview</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[13px] font-bold text-foreground">Neha Patel</p>
                <p className="text-[11px] text-muted-foreground">Birthday</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[13px] font-bold text-foreground">Kite Social Launch</p>
                <p className="text-[11px] text-muted-foreground">Deadline</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[13px] font-bold text-foreground">Priya Nair – Sick</p>
                <p className="text-[11px] text-muted-foreground">Leave</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[13px] font-bold text-foreground">Monthly town hall</p>
                <p className="text-[11px] text-muted-foreground">Event</p>
              </div>
            </div>
          </div>
        </div>
        </CollapsibleSection>
      </div>

      {/* SECTION 14: Activity Feed */}
      <div>
        <CollapsibleSection section="Section 14" title="Recent Activity">
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm h-[320px] overflow-y-auto">
          <p className="text-[11px] text-muted-foreground mb-6">Everything happening across the company</p>
          <div className="space-y-5">
            {ACTIVITY_FEED.map((activity, i) => {
              const Icon = IconMap[activity.icon];
              return (
                <div key={i} className="flex gap-3">
                  <div className={cn("mt-0.5 p-1.5 rounded-full shrink-0 text-white", 
                    activity.color === 'emerald' ? 'bg-emerald-500' :
                    activity.color === 'indigo' ? 'bg-primary' :
                    activity.color === 'amber' ? 'bg-amber-500' : 'bg-blue-500'
                  )}>
                    {Icon && <Icon className="h-3 w-3" />}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-foreground leading-snug">{activity.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{activity.time}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        </CollapsibleSection>
      </div>

      {/* SECTION 15: AI Summary */}
      <div>
        <CollapsibleSection section="Section 15" title="AI Summary" titleIcon={<Sparkles className="h-5 w-5 text-primary" />}>
        <div className="bg-indigo-900 rounded-3xl p-6 text-white shadow-sm h-[320px] overflow-y-auto relative">
          <p className="text-[11px] text-indigo-200 mb-6">Generated from attendance, sales, finance and delivery signals</p>
          
          <div className="mb-6">
            <p className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-1">Sales Prediction</p>
            <p className="text-[28px] font-black text-white leading-none mb-1">{AI_SUMMARY.prediction}</p>
            <p className="text-[11px] text-indigo-300">{AI_SUMMARY.predictionText}</p>
          </div>

          <div>
            <p className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-3">Suggested Actions</p>
            <div className="space-y-3">
              {AI_SUMMARY.actions.map((action, i) => (
                <div key={i} className="flex gap-2">
                  <ArrowRight className="h-3 w-3 text-indigo-400 mt-0.5 shrink-0" />
                  <p className="text-[12px] font-medium leading-snug text-indigo-100">{action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
