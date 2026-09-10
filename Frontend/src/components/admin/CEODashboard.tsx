import { useState } from "react";
import { 
  Building2, Users, IndianRupee, Target, Briefcase, Handshake, 
  MapPin, AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, 
  Clock, ArrowDownRight, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/select";

export function CEODashboard({ active = "/ceo-dashboard" }: { active?: string }) {
  const [timeRange, setTimeRange] = useState("This Month");

  const metrics = [
    { label: "B2B Partners", value: "42", change: "+3", trend: "up", icon: Handshake, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Active B2B Leads", value: "156", change: "+12", trend: "up", icon: Target, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Deal Value", value: "₹8.5M", change: "this month", trend: "neutral", icon: IndianRupee, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Pending Commission", value: "₹4.2L", change: "awaiting settlement", trend: "neutral", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Tech Projects", value: "24", change: "active", trend: "neutral", icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active Collaborators", value: "8", change: "partner network", trend: "neutral", icon: Users, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Franchise Leads", value: "89", change: "pipeline", trend: "neutral", icon: Building2, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { label: "Active Territories", value: "14", change: "allocated", trend: "neutral", icon: MapPin, color: "text-purple-500", bg: "bg-purple-500/10" }
  ];

  const attentionItems = [
    { title: "12 settlements waiting for approval", type: "finance", action: "Review" },
    { title: "Ahmedabad North reservation expires tomorrow", type: "franchise", action: "View" },
    { title: "3 projects waiting for partner allocation", type: "tech", action: "Review" },
    { title: "7 high-priority follow-ups due today", type: "meetings", action: "View" }
  ];

  const activities = [
    { title: "Franchise Lead Converted", desc: "ABC Business Group → Ahmedabad North", time: "12 Aug 2026 · 10:42 AM", type: "franchise" },
    { title: "B2B Deal Won", desc: "XYZ Packaging → ₹8,50,000", time: "12 Aug 2026 · 09:30 AM", type: "b2b" },
    { title: "Tech Project Assigned", desc: "React Development → TechNova Solutions", time: "11 Aug 2026 · 05:20 PM", type: "tech" },
    { title: "Commission Approved", desc: "Shreeji Textiles → ₹62,000", time: "11 Aug 2026 · 02:05 PM", type: "finance" },
    { title: "Territory Reserved", desc: "Rajkot West → Patel Enterprises", time: "10 Aug 2026 · 11:15 AM", type: "franchise" }
  ];

  // If the active route is not the root ceo dashboard, render a placeholder for now
  if (active !== "/ceo-dashboard") {
    const sectionName = active.split("/").pop()?.replace("-", " ") || "Section";
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-center space-y-4">
        <Activity className="w-16 h-16 text-muted-foreground/20" />
        <h2 className="text-2xl font-black capitalize">{sectionName} Module</h2>
        <p className="text-muted-foreground max-w-md">
          This section is currently being rebuilt natively into the HRMS.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-1">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-foreground">CEO Overview</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Good Morning, Het 👋</h1>
          <p className="text-muted-foreground mt-2 font-medium">Here's what is happening across HK DigiVerse today.</p>
        </div>
        <div className="flex gap-2">
          <SearchableSelect 
            value={timeRange}
            onChange={(val) => setTimeRange(val)}
            options={[
              { label: "Today", value: "Today" },
              { label: "This Week", value: "This Week" },
              { label: "This Month", value: "This Month" },
              { label: "This Quarter", value: "This Quarter" }
            ]}
            className="w-[140px] h-[38px] px-4 bg-card border border-border/50 rounded-xl text-sm font-bold shadow-sm outline-none"
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <div key={i} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm flex flex-col justify-between group hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", metric.bg, metric.color)}>
                <metric.icon className="w-5 h-5" />
              </div>
              {metric.trend !== "neutral" && (
                <div className={cn(
                  "flex items-center gap-0.5 text-[10px] font-black uppercase px-2 py-1 rounded-md",
                  metric.trend === "up" ? "text-emerald-600 bg-emerald-500/10" : "text-rose-600 bg-rose-500/10"
                )}>
                  {metric.trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {metric.change}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 line-clamp-1">{metric.label}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-foreground">{metric.value}</h3>
              </div>
              {metric.trend === "neutral" && (
                <p className="text-[10px] font-bold text-muted-foreground mt-1">{metric.change}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* Main Chart Area Placeholder */}
          <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <Activity className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-xl font-black text-foreground mb-2">Growth Analytics</h3>
            <p className="text-muted-foreground font-medium text-center max-w-sm">
              Comprehensive B2B, Franchise, and Collaboration revenue charts will be visualized here.
            </p>
            <div className="mt-8 flex gap-4">
              <button onClick={() => toast.success("Generating growth report...")} className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-md">
                Generate Report
              </button>
            </div>
          </div>

          {/* Needs Your Attention */}
          <div>
            <h3 className="text-lg font-black tracking-tight mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Needs Your Attention
            </h3>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-2 shadow-sm space-y-1">
              {attentionItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-background/50 hover:bg-background rounded-2xl transition-colors border border-transparent hover:border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <p className="font-bold text-sm text-foreground">{item.title}</p>
                  </div>
                  <button onClick={() => toast.info(`Action triggered: ${item.action} for ${item.title}`)} className="flex items-center gap-1 text-xs font-black uppercase text-amber-600 hover:text-amber-700 transition-colors px-3 py-1.5 bg-amber-500/10 rounded-lg shrink-0">
                    {item.action} <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          
          {/* Recent Activity */}
          <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-black tracking-tight mb-6">Recent Activity</h3>
            <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-border/50">
              {activities.map((activity, i) => (
                <div key={i} className="relative pl-8">
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{activity.title}</h4>
                    <p className="text-xs font-medium text-foreground/80 mt-1">{activity.desc}</p>
                    <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-wider">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => toast.success("Loading all historical activity...")} className="w-full mt-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-colors border border-transparent hover:border-border/50">
              View All Activity
            </button>
          </div>

          {/* Quick Actions */}
          <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6">
            <h3 className="text-sm font-black tracking-tight mb-4 uppercase text-primary/80">Quick Actions</h3>
            <div className="space-y-2">
              {['Review pending B2B settlements', 'Approve new Franchise territories', 'Allocate Tech Collaboration projects', 'Check upcoming executive meetings'].map((action, i) => (
                <button key={i} onClick={() => toast.info(`Opening: ${action}`)} className="w-full flex items-center justify-between p-3 bg-background border border-border/50 rounded-xl hover:border-primary/30 hover:shadow-md transition-all text-left group">
                  <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{action}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
